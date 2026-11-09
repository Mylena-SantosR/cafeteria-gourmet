/* Cafeteria Gourmet - checkout conectado à API da cafeteria (PIT II).
 * Complemento para ux-melhorias.js e ux-pedidos.js.
 * Somente em localhost; NAO publicar sem autenticação, proteção de dados e testes completos.
 */
(() => {
  'use strict';
  const hostsLocais = new Set(['127.0.0.1', 'localhost']);
  

  const BASE_API = 'https://api-cafeteria-gourmet.onrender.com';
  const brl = v => Number(v).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
  const $ = id => document.getElementById(id);
  let versao = 0;
  let pendente = null;
  let resumoAtual = null;
  let assinaturaAtual = '';
  let temporizador = null;

  function itensDoCarrinho() {
    const grupos = new Map();
    for (const item of Array.isArray(carrinho) ? carrinho : []) {
      const id = Number(item.id), preco = Number(item.preco);
      if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(preco)) continue;
      if (!grupos.has(id)) grupos.set(id,{id,quantidade:0,preco});
      grupos.get(id).quantidade += 1;
    }
    return [...grupos.values()];
  }
  const modalidade = () => $('ux-modalidade-entrega')?.value === 'retirada' ? 'retirada' : 'entrega';
  const assinatura = () => JSON.stringify({tipo_entrega:modalidade(), itens:itensDoCarrinho()});
  function corpo(itens, cliente_id=0) {
    return {cliente_id, tipo_entrega:modalidade(), itens};
  }
  function mensagem(texto, erro=false) {
    const el = $('ux-api-mensagem');
    if (el) {el.textContent = texto; el.classList.toggle('erro',erro);}
  }
  function setResumo(resumo, nota) {
    $('ux-resumo-subtotal').textContent = brl(resumo.subtotal);
    $('ux-resumo-frete').textContent = Number(resumo.frete) === 0 ? 'Grátis' : brl(resumo.frete);
    $('ux-resumo-total').textContent = brl(resumo.total);
    $('modal-total-display').textContent = 'Total: ' + brl(resumo.total);
    mensagem(nota || 'Valores calculados pela API de testes. Nenhuma cobrança será realizada.');
  }
  async function requisicao(caminho, payload) {
    const resposta = await fetch(BASE_API+caminho, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload), cache:'no-store'
    });
    if (!resposta.ok) throw new Error(`API respondeu ${resposta.status} em ${caminho}`);
    return resposta.json();
  }
  async function simular(itens, version) {
    const resposta = await requisicao('/pedidos/simular-total', corpo(itens));
    if (![resposta.subtotal,resposta.frete,resposta.total].every(v=>Number.isFinite(Number(v))))
      throw new Error('Resposta de total incompleta');
    if (version !== versao) return null;
    return resposta;
  }
  async function atualizar() {
    const version = ++versao;
    const itens = itensDoCarrinho();
    resumoAtual = null;
    assinaturaAtual = '';
    if (!itens.length) {
      if ($('ux-resumo-subtotal')) {
        setResumo({subtotal:0,frete:0,total:0},'Adicione produtos para visualizar o valor do pedido.');
      }
      return;
    }
    mensagem('Consultando valores oficiais na API...');
    try {
      const assinaturaRequisicao = assinatura();
      const resposta = await simular(itens,version);
      if (!resposta) return;
      resumoAtual = resposta;
      assinaturaAtual = assinaturaRequisicao;
      setResumo(resposta);
    } catch(error) {
      if(version !== versao) return;
      console.warn('Não foi possível atualizar o resumo de entrega:',error.message);
      if ($('modal-total-display')) $('modal-total-display').textContent = 'Total indisponível';
      mensagem('Não foi possível calcular o frete pela API. Confira a conexão local.',true);
    }
  }
  function agendar() {
    clearTimeout(temporizador);
    temporizador = setTimeout(()=>{pendente = atualizar();},120);
  }
  function ajustarEndereco() {
    const campo = $('check-endereco');
    if (!campo) return;
    const retirada = modalidade() === 'retirada';
    campo.required = !retirada;
    campo.placeholder = retirada ? 'Não necessário para retirada' : 'Rua, número e bairro (Luziânia)';
    const label = campo.closest('.form-group')?.querySelector('label');
    if (label) label.textContent = retirada ? 'Endereço (opcional para retirada)' : 'Endereço de entrega *';
  }
  async function confirmarLocal() {
    const form = $('form-checkout');
    if (!form.reportValidity()) return;
    if (!itensDoCarrinho().length) {window.mostrarToast?.('O carrinho está vazio.',true);return;}
    const botao=form.querySelector('button[type="submit"]');
    if (botao.disabled) return;
    const itens = itensDoCarrinho();
    const tipo = modalidade();
    botao.disabled = true;
    botao.textContent = 'Conferindo pedido...';
    try {
      const prev = await requisicao('/pedidos/simular-total',{cliente_id:0,tipo_entrega:tipo,itens});
      if (![prev.subtotal,prev.frete,prev.total].every(v=>Number.isFinite(Number(v))))
        throw new Error('Resumo do pedido inválido');
      // Não submeter se o carrinho ou a modalidade mudaram durante a conferência.
      if (tipo !== modalidade() || JSON.stringify(itens) !== JSON.stringify(itensDoCarrinho()))
        throw new Error('O carrinho mudou durante a conferência. Revise o total e tente novamente.');
      setResumo(prev);
      const dados = {
        nome:$('check-nome').value.trim(),
        email:$('check-email').value.trim(),
        telefone:$('check-telefone').value.trim(),
        endereco:tipo==='retirada'
          ? ($('check-endereco').value.trim() || 'Retirada no local (demonstração)')
          : $('check-endereco').value.trim()
      };
      const cliente = await requisicao('/clientes/sync',dados);
      if (!Number.isInteger(Number(cliente.cliente_id)) || Number(cliente.cliente_id)<=0)
        throw new Error('Cliente sem identificação válida');
      botao.textContent = 'Registrando pedido...';
      const pedido = await requisicao('/pedidos',{
        cliente_id:Number(cliente.cliente_id), tipo_entrega:tipo, itens
      });
      if (!Number.isInteger(Number(pedido.pedido_id)) || Number(pedido.pedido_id)<=0)
        throw new Error('API não confirmou o número do pedido');
      const totalConfirmado = Number(pedido.total);
      if (!Number.isFinite(totalConfirmado))
        throw new Error('API não confirmou o total');

      // A rotina histórica utiliza totalGeral ao criar a entrada local.
      totalGeral = totalConfirmado;
      dadosUsuario.nome=dados.nome;
      dadosUsuario.email=dados.email;
      dadosUsuario.telefone=dados.telefone;
      if(tipo==='entrega')dadosUsuario.endereco=dados.endereco;
      salvarEstadoLocal();
      processarSucessoPedido(Number(pedido.pedido_id));
      const novo = historicoPedidos.find(p=>Number(p.id)===Number(pedido.pedido_id));
      if(novo){
        novo.total=totalConfirmado;
        novo.subtotal=Number(pedido.subtotal ?? prev.subtotal);
        novo.frete=Number(pedido.frete ?? prev.frete);
        novo.tipo_entrega=String(pedido.tipo_entrega || tipo);
        novo.status=String(pedido.status || 'Pendente');
        salvarEstadoLocal();
        renderizarHistoricoPedidos();
      }
      window.mostrarToast?.(`Pedido de teste #${pedido.pedido_id} registrado!`);
    } catch(error) {
      console.error('Checkout de testes:',error);
      mensagem('Não foi possível confirmar o pedido; nenhum novo registro foi confirmado nesta tela.',true);
      window.mostrarToast?.('Erro na finalização. Confira a API e não reenvie antes de verificar no banco.',true);
    } finally {
      botao.disabled=false;
      botao.textContent='Confirmar pedido de demonstração';
    }
  }
  function enriquecerHistorico() {
    const renderOriginal = window.renderizarHistoricoPedidos;
    if(typeof renderOriginal!=='function')return;
    window.renderizarHistoricoPedidos = function(...args){
      const retorno=renderOriginal.apply(this,args);
      const pedidos = Array.isArray(historicoPedidos) ? [...historicoPedidos].reverse() : [];
      document.querySelectorAll('#lista-historico-pedidos .ux-order-card').forEach((card,i)=>{
        const pedido=pedidos[i];
        if(!pedido || !pedido.tipo_entrega) return;
        const panel=card.querySelector('.ux-order-details-body');
        if(!panel)return;
        const div=document.createElement('div');div.className='ux-checkout-historico';
        const titulo=document.createElement('h4');titulo.textContent='Entrega e valores';div.append(titulo);
        const linhas=[
          ['Modalidade',pedido.tipo_entrega==='retirada'?'Retirada no local':'Entrega (demonstração)'],
          ['Subtotal',brl(pedido.subtotal)],
          ['Frete',Number(pedido.frete)===0?'Grátis':brl(pedido.frete)],
          ['Total',brl(pedido.total)]
        ];
        for(const [chave,valor] of linhas){
          const p=document.createElement('p');p.textContent=`${chave}: ${valor}`;div.append(p);
        }
        panel.append(div);
      });
      return retorno;
    };
    window.renderizarHistoricoPedidos();
  }
  function iniciar(){
    const sec=$('ux-entrega');
    if(!sec || typeof window.uxAtualizarEntrega!=='function'){
      console.warn('Checkout: precisa dos complementos ux-melhorias.js e ux-pedidos.js.');
      return;
    }
    const antigoDisclaimer=sec.querySelector('.ux-disclaimer');
    if (antigoDisclaimer) antigoDisclaimer.textContent =
      'Protótipo acadêmico. Os valores são conferidos pela API da cafeteria. ' +
      'Não há pagamento real nem verificação automática de endereço e área de entrega.';
    const status=document.createElement('p');
    status.id='ux-api-mensagem';status.className='ux-api-mensagem';
    status.setAttribute('aria-live','polite');
    sec.append(status);
    const btn=$('form-checkout')?.querySelector('button[type="submit"]');
    if(btn)btn.textContent='Confirmar pedido de demonstração';

    window.uxAtualizarEntrega=agendar;
    $('ux-modalidade-entrega').addEventListener('change',()=>{ajustarEndereco();agendar();});
    ajustarEndereco();
    const checkoutOriginal=window.abrirCheckoutValidado;
    if(typeof checkoutOriginal==='function'){
      window.abrirCheckoutValidado=function(...args){
        const resultado=checkoutOriginal.apply(this,args);
        if($('modal-checkout')?.classList.contains('active'))agendar();
        return resultado;
      };
    }
    window.confirmarEPagar=confirmarLocal;
    enriquecerHistorico();
    agendar();
    console.info('Checkout API da cafeteria: resumo e modalidades conectados.');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar);
  else iniciar();
})();
