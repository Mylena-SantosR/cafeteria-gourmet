/* Cafeteria Gourmet - melhorias UX para PIT II.
 * Carregar como SCRIPT CLÁSSICO após o script original do index.html.
 * O checkout e a autenticação existentes NÃO são alterados por este arquivo.
 */
(() => {
  'use strict';
  const brl = valor => Number(valor).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
  const normalizar = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const categorias = {quentes:'Bebidas quentes',gelados:'Bebidas geladas',salgados:'Salgados',doces:'Doces',outros:'Outros'};
  // Preencher somente com dados confirmados sobre os produtos: não inventar ingredientes/alérgenos.
  // Exemplo de edição: 1: { ingredientes:'[ingredientes confirmados]', porcao:'[volume confirmado]' },
  // Quantidades e preços definidos para o protótipo acadêmico.
  // ATENÇÃO: os preços oficiais devem vir dos registros do PostgreSQL (migração SQL inclusa).
  const PORCOES = {
    'cafe gourmet premium': 'Pronto para beber: 150 ml',
    'cappuccino': 'Copo de 250 ml',
    'chocolate quente': 'Copo de 250 ml',
    'croissant de manteiga': '1 unidade de 150 g',
    'pao de queijo recheado': '1 unidade de 250 g',
    'bolo de cenoura': '1 fatia de 200 g',
    'frappuccino de caramelo': 'Copo de 350 ml',
    'cha gelado de pessego': 'Copo de 350 ml'
  };
  const PRECOS_PREMIUM = Object.freeze({pronto:22, graos:30, moido:35});
  const DESCRICOES_PREMIUM = Object.freeze({
    pronto:'Pronto para beber — 150 ml', graos:'Em grãos — 300 g', moido:'Moído — 300 g'
  });
  function tipoPremium(card) {
    const nome=normalizar(card.querySelector('h3')?.textContent||'');
    if(!nome.includes('cafe gourmet premium'))return null;
    if(nome.includes('em graos'))return 'graos';
    if(nome.includes('moido'))return 'moido';
    return 'pronto';
  }
  function precoOriginal(card) {
    const onclick=card.querySelector('button.btn-comprar[onclick]')?.getAttribute('onclick')||'';
    const match=onclick.match(/,\s*(\d+(?:\.\d+)?)\s*\)\s*$/);
    return match ? Number(match[1]) : null;
  }
  function variantesPremium() {
    const opcoes=[];
    document.querySelectorAll('#vitrine .produto-card').forEach(card=>{
      const tipo=tipoPremium(card);
      if(!tipo)return;
      const id=idProduto(card),preco=precoOriginal(card);
      if(id===null||preco===null)return;
      opcoes.push({tipo,id,preco,descricao:DESCRICOES_PREMIUM[tipo]});
    });
    return ['pronto','graos','moido'].map(tipo=>opcoes.find(x=>x.tipo===tipo)).filter(Boolean);
  }
  const DETALHES_VERIFICADOS = {};
  let categoriaAtiva = 'todos';

  function criarBusca() {
    const filtros = document.querySelector('#cardapio .filtros');
    if (!filtros || document.getElementById('ux-busca')) return;
    const wrap = document.createElement('div');
    wrap.className='ux-busca';
    wrap.innerHTML='<label for="ux-busca">Encontre seu café ou acompanhamento</label><input id="ux-busca" type="search" autocomplete="off" placeholder="Buscar por nome ou descrição..." aria-controls="vitrine">';
    filtros.parentNode.insertBefore(wrap, filtros);
    const status=document.createElement('p');
    status.id='ux-contador';status.className='ux-contador-busca';status.setAttribute('aria-live','polite');
    const vazio=document.createElement('p');
    vazio.id='ux-sem-resultado';vazio.className='ux-nenhum';vazio.hidden=true;
    vazio.textContent='Nenhum produto encontrado. Tente outro termo ou categoria.';
    const vitrine=document.getElementById('vitrine');
    vitrine.parentNode.insertBefore(status,vitrine);
    vitrine.insertAdjacentElement('afterend',vazio);
    document.getElementById('ux-busca').addEventListener('input',filtrar);

    // Substitui o filtro anterior para combinar categoria + texto sem atrasos na exibição.
    window.filtrarMenu = (categoria,botao) => {
      categoriaAtiva=categoria;
      document.querySelectorAll('.filter-btn').forEach(b=>b.classList.toggle('active',b===botao));
      filtrar();
    };
  }

  function filtrar() {
    const cards=[...document.querySelectorAll('#vitrine .produto-card')];
    const termo=normalizar(document.getElementById('ux-busca')?.value);
    let visiveis=0;
    for(const card of cards){
      const categoriaOk=categoriaAtiva==='todos'||card.dataset.categoria===categoriaAtiva;
      const texto=normalizar(card.querySelector('h3')?.textContent+' '+card.querySelector('.produto-info p')?.textContent);
      const mostrar=card.dataset.uxVarianteOculta!=='1' && categoriaOk && texto.includes(termo);
      card.style.display=mostrar?'flex':'none';
      card.style.opacity=mostrar?'1':'0';
      if(mostrar) visiveis++;
    }
    const status=document.getElementById('ux-contador');
    if(status)status.textContent=cards.length?`${visiveis} produto(s) encontrado(s)`:'';
    const vazio=document.getElementById('ux-sem-resultado');
    if(vazio)vazio.hidden=!cards.length||visiveis!==0;
  }

  function criarBotao(texto,classe,acao,id){
    const b=document.createElement('button');b.type='button';b.className=classe;b.textContent=texto;
    b.dataset.acao=acao; b.dataset.id=String(id);return b;
  }

  function instalarCarrinho() {
    const lista=document.getElementById('itens-carrinho');
    if(!lista)return;
    // O carrinho do site original guarda uma entrada por unidade, em uma variável global lexical.
    window.atualizarCarrinho = () => {
      const itens = document.getElementById('itens-carrinho');
      const contador=document.getElementById('cart-count');
      const resumo=document.getElementById('total-carrinho');
      if(!itens||!contador||!resumo)return;
      itens.replaceChildren();
      contador.textContent=String(carrinho.length);
      totalGeral=0;
      const grupos=new Map();
      for(const item of carrinho){
        const id=Number(item.id), preco=Number(item.preco);
        if(!Number.isFinite(preco))continue;
        totalGeral+=preco;
        if(!grupos.has(id))grupos.set(id,{id,nome:item.nome,preco,quantidade:0});
        grupos.get(id).quantidade++;
      }
      if(!grupos.size){
        const p=document.createElement('p');p.className='ux-nenhum';p.textContent='O carrinho está vazio.';itens.appendChild(p);
      } else {
        for(const item of grupos.values()){
          const linha=document.createElement('div');linha.className='item-carrinho';
          const wrap=document.createElement('div');wrap.className='ux-qty-row';
          const descricao=document.createElement('div');descricao.className='ux-qty-description';
          const nome=document.createElement('strong');nome.textContent=item.nome;
          const preco=document.createElement('small');preco.textContent=`Subtotal: ${brl(item.quantidade*item.preco)}`;
          descricao.append(nome,preco);
          const controle=document.createElement('div');controle.className='ux-qty-controls';
          const menos=criarBotao('−','ux-qty-btn','diminuir',item.id);menos.setAttribute('aria-label',`Diminuir ${item.nome}`);
          const qtd=document.createElement('span');qtd.className='ux-qty-count';qtd.textContent=item.quantidade;
          const mais=criarBotao('+','ux-qty-btn','aumentar',item.id);mais.setAttribute('aria-label',`Aumentar ${item.nome}`);
          const remover=criarBotao('×','ux-qty-btn ux-remove','remover',item.id);remover.setAttribute('aria-label',`Remover ${item.nome}`);
          controle.append(menos,qtd,mais,remover);wrap.append(descricao,controle);linha.appendChild(wrap);itens.appendChild(linha);
        }
      }
      resumo.textContent=brl(totalGeral);
      const limpar=document.getElementById('ux-limpar-carrinho');
      if(limpar) limpar.hidden=!carrinho.length;
      salvarEstadoLocal();
      window.uxAtualizarEntrega?.();
    };
    lista.addEventListener('click',evento=>{
      const b=evento.target.closest('button[data-acao]');if(!b)return;
      const id=Number(b.dataset.id);
      const indice=carrinho.findIndex(x=>Number(x.id)===id);
      if(indice<0)return;
      if(b.dataset.acao==='diminuir')carrinho.splice(indice,1);
      if(b.dataset.acao==='remover')carrinho=carrinho.filter(x=>Number(x.id)!==id);
      if(b.dataset.acao==='aumentar'){
        if(carrinho.length>=20){mostrarToast('Limite de 20 unidades por pedido.',true);return;}
        carrinho.push({...carrinho[indice]});
      }
      window.atualizarCarrinho();
    });
    const limpar=document.createElement('button');
    limpar.id='ux-limpar-carrinho';limpar.className='ux-clear';limpar.type='button';
    limpar.textContent='Limpar carrinho';
    limpar.addEventListener('click',()=>{
      if(!window.confirm('Remover todos os produtos do carrinho?'))return;
      carrinho=[];window.atualizarCarrinho();
    });
    lista.insertAdjacentElement('afterend',limpar);
    window.atualizarCarrinho();
  }

  function idProduto(card){
    const str=card.querySelector('.btn-comprar')?.getAttribute('onclick')||'';
    const match=str.match(/adicionarAoCarrinho\(\s*(\d+)\s*,/);
    return match?Number(match[1]):null;
  }
  function configurarDetalhes(){
    const vitrine=document.getElementById('vitrine');if(!vitrine)return;
    const modal=document.createElement('div');
    modal.id='ux-detalhes-modal';modal.className='ux-details-modal';modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','ux-detail-titulo');
    modal.innerHTML='<div class="ux-details-panel"><button type="button" class="ux-details-close" aria-label="Fechar detalhes">×</button><img class="ux-details-photo" alt=""><div class="ux-details-body"><h2 id="ux-detail-titulo"></h2><p id="ux-detail-descricao"></p><p class="ux-price" id="ux-detail-preco"></p><dl><dt>Categoria</dt><dd id="ux-detail-categoria"></dd><dt>Ingredientes</dt><dd id="ux-detail-ingredientes"></dd><dt>Porção</dt><dd id="ux-detail-porcao"></dd></dl><p class="ux-disclaimer" style="font-size:.8rem">Consulte a cafeteria para confirmar ingredientes, restrições alimentares e tamanhos ainda não cadastrados.</p><button type="button" class="btn-comprar" id="ux-detail-comprar" style="margin-top:10px;width:100%">Adicionar ao carrinho</button></div></div>';
    document.body.appendChild(modal);
    let focado=null;
    const fechar=()=>{modal.classList.remove('open');document.body.style.overflow='';focado?.focus();};
    modal.querySelector('.ux-details-close').addEventListener('click',fechar);
    modal.addEventListener('click',ev=>{if(ev.target===modal)fechar();});
    document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&modal.classList.contains('open'))fechar();});
    function abrir(card){
      focado=document.activeElement;
      const id=idProduto(card);
      const detalhes=DETALHES_VERIFICADOS[id]||{};
      const src=card.querySelector('img')?.getAttribute('src')||'';
      const nome=card.querySelector('h3')?.textContent||'Produto';
      modal.querySelector('.ux-details-photo').src=src;
      modal.querySelector('.ux-details-photo').alt=nome;
      modal.querySelector('#ux-detail-titulo').textContent=nome;
      modal.querySelector('#ux-detail-descricao').textContent=card.querySelector('.produto-info p')?.textContent||'';
      modal.querySelector('#ux-detail-preco').textContent=card.querySelector('.preco')?.textContent||'';
      modal.querySelector('#ux-detail-categoria').textContent=categorias[card.dataset.categoria]||'Produto do cardápio';
      modal.querySelector('#ux-detail-ingredientes').textContent=detalhes.ingredientes||'Informação ainda não cadastrada';
      modal.querySelector('#ux-detail-porcao').textContent=detalhes.porcao||PORCOES[normalizar(nome)]||'Informação ainda não cadastrada';
      // Para o Café Premium, o usuário escolhe uma variante real cadastrada na API.
      // Cada opção tem ID próprio no PostgreSQL, preservando o correto registro do pedido.
      modal.querySelector('#ux-premium-escolha')?.remove();
      const premium=tipoPremium(card);
      let opcoes=[];
      let select=null;
      if(premium){
        opcoes=variantesPremium();
        const caixa=document.createElement('div');caixa.id='ux-premium-escolha';caixa.className='ux-premium-escolha';
        const titulo=document.createElement('label');titulo.htmlFor='ux-variant-select';titulo.textContent='Escolha o formato do seu café';
        select=document.createElement('select');select.id='ux-variant-select';select.className='form-control';
        for(const o of opcoes){
          const option=document.createElement('option');option.value=o.tipo;
          const correto=Math.abs(o.preco-PRECOS_PREMIUM[o.tipo])<0.001;
          option.textContent=`${o.descricao} — ${brl(PRECOS_PREMIUM[o.tipo])}${correto?'':' (preço do banco precisa ser atualizado)'}`;
          option.disabled=!correto;
          select.appendChild(option);
        }
        const info=document.createElement('p');info.className='ux-disclaimer';
        info.textContent=opcoes.length!==3?'Algumas opções ainda não foram cadastradas no banco de dados.':'Escolha uma opção antes de adicionar ao carrinho.';
        caixa.append(titulo,select,info);
        modal.querySelector('#ux-detail-preco').insertAdjacentElement('afterend',caixa);
        const primeira=[...select.options].find(o=>!o.disabled);
        if(primeira)select.value=primeira.value;
        else select.selectedIndex=-1;
        const atualizarPreco=()=>{
          const o=opcoes.find(x=>x.tipo===select.value);
          modal.querySelector('#ux-detail-preco').textContent=o&&Math.abs(o.preco-PRECOS_PREMIUM[o.tipo])<.001?brl(o.preco):'Preço indisponível';
          modal.querySelector('#ux-detail-porcao').textContent=o?.descricao||'Selecione uma opção cadastrada';
        };
        select.addEventListener('change',atualizarPreco);atualizarPreco();
      }
      const comprar=modal.querySelector('#ux-detail-comprar');
      comprar.disabled=Boolean(premium&&!opcoes.some(o=>Math.abs(o.preco-PRECOS_PREMIUM[o.tipo])<.001));
      comprar.onclick=()=>{
        if(premium){
          const escolhido=opcoes.find(x=>x.tipo===select?.value);
          if(!escolhido||Math.abs(escolhido.preco-PRECOS_PREMIUM[escolhido.tipo])>=.001)return;
          adicionarAoCarrinho(escolhido.id,`Café Gourmet Premium — ${escolhido.descricao}`,escolhido.preco);
        }else card.querySelector('.btn-comprar')?.click();
        fechar();
      };
      modal.classList.add('open');document.body.style.overflow='hidden';modal.querySelector('.ux-details-close').focus();
    }
    document.addEventListener('click',ev=>{
      const botao=ev.target.closest('.ux-detalhes-btn');
      if(botao){const card=botao.closest('.produto-card');if(card)abrir(card);}
    });
    // Em vez de adicionar o café básico diretamente, abrir a escolha de apresentação.
    document.addEventListener('click',ev=>{
      const b=ev.target.closest('#vitrine .produto-card button.btn-comprar, #ux-destaques-grid .produto-card button.btn-comprar');
      if(!b)return;
      const card=b.closest('.produto-card');
      if(card&&tipoPremium(card)){
        ev.preventDefault();ev.stopPropagation();abrir(card);
      }
    },true);
    window.uxPrepararCards = () => {
      vitrine.querySelectorAll('.produto-card').forEach(card=>{
        const variante=tipoPremium(card);
        if(variante&&variante!=='pronto')card.dataset.uxVarianteOculta='1';
        if(card.querySelector('.ux-detalhes-btn'))return;
        const b=document.createElement('button');b.type='button';b.className='ux-btn ux-detalhes-btn';b.textContent='Ver detalhes';
        card.querySelector('.produto-info')?.appendChild(b);
      });
    };
  }

  function criarDestaques(){
    const hero=document.querySelector('header.hero');if(!hero)return;
    const section=document.createElement('section');section.id='destaques';section.className='ux-shelf';
    section.innerHTML='<div class="ux-shelf-inner"><p class="ux-shelf-kicker">Nossa seleção</p><h2 class="section-title">Destaques da Cafeteria</h2><p class="ux-shelf-subtitle">Alguns sabores para começar a explorar nosso cardápio.</p><div class="ux-shelf-grid" id="ux-destaques-grid"></div></div>';
    hero.insertAdjacentElement('afterend',section);
    window.uxAtualizarDestaques=()=>{
      const lista=[...document.querySelectorAll('#vitrine .produto-card')].filter(c=>c.dataset.uxVarianteOculta!=='1');
      const caixa=document.getElementById('ux-destaques-grid');if(!caixa||!lista.length)return;
      const marcados=lista.filter(card=>(card.querySelector('.badge')?.textContent||'').includes('Mais Vendido'));
      const selecionados=[...marcados,...lista.filter(c=>!marcados.includes(c))].slice(0,3);
      caixa.replaceChildren(...selecionados.map(card=>card.cloneNode(true)));
    };
  }

  function detalharEntrega(){
    const form=document.getElementById('form-checkout');
    const pagamento=form?.querySelector('#forma-pagamento')?.closest('.form-group');
    if(!form||!pagamento||document.getElementById('ux-entrega'))return;
    const sec=document.createElement('section');sec.id='ux-entrega';sec.className='ux-shipping';
    sec.innerHTML='<h4>🚚 Entrega e retirada (simulação acadêmica)</h4><p><strong>Área de entrega:</strong> zona urbana de Luziânia, sujeita à confirmação do endereço.</p><p><strong>Prazo estimado:</strong> 40 a 60 minutos.</p><p><strong>Taxa de entrega:</strong> R$ 6,90; grátis para subtotal de produtos a partir de R$ 60,00.</p><p><strong>Retirada no local:</strong> gratuita.</p><div class="ux-entrega-tipo"><label for="ux-modalidade-entrega">Modalidade para estimativa</label><select id="ux-modalidade-entrega" class="form-control"><option value="entrega">Entrega (zona urbana de Luziânia)</option><option value="retirada">Retirada no local</option></select></div><div class="ux-estimativa-valores" aria-live="polite"><p>Subtotal dos produtos: <strong id="ux-resumo-subtotal">R$ 0,00</strong></p><p>Frete simulado: <strong id="ux-resumo-frete">R$ 0,00</strong></p><p>Total ilustrativo: <strong id="ux-resumo-total">R$ 0,00</strong></p></div><p class="ux-disclaimer">Protótipo acadêmico: esta estimativa não é cobrada nem enviada à API. O backend ainda precisa integrar e validar a modalidade, a área atendida e a taxa de entrega antes de confirmar pedidos.</p>';
    pagamento.insertAdjacentElement('beforebegin',sec);
    window.uxAtualizarEntrega=()=>{
      const subtotal=Array.isArray(carrinho)?carrinho.reduce((s,item)=>s+(Number(item.preco)||0),0):0;
      const retirada=document.getElementById('ux-modalidade-entrega')?.value==='retirada';
      const frete=retirada||subtotal>=60||subtotal===0?0:6.90;
      document.getElementById('ux-resumo-subtotal').textContent=brl(subtotal);
      document.getElementById('ux-resumo-frete').textContent=frete===0?'Grátis':brl(frete);
      document.getElementById('ux-resumo-total').textContent=brl(subtotal+frete);
    };
    document.getElementById('ux-modalidade-entrega').addEventListener('change',window.uxAtualizarEntrega);
    window.uxAtualizarEntrega();
    const btn=form.querySelector('button[type="submit"]');
    if(btn)btn.title='Pedido de demonstração — não há cobrança real';
    // Aviso junto aos formulários de login; não altera nem valida a autenticação.
    for(const id of ['modal-login','modal-cadastro']){
      const modal=document.getElementById(id);
      const el=modal?.querySelector('form');
      if(el&&!modal.querySelector('.ux-demo-auth')){
        const aviso=document.createElement('p');aviso.className='ux-demo-auth';
        aviso.textContent='Atenção: autenticação de demonstração. Não utilize senhas reais neste projeto acadêmico.';
        el.insertAdjacentElement('beforebegin',aviso);
      }
    }
  }

  function observarCatalogo(){
    const vitrine=document.getElementById('vitrine');
    if(!vitrine)return;
    let prev=0;
    const observer=new MutationObserver(()=>{
      const n=vitrine.querySelectorAll('.produto-card').length;
      if(n===prev)return; prev=n;
      window.uxPrepararCards?.();
      window.uxAtualizarDestaques?.();
      filtrar();
    });
    observer.observe(vitrine,{childList:true,subtree:false});
    window.uxPrepararCards?.();window.uxAtualizarDestaques?.();filtrar();
  }

  function iniciar(){
    criarBusca();instalarCarrinho();configurarDetalhes();criarDestaques();detalharEntrega();observarCatalogo();
    console.info('Cafeteria Gourmet: cinco melhorias de UX carregadas.');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);
  else iniciar();
})();
