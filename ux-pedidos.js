/* PIT II — Histórico de pedidos detalhado (versão de testes)
   Não consulta a API; usa o histórico local já existente e, para pedidos novos,
   preserva uma fotografia dos itens que estavam no carrinho. */
(() => {
  'use strict';

  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const valor = (n) => Number.isFinite(Number(n)) ? moeda.format(Number(n)) : 'Não informado';

  function agruparCarrinho(itens) {
    const mapa = new Map();
    for (const item of itens) {
      const id = Number(item.id);
      const preco = Number(item.preco);
      if (!Number.isInteger(id) || !Number.isFinite(preco) || preco < 0) continue;
      const nome = String(item.nome || 'Produto não identificado');
      const chave = `${id}:${preco}`;
      if (!mapa.has(chave)) mapa.set(chave, { id, nome, quantidade: 0, precoUnitario: preco });
      mapa.get(chave).quantidade += 1;
    }
    return [...mapa.values()];
  }

  function elemento(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = String(texto);
    return el;
  }

  function statusEtapa(status) {
    const valorStatus = String(status || '').toLowerCase().trim();
    if (valorStatus === 'entregue') return 4;
    if (valorStatus === 'em rota' || valorStatus === 'saiu para entrega') return 3;
    if (valorStatus === 'preparando') return 2;
    return 1;
  }

  function criarDetalhes(pedido) {
    const detalhes = elemento('details', 'ux-order-details');
    const sumario = elemento('summary', '', 'Ver itens do pedido');
    detalhes.append(sumario);
    const corpo = elemento('div', 'ux-order-details-body');
    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

    if (itens.length === 0) {
      corpo.append(elemento('p', 'ux-order-legacy',
        'Os produtos deste pedido antigo não foram salvos no histórico do navegador. ' +
        'Os próximos pedidos terão a lista de itens disponível aqui.'));
    } else {
      corpo.append(elemento('h4', 'ux-order-subheading', 'Produtos comprados'));
      const lista = elemento('ul', 'ux-order-items');
      for (const item of itens) {
        const qtd = Number(item.quantidade);
        const preco = Number(item.precoUnitario);
        if (!Number.isFinite(qtd) || qtd <= 0 || !Number.isFinite(preco) || preco < 0) continue;
        const linha = elemento('li', 'ux-order-item');
        const descricao = elemento('div', 'ux-order-item-description');
        descricao.append(elemento('strong', '', String(item.nome || 'Produto')));
        descricao.append(elemento('small', '', `${qtd} × ${valor(preco)}`));
        linha.append(descricao, elemento('strong', 'ux-order-item-total', valor(qtd * preco)));
        lista.append(linha);
      }
      corpo.append(lista);
      corpo.append(elemento('p', 'ux-order-detail-note',
        'Os itens exibidos são uma cópia do carrinho no momento da confirmação.'));
    }
    detalhes.append(corpo);
    return detalhes;
  }

  function criarCard(pedido) {
    const card = elemento('article', 'pedido-card ux-order-card');
    const cabecalho = elemento('div', 'pedido-header');
    const tituloBox = elemento('div', '');
    tituloBox.append(elemento('h3', '', `Pedido #${pedido.id ?? '—'}`));
    tituloBox.append(elemento('p', 'ux-order-date', `Realizado em: ${pedido.data || 'Data não informada'}`));
    const valorBox = elemento('div', 'ux-order-totals');
    valorBox.append(elemento('strong', 'ux-order-value', valor(pedido.total)));
    valorBox.append(elemento('p', '', `${pedido.itensQtde ?? (pedido.itens || []).reduce((s,i)=>s+Number(i.quantidade||0),0)} itens`));
    cabecalho.append(tituloBox, valorBox);
    card.append(cabecalho);

    const tracker = elemento('div', 'tracker');
    const etapa = statusEtapa(pedido.status);
    for (const [i,nome] of ['Recebido', 'Preparando', 'Em Rota', 'Entregue'].entries()) {
      const passo = elemento('div', `tracker-step ${etapa >= i + 1 ? 'active' : ''}`);
      passo.append(elemento('div', 'tracker-icon', etapa >= i + 1 ? '✓' : String(i + 1)));
      passo.append(elemento('p', '', nome));
      tracker.append(passo);
    }
    card.append(tracker);
    card.append(elemento('p', 'ux-order-status-note',
      'Andamento demonstrativo salvo neste navegador; ainda não sincronizado com o banco.'));
    card.append(criarDetalhes(pedido));

    if (pedido.avaliacao) {
      const avaliacao = elemento('div', 'avaliacao-feita');
      const nota = Math.max(0,Math.min(5,Number(pedido.avaliacao.nota)||0));
      avaliacao.append(elemento('div', 'estrelas-display', '★'.repeat(nota) + '☆'.repeat(5 - nota)));
      if (pedido.avaliacao.comentario) avaliacao.append(elemento('p', '', pedido.avaliacao.comentario));
      card.append(avaliacao);
    } else if (String(pedido.status || '').toLowerCase() === 'entregue') {
      const botao = elemento('button', 'btn-avaliar ux-order-review', '⭐ Avaliar Pedido');
      botao.type='button';
      botao.addEventListener('click', () => window.abrirAvaliacaoPedido?.(pedido.id));
      card.append(botao);
    } else {
      card.append(elemento('p', 'ux-order-review-pending', 'Avaliação disponível após a entrega.'));
    }
    return card;
  }

  function iniciar() {
    if (typeof renderizarHistoricoPedidos !== 'function' ||
        typeof processarSucessoPedido !== 'function' ||
        typeof historicoPedidos === 'undefined' ||
        typeof salvarEstadoLocal !== 'function') {
      console.warn('UX pedidos: funções originais não encontradas; atualização não aplicada.');
      return;
    }

    const sucessoOriginal = processarSucessoPedido;
    const avaliarOriginal = typeof abrirAvaliacaoPedido === 'function' ? abrirAvaliacaoPedido : null;

    window.renderizarHistoricoPedidos = function () {
      const container = document.getElementById('lista-historico-pedidos');
      if (!container) return;
      container.replaceChildren();
      if (!Array.isArray(historicoPedidos) || !historicoPedidos.length) {
        container.append(elemento('p', 'ux-order-empty', 'Você ainda não fez nenhum pedido.'));
        return;
      }
      for (const pedido of [...historicoPedidos].reverse()) container.append(criarCard(pedido));
    };

    window.processarSucessoPedido = function (pedidoId) {
      // Captura ANTES que a função antiga limpe o carrinho.
      const itens = agruparCarrinho(Array.isArray(carrinho) ? carrinho : []);
      const tamanhoAnterior = historicoPedidos.length;
      const resultado = sucessoOriginal.call(this, pedidoId);
      if (historicoPedidos.length > tamanhoAnterior) {
        const novoPedido = historicoPedidos[historicoPedidos.length - 1];
        novoPedido.itens = itens;
        // O backend atualmente cria o pedido como Pendente.
        // Nunca apresentar 'Preparando' automaticamente como estado real.
        novoPedido.status = 'Pendente';
        salvarEstadoLocal();
        renderizarHistoricoPedidos();
      }
      return resultado;
    };

    if (avaliarOriginal) {
      window.abrirAvaliacaoPedido = function (pedidoId) {
        const pedido = historicoPedidos.find(p => String(p.id) === String(pedidoId));
        if (!pedido || String(pedido.status).toLowerCase() !== 'entregue') {
          if (typeof mostrarToast === 'function') mostrarToast('Avaliação disponível após a entrega.', true);
          return;
        }
        return avaliarOriginal.call(this, pedidoId);
      };
    }

    window.renderizarHistoricoPedidos();
    console.info('UX pedidos: detalhamento do histórico carregado.');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
