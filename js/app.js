const state = {
  view: 'dashboard',
  perfil: 'admin',
  summary: emptySummary(),
  catalog: [],
  purchases: [],
  cards: [],
  suggestions: { fornecedores: [], cartoes: [] },
  loading: false,
  purchaseViewMode: 'compra', // 'compra' ou 'item'
};

const els = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
  Object.assign(els, {
    pageTitle: document.getElementById('pageTitle'),
    toast: document.getElementById('toast'),
    syncButton: document.getElementById('syncButton'),
    exportJsonButton: document.getElementById('exportJsonButton'),
    dashboardView: document.getElementById('dashboardView'),
    catalogoView: document.getElementById('catalogoView'),
    comprasView: document.getElementById('comprasView'),
    configuracoesView: document.getElementById('configuracoesView'),
  });

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view;
      render();
    });
  });

  els.syncButton.addEventListener('click', () => loadAll());
  els.exportJsonButton.addEventListener('click', exportJson);

  // Usar delegação de eventos para controle de perfil (suporta selects dinâmicos no mobile)
  document.addEventListener('change', (event) => {
    const select = event.target.closest('.perfil-select-control');
    if (select) {
      state.perfil = select.value;
      document.querySelectorAll('.perfil-select-control').forEach(s => s.value = state.perfil);
      showToast(`Perfil alterado para ${state.perfil === 'admin' ? 'Administrador' : 'Financiador'}.`, 'info');
      render();
    }
  });

  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);

  loadAll();
}

async function loadAll() {
  state.loading = true;
  render();

  try {
    const [summary, catalog, purchases, cards, suggestions] = await Promise.all([
      api('catalog/summary'),
      api('catalog'),
      api('purchase'),
      api('config/cards'),
      api('config/suggestions'),
    ]);

    state.summary = summary;
    state.catalog = catalog;
    state.purchases = purchases;
    state.cards = cards;
    state.suggestions = suggestions;
    showToast('Dados sincronizados com o banco.', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
  const titles = {
    dashboard: 'Dashboard',
    catalogo: 'Catálogo de Materiais',
    compras: 'Compras Lançadas',
    configuracoes: 'Configurações',
  };

  els.pageTitle.textContent = titles[state.view] || 'Obra VDS';

  document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
  
  // Desativar todas as abas/botões de navegação
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.remove('active'));
  
  // Ativar todos os botões correspondentes à view atual (tanto desktop quanto mobile bottom nav)
  document.querySelectorAll(`[data-view="${state.view}"]`).forEach((button) => button.classList.add('active'));

  const activeView = els[`${state.view}View`];
  if (activeView) activeView.classList.add('active');

  if (state.view === 'dashboard') renderDashboard();
  if (state.view === 'catalogo') renderCatalogo();
  if (state.view === 'compras') renderCompras();
  if (state.view === 'configuracoes') renderConfiguracoes();

  // Sincronizar valor atual de todos os controles de perfil renderizados
  document.querySelectorAll('.perfil-select-control').forEach((select) => {
    select.value = state.perfil;
  });
}

function renderDashboard() {
  const latestPurchases = state.purchases.slice(0, 6);
  const alerts = state.summary.alertasDivergencia || [];

  const { categories, totalCompradoItens } = getPurchaseSummaryByCategory();
  const svgChart = drawDonutChart(categories, totalCompradoItens);

  const colors = [
    'var(--cyan)',
    'var(--emerald)',
    'var(--amber)',
    'var(--rose)',
    'var(--blue)',
    '#a855f7',
    '#ec4899',
    '#f43f5e',
    '#10b981',
  ];

  const legendHtml = categories.map((cat, index) => {
    const color = colors[index % colors.length];
    return `
      <div class="legend-item">
        <span class="legend-label">
          <span class="legend-color" style="background-color: ${color};"></span>
          ${escapeHtml(cat.name)}
        </span>
        <span class="legend-values">
          ${formatMoney(cat.total)}
          <span class="legend-pct">${cat.percentage}%</span>
        </span>
      </div>
    `;
  }).join('') || '<div class="empty">Nenhum gasto categorizado</div>';

  els.dashboardView.innerHTML = `
    <div class="grid metrics">
      ${metricCard('Custo Orçado Total', formatMoney(state.summary.totalOrcado), `${state.summary.progressoPercentual}% comprado`, 'cyan')}
      ${metricCard('Total Comprado', formatMoney(state.summary.totalComprado), 'Compras efetivas', 'emerald')}
      ${metricCard('Economia', formatMoney(state.summary.totalEconomia), 'Abaixo do orçado', 'cyan')}
      ${metricCard('Sobrepreço', formatMoney(state.summary.totalSobrepreco), `${alerts.length} alerta${alerts.length === 1 ? '' : 's'}`, 'amber')}
    </div>

    <div class="layout">
      <div class="table-card">
        <div class="table-header">
          <h3 style="margin: 0;">Últimas compras</h3>
          <div class="view-toggle">
            <button class="toggle-btn ${state.purchaseViewMode === 'compra' ? 'active' : ''}" data-action="toggle-view-mode" data-mode="compra">Por Compra</button>
            <button class="toggle-btn ${state.purchaseViewMode === 'item' ? 'active' : ''}" data-action="toggle-view-mode" data-mode="item">Por Item</button>
          </div>
        </div>
        ${state.purchaseViewMode === 'compra'
          ? (latestPurchases.length ? renderPurchaseTable(latestPurchases, false) : empty('Nenhuma compra cadastrada.'))
          : (latestPurchases.length ? renderPurchaseItemTable(latestPurchases, false) : empty('Nenhum item cadastrado.'))
        }
      </div>

      <div class="dashboard-sidebar" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="card">
          <h3>Progresso da obra</h3>
          <div class="muted">Comprado sobre o orçamento total</div>
          <div class="progress-track" style="margin-top: 14px;">
            <div class="progress-bar" style="width: ${Math.min(100, state.summary.progressoPercentual)}%;"></div>
          </div>
          <p style="font-size: 34px; font-weight: 900; margin: 16px 0 4px;">${state.summary.progressoPercentual}%</p>
          <p class="muted">Pendente: ${formatMoney(state.summary.totalPendente)}</p>
        </div>

        <div class="card">
          <h3>Gastos por categoria</h3>
          <div class="category-chart-container">
            <div class="chart-wrapper">
              ${svgChart}
              <div class="chart-center-text">
                <span>Materiais</span>
                <strong>${formatMoney(totalCompradoItens)}</strong>
              </div>
            </div>
            <div class="chart-legend">
              ${legendHtml}
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Alertas de divergência</h3>
          ${alerts.length ? `<div class="alerts">${alerts.map((alert) => `<div class="alert"><strong>${escapeHtml(alert.nome)}</strong><br>${formatMoney(alert.diferenca)} acima do orçado</div>`).join('')}</div>` : empty('Sem divergências detectadas.')}
        </div>
      </div>
    </div>
  `;
}

function renderCatalogo() {
  const isAdmin = state.perfil === 'admin';

  els.catalogoView.innerHTML = `
    <div class="layout">
      <div class="table-card">
        <h3>Itens do catálogo</h3>
        ${renderCatalogTable()}
      </div>

      ${isAdmin ? renderCatalogForm() : ''}
    </div>
  `;
}

function renderCompras() {
  const isAdmin = state.perfil === 'admin';

  els.comprasView.innerHTML = `
    <div class="layout">
      <div class="table-card">
        <div class="table-header">
          <h3 style="margin: 0;">Histórico de compras</h3>
          <div class="view-toggle">
            <button class="toggle-btn ${state.purchaseViewMode === 'compra' ? 'active' : ''}" data-action="toggle-view-mode" data-mode="compra">Por Compra</button>
            <button class="toggle-btn ${state.purchaseViewMode === 'item' ? 'active' : ''}" data-action="toggle-view-mode" data-mode="item">Por Item</button>
          </div>
        </div>
        ${state.purchaseViewMode === 'compra'
          ? (state.purchases.length ? renderPurchaseTable(state.purchases, true) : empty('Nenhuma compra cadastrada.'))
          : (state.purchases.length ? renderPurchaseItemTable(state.purchases, true) : empty('Nenhum item cadastrado.'))
        }
      </div>

      ${isAdmin ? renderPurchaseForm() : ''}
    </div>
  `;
}

function renderConfiguracoes() {
  const isAdmin = state.perfil === 'admin';

  els.configuracoesView.innerHTML = `
    <div class="grid" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
      <div class="table-card">
        <h3>Ações e Modo</h3>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <strong style="display: block; margin-bottom: 8px; font-size: 12px; color: var(--muted); text-transform: uppercase;">Modo de Acesso</strong>
            <select class="input perfil-select-control" style="width: 100%;">
              <option value="admin" ${state.perfil === 'admin' ? 'selected' : ''}>Admin</option>
              <option value="visualizador" ${state.perfil === 'visualizador' ? 'selected' : ''}>Financiador</option>
            </select>
          </div>
          <div>
            <strong style="display: block; margin-bottom: 8px; font-size: 12px; color: var(--muted); text-transform: uppercase;">Exportar Dados</strong>
            <button class="button secondary" style="width: 100%; justify-content: center; display: flex; align-items: center;" data-action="export-json-mobile">Exportar JSON</button>
          </div>
        </div>
      </div>

      <div class="table-card">
        <h3>Cartões</h3>
        ${state.cards.length ? renderCardTable() : empty('Nenhum cartão cadastrado.')}
        ${isAdmin ? renderCardForm() : ''}
      </div>

      <div class="table-card" style="grid-column: span 2;">
        <h3>Chaves de configuração</h3>
        <form class="form" data-action="update-key">
          <input class="input" name="key" placeholder="Chave, ex: gemini_api_key" required>
          <textarea class="textarea" name="value" placeholder="Valor da chave"></textarea>
          <button class="button primary" type="submit">Salvar chave</button>
        </form>
      </div>
    </div>
  `;
}

function renderCatalogTable() {
  if (!state.catalog.length) return empty('Catálogo vazio. Adicione itens ou importe do backend legado.');

  const isAdmin = state.perfil === 'admin';

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Qtd.</th>
            <th>Orçado</th>
            <th>Pago acumulado</th>
            <th>Status</th>
            ${isAdmin ? '<th>Ações</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${state.catalog.map((item) => `
            <tr>
              <td><strong>${escapeHtml(item.nome)}</strong><br><span class="muted">${escapeHtml(item.id)}</span></td>
              <td>${escapeHtml(item.categoria)}<br><span class="muted">${escapeHtml(item.localCompraPlanejado || '')}</span></td>
              <td>${item.quantidadePlanejada} ${escapeHtml(item.unidade || '')}</td>
              <td>${formatMoney(item.custoOrcadoTotal)}</td>
              <td>${formatMoney(item.precoPagoAcumulado)}</td>
              <td>${badge(item.statusCatalogo)}</td>
              ${isAdmin ? `
                <td>
                  <div class="top-actions" style="justify-content: flex-start;">
                    <button class="icon-button" data-action="update-catalog-status" data-id="${escapeHtml(item.id)}" data-status="comprado">Comprar</button>
                    <button class="icon-button" data-action="update-catalog-status" data-id="${escapeHtml(item.id)}" data-status="recebido">Receber</button>
                    <button class="icon-button danger" data-action="delete-catalog" data-id="${escapeHtml(item.id)}">Excluir</button>
                  </div>
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPurchaseTable(purchases, withActions) {
  const isAdmin = state.perfil === 'admin';

  if (isMobile()) {
    return `
      <div class="mobile-cards-list">
        ${purchases.map((purchase) => {
          const payment = purchase.pagamentos[0] || {};
          const itemsSummary = purchase.itens.length > 0
            ? (purchase.itens.length === 1 
                ? escapeHtml(purchase.itens[0].nome)
                : `${escapeHtml(purchase.itens[0].nome)} e mais ${purchase.itens.length - 1} itens`)
            : 'Item avulso';

          return `
            <div class="mobile-purchase-card">
              <div class="mobile-card-row">
                <span class="mobile-card-supplier">${escapeHtml(purchase.fornecedor)}</span>
                <span class="mobile-card-date">${purchase.dataCompra || '-'}</span>
              </div>
              <div class="mobile-card-items">${itemsSummary}</div>
              <div class="mobile-card-row mobile-card-footer">
                <span class="mobile-card-total">${formatMoney(purchase.totalPago)}</span>
                <span class="mobile-card-meta">
                  ${escapeHtml(payment.formaPagamento || '-')}${payment.parcelas ? ` (${payment.parcelas}x)` : ''}
                </span>
                <div>${badge(purchase.statusCompra)}</div>
              </div>
              ${withActions && isAdmin ? `
                <div class="mobile-card-row" style="margin-top: 8px; justify-content: flex-end; gap: 8px;">
                  ${purchase.statusCompra === 'revisar' ? `<button class="icon-button primary" data-action="confirm-purchase" data-id="${escapeHtml(purchase.id)}">Confirmar</button>` : ''}
                  <button class="icon-button danger" data-action="delete-purchase" data-id="${escapeHtml(purchase.id)}">Excluir</button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Fornecedor</th>
            <th>Data</th>
            <th>Itens</th>
            <th>Total</th>
            <th>Pagamento</th>
            <th>Status</th>
            ${withActions && isAdmin ? '<th>Ações</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${purchases.map((purchase) => {
            const payment = purchase.pagamentos[0] || {};
            return `
              <tr>
                <td><span class="muted">${escapeHtml(purchase.id)}</span></td>
                <td><strong>${escapeHtml(purchase.fornecedor)}</strong></td>
                <td>${purchase.dataCompra || '-'}</td>
                <td>${purchase.itens.map((item) => escapeHtml(item.nome)).join('<br>') || 'Item avulso'}</td>
                <td><strong>${formatMoney(purchase.totalPago)}</strong></td>
                <td>${escapeHtml(payment.formaPagamento || '-')}<br><span class="muted">${payment.parcelas ? `${payment.parcelas}x ${formatMoney(payment.valorParcela || 0)}` : ''}</span></td>
                <td>${badge(purchase.statusCompra)}</td>
                ${withActions && isAdmin ? `
                  <td>
                    <div class="top-actions" style="justify-content: flex-start;">
                      ${purchase.statusCompra === 'revisar' ? '<button class="icon-button primary" data-action="confirm-purchase" data-id="' + escapeHtml(purchase.id) + '">Confirmar</button>' : ''}
                      <button class="icon-button danger" data-action="delete-purchase" data-id="${escapeHtml(purchase.id)}">Excluir</button>
                    </div>
                  </td>
                ` : ''}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderPurchaseItemTable(purchases, withActions) {
  const isAdmin = state.perfil === 'admin';

  // Achatando as compras para obter os itens individuais
  const flattenedItems = [];
  purchases.forEach((purchase) => {
    const payment = purchase.pagamentos[0] || {};
    purchase.itens.forEach((item) => {
      flattenedItems.push({
        ...item,
        purchaseId: purchase.id,
        fornecedor: purchase.fornecedor,
        dataCompra: purchase.dataCompra,
        statusCompra: purchase.statusCompra,
        formaPagamento: payment.formaPagamento || '-',
        parcelas: payment.parcelas,
        valorParcela: payment.valorParcela || 0,
      });
    });
  });

  if (!flattenedItems.length) return empty('Nenhum item cadastrado.');

  if (isMobile()) {
    return `
      <div class="mobile-cards-list">
        ${flattenedItems.map((item) => {
          const category = getCategoryForPurchaseItem(item);
          return `
            <div class="mobile-purchase-card">
              <div class="mobile-card-row">
                <span class="mobile-card-supplier" style="font-size: 14px;">${escapeHtml(item.nome)}</span>
                <span class="mobile-card-date">${item.dataCompra || '-'}</span>
              </div>
              <div class="mobile-card-row" style="font-size: 12px; color: var(--muted); margin-top: -4px;">
                <span>Fornecedor: <strong>${escapeHtml(item.fornecedor)}</strong></span>
                <span>Qtd: ${item.quantidade} un</span>
              </div>
              <div class="mobile-card-row mobile-card-footer">
                <span class="mobile-card-total">${formatMoney(item.valorTotal)}</span>
                <span class="mobile-card-meta">
                  Cat: <span class="badge" style="border-color: var(--border); color: var(--muted); margin-left: 2px; padding: 2px 6px;">${escapeHtml(category)}</span>
                </span>
                <div>${badge(item.statusCompra)}</div>
              </div>
              ${withActions && isAdmin ? `
                <div class="mobile-card-row" style="margin-top: 8px; justify-content: flex-end;">
                  <button class="icon-button danger" data-action="delete-purchase" data-id="${escapeHtml(item.purchaseId)}">Excluir Compra</button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Fornecedor</th>
            <th>Data</th>
            <th>Categoria</th>
            <th>Qtd.</th>
            <th>Unitário</th>
            <th>Total</th>
            <th>Pagamento</th>
            <th>Status</th>
            ${withActions && isAdmin ? '<th>Ações</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${flattenedItems.map((item) => {
            const category = getCategoryForPurchaseItem(item);
            return `
              <tr>
                <td><strong>${escapeHtml(item.nome)}</strong><br><span class="muted">${escapeHtml(item.vinculoCatalogoId || 'Sem vínculo')}</span></td>
                <td><strong>${escapeHtml(item.fornecedor)}</strong></td>
                <td>${item.dataCompra || '-'}</td>
                <td><span class="badge" style="border-color: var(--border); color: var(--muted);">${escapeHtml(category)}</span></td>
                <td>${item.quantidade} un</td>
                <td>${formatMoney(item.valorUnitario)}</td>
                <td><strong>${formatMoney(item.valorTotal)}</strong></td>
                <td>${escapeHtml(item.formaPagamento)}<br><span class="muted">${item.parcelas ? `${item.parcelas}x ${formatMoney(item.valorParcela)}` : ''}</span></td>
                <td>${badge(item.statusCompra)}</td>
                ${withActions && isAdmin ? `
                  <td>
                    <div class="top-actions" style="justify-content: flex-start;">
                      <button class="icon-button danger" data-action="delete-purchase" data-id="${escapeHtml(item.purchaseId)}">Excluir Compra</button>
                    </div>
                  </td>
                ` : ''}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}


function getCategoryForPurchaseItem(item) {
  if (item.catalogItem?.categoria) {
    return item.catalogItem.categoria;
  }
  if (item.vinculoCatalogoId) {
    const catalogItem = state.catalog.find(c => c.id === item.vinculoCatalogoId);
    if (catalogItem?.categoria) return catalogItem.categoria;
  }
  // Tentar encontrar por correspondência de nome exato
  const catalogItemByName = state.catalog.find(c => c.nome.toLowerCase() === item.nome.toLowerCase());
  if (catalogItemByName?.categoria) return catalogItemByName.categoria;

  return 'Outros';
}

function getPurchaseSummaryByCategory() {
  const categoryTotals = {};
  let totalCompradoItens = 0;

  state.purchases.forEach((purchase) => {
    if (purchase.statusCompra === 'rascunho') return;
    purchase.itens.forEach((item) => {
      const category = getCategoryForPurchaseItem(item);
      const value = item.valorTotal || 0;
      categoryTotals[category] = (categoryTotals[category] || 0) + value;
      totalCompradoItens += value;
    });
  });

  const categories = Object.entries(categoryTotals).map(([name, total]) => ({
    name,
    total,
    percentage: totalCompradoItens > 0 ? Math.round((total / totalCompradoItens) * 100) : 0,
  }));

  // Ordenar decrescente por total
  categories.sort((a, b) => b.total - a.total);

  return { categories, totalCompradoItens };
}

function drawDonutChart(categories, total) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  const colors = [
    'var(--cyan)',
    'var(--emerald)',
    'var(--amber)',
    'var(--rose)',
    'var(--blue)',
    '#a855f7', // Roxo
    '#ec4899', // Rosa
    '#f43f5e', // Rosa escuro
    '#10b981', // Verde
  ];

  if (!categories.length || total === 0) {
    return `
      <svg viewBox="0 0 140 140" width="100%" height="100%">
        <circle cx="70" cy="70" r="${radius}" fill="transparent" stroke="var(--border)" stroke-width="14" />
        <circle cx="70" cy="70" r="${radius - 7}" fill="var(--panel)" />
      </svg>
    `;
  }

  let svgHtml = `<svg viewBox="0 0 140 140" width="100%" height="100%" style="transform: rotate(-90deg);">`;

  categories.forEach((cat, index) => {
    const percent = cat.total / total;
    const strokeLength = percent * circumference;
    const strokeOffset = circumference - currentOffset;
    const color = colors[index % colors.length];

    svgHtml += `
      <circle
        cx="70"
        cy="70"
        r="${radius}"
        fill="transparent"
        stroke="${color}"
        stroke-width="14"
        stroke-dasharray="${strokeLength} ${circumference}"
        stroke-dashoffset="${strokeOffset}"
        style="transform-origin: 50% 50%;"
        class="chart-segment"
        title="${escapeHtml(cat.name)}: ${Math.round(percent * 100)}%"
      />
    `;
    currentOffset += strokeLength;
  });

  svgHtml += `
    <circle cx="70" cy="70" r="${radius - 7}" fill="var(--panel)" />
  </svg>`;

  return svgHtml;
}

function renderCardTable() {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Final</th>
            <th>Limite</th>
          </tr>
        </thead>
        <tbody>
          ${state.cards.map((card) => `
            <tr>
              <td>${escapeHtml(card.nome)}</td>
              <td>${escapeHtml(card.finalCartao)}</td>
              <td>${formatMoney(Number(card.limite || 0))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderCatalogForm() {
  return `
    <div class="form-card">
      <h3>Novo item do catálogo</h3>
      <form class="form" data-action="add-catalog">
        <input class="input" name="nome" placeholder="Nome do material" required>
        <div class="form-row">
          <input class="input" name="categoria" placeholder="Categoria" required>
          <input class="input" name="unidade" placeholder="Unidade" value="un" required>
        </div>
        <div class="form-row">
          <input class="input" name="quantidadePlanejada" type="number" min="0" step="1" placeholder="Quantidade planejada" value="1">
          <input class="input" name="precoOrcadoUnitario" placeholder="Preço unitário orçado, ex: 125.90">
        </div>
        <input class="input" name="custoOrcadoTotal" placeholder="Custo total orçado, ex: 1259.00">
        <div class="form-row">
          <select class="input" name="localCompraPlanejado">
            <option>Online</option>
            <option>Loja Física</option>
          </select>
          <select class="input" name="prioridade">
            <option value="">Sem prioridade</option>
            <option>Alta</option>
            <option>Media</option>
            <option>Baixa</option>
          </select>
        </div>
        <select class="input" name="statusCatalogo">
          <option>pendente</option>
          <option>comprado</option>
          <option>recebido</option>
          <option>divergente</option>
          <option>cancelado</option>
          <option>avulso</option>
        </select>
        <button class="button primary" type="submit">Salvar item</button>
      </form>
    </div>
  `;
}

function renderPurchaseForm() {
  return `
    <div class="form-card">
      <h3>Nova compra</h3>
      <form class="form" data-action="add-purchase">
        <div class="form-row">
          <input class="input" name="fornecedor" list="fornecedores" placeholder="Fornecedor" required>
          <input class="input" name="dataCompra" type="date" value="${new Date().toISOString().substring(0, 10)}" required>
        </div>

        <div id="purchaseItems">
          ${purchaseItemRow(0)}
        </div>
        <button class="button secondary" type="button" data-action="add-item-row">Adicionar item</button>

        <div class="form-row">
          <select class="input" name="formaPagamento">
            <option value="pix">Pix</option>
            <option value="cartao_credito">Cartão de crédito</option>
            <option value="cartao_debito">Cartão de débito</option>
            <option value="boleto">Boleto</option>
            <option value="dinheiro">Dinheiro</option>
          </select>
          <select class="input" name="cardId">
            <option value="">Sem cartão</option>
            ${state.cards.map((card) => `<option value="${escapeHtml(card.id)}">${escapeHtml(card.nome)} **** ${escapeHtml(card.finalCartao)}</option>`).join('')}
          </select>
        </div>

        <div class="form-row">
          <input class="input" name="parcelas" type="number" min="1" step="1" value="1" placeholder="Parcelas">
          <input class="input" name="valorParcela" placeholder="Valor da parcela, ex: 125.90">
        </div>

        <div class="form-row">
          <input class="input" name="subtotalProdutos" placeholder="Subtotal produtos, ex: 1259.00">
          <input class="input" name="totalPago" placeholder="Total pago, ex: 1309.00">
        </div>

        <div class="form-row">
          <input class="input" name="frete" placeholder="Frete, ex: 50.00">
          <input class="input" name="desconto" placeholder="Desconto, ex: 20.00">
        </div>

        <div class="form-row">
          <select class="input" name="statusCompra">
            <option value="confirmado">Confirmado</option>
            <option value="revisar">Revisar</option>
            <option value="rascunho">Rascunho</option>
          </select>
          <select class="input" name="statusEntrega">
            <option value="aguardando_entrega">Aguardando entrega</option>
            <option value="entregue">Entregue</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        <input class="input" name="prazoEntrega" placeholder="Prazo de entrega">
        <textarea class="textarea" name="observacao" placeholder="Observação"></textarea>
        <button class="button primary" type="submit">Salvar compra</button>
      </form>

      <datalist id="fornecedores">
        ${(state.suggestions.fornecedores || []).map((fornecedor) => `<option value="${escapeHtml(fornecedor)}"></option>`).join('')}
      </datalist>
    </div>
  `;
}

function renderCardForm() {
  return `
    <form class="form" data-action="add-card" style="margin-top: 16px;">
      <input class="input" name="nome" placeholder="Nome do cartão" required>
      <input class="input" name="finalCartao" placeholder="Final do cartão" maxlength="4" required>
      <input class="input" name="limite" placeholder="Limite, ex: 5000.00">
      <button class="button primary" type="submit">Salvar cartão</button>
    </form>
  `;
}

async function handleClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;

  if (action === 'toggle-view-mode') {
    state.purchaseViewMode = button.dataset.mode;
    render();
    return;
  }

  if (action === 'export-json-mobile') {
    exportJson();
    return;
  }

  if (action === 'add-item-row') {
    const container = document.getElementById('purchaseItems');
    const index = container.querySelectorAll('[data-purchase-item]').length;
    container.insertAdjacentHTML('beforeend', purchaseItemRow(index));
    return;
  }

  if (action === 'remove-item-row') {
    button.closest('[data-purchase-item]')?.remove();
    return;
  }

  if (action === 'delete-catalog') {
    if (!confirm('Excluir este item do catálogo?')) return;
    await api(`catalog/${button.dataset.id}`, { method: 'DELETE' });
    await loadAll();
    return;
  }

  if (action === 'delete-purchase') {
    if (!confirm('Excluir esta compra?')) return;
    await api(`purchase/${button.dataset.id}`, { method: 'DELETE' });
    await loadAll();
    return;
  }

  if (action === 'update-catalog-status') {
    await api(`catalog/${button.dataset.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ statusCatalogo: button.dataset.status }),
    });
    await loadAll();
    return;
  }

  if (action === 'confirm-purchase') {
    await api(`purchase/${button.dataset.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ statusCompra: 'confirmado' }),
    });
    await loadAll();
  }
}

async function handleSubmit(event) {
  const form = event.target.closest('form');
  if (!form) return;

  event.preventDefault();
  const action = form.dataset.action;

  try {
    if (action === 'filter-catalog') {
      state.catalog = await api(`catalog?${new URLSearchParams(new FormData(form)).toString()}`);
      render();
      return;
    }

    if (action === 'add-catalog') {
      const data = readForm(form);
      const precoUnitario = toCents(data.precoOrcadoUnitario);
      const quantidade = Number(data.quantidadePlanejada || 0);
      const custoTotal = data.custoOrcadoTotal ? toCents(data.custoOrcadoTotal) : quantidade * precoUnitario;

      await api('catalog', {
        method: 'POST',
        body: JSON.stringify({
          nome: data.nome,
          categoria: data.categoria,
          quantidadePlanejada: quantidade,
          unidade: data.unidade || 'un',
          precoOrcadoUnitario: precoUnitario,
          custoOrcadoTotal: custoTotal,
          localCompraPlanejado: data.localCompraPlanejado,
          prioridade: data.prioridade || null,
          statusCatalogo: data.statusCatalogo,
        }),
      });

      form.reset();
      await loadAll();
      state.view = 'catalogo';
      render();
      return;
    }

    if (action === 'add-purchase') {
      const data = readForm(form);
      const itens = [...form.querySelectorAll('[data-purchase-item]')].map((row) => {
        const item = readForm(row);
        const quantidade = Number(item.quantidade || 0);
        const valorUnitario = toCents(item.valorUnitario);
        return {
          nome: item.nome,
          quantidade,
          valorUnitario,
          valorTotal: quantidade * valorUnitario,
          vinculoCatalogoId: item.vinculoCatalogoId || null,
        };
      });

      const subtotal = data.subtotalProdutos ? toCents(data.subtotalProdutos) : itens.reduce((sum, item) => sum + item.valorTotal, 0);
      const frete = toCents(data.frete);
      const desconto = toCents(data.desconto);
      const totalPago = data.totalPago ? toCents(data.totalPago) : subtotal + frete - desconto;

      await api('purchase', {
        method: 'POST',
        body: JSON.stringify({
          fornecedor: data.fornecedor,
          dataCompra: data.dataCompra,
          itens,
          pagamentos: [{
            formaPagamento: data.formaPagamento,
            cardId: data.cardId || null,
            parcelas: Number(data.parcelas || 1),
            valorParcela: toCents(data.valorParcela),
            comJuros: data.formaPagamento === 'cartao_credito',
          }],
          entregas: data.prazoEntrega ? [{
            status: data.statusEntrega,
            prazo: data.prazoEntrega,
          }] : [],
          subtotalProdutos: subtotal,
          frete,
          desconto,
          totalPago,
          observacao: data.observacao || '',
          statusCompra: data.statusCompra,
          statusEntrega: data.statusEntrega,
        }),
      });

      form.reset();
      document.getElementById('purchaseItems').innerHTML = purchaseItemRow(0);
      await loadAll();
      state.view = 'compras';
      render();
      return;
    }

    if (action === 'add-card') {
      const data = readForm(form);
      await api('config/cards', {
        method: 'POST',
        body: JSON.stringify({
          nome: data.nome,
          finalCartao: data.finalCartao,
          limite: toCents(data.limite),
        }),
      });

      form.reset();
      await loadAll();
      return;
    }

    if (action === 'update-key') {
      const data = readForm(form);
      await api('config/keys', {
        method: 'POST',
        body: JSON.stringify({ key: data.key, value: data.value }),
      });

      form.reset();
      showToast('Chave salva.', 'success');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-usuario': state.perfil,
    ...(options.headers || {}),
  };

  const response = await fetch(`/api/${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Erro ${response.status} ao chamar /api/${path}.`);
  }

  return data;
}

function purchaseItemRow(index) {
  return `
    <div class="item-row" data-purchase-item>
      <input class="input" name="nome" placeholder="Item" required>
      <input class="input" name="quantidade" type="number" min="1" step="1" value="1" placeholder="Qtd">
      <input class="input" name="valorUnitario" placeholder="Unitário">
      <input class="input" name="vinculoCatalogoId" list="catalogIds" placeholder="ID catálogo opcional">
      <button class="icon-button danger" type="button" data-action="remove-item-row">X</button>
    </div>
    <datalist id="catalogIds">
      ${state.catalog.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.nome)}</option>`).join('')}
    </datalist>
  `;
}

function readForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function metricCard(label, value, detail, tone) {
  const color = {
    cyan: 'var(--cyan)',
    emerald: 'var(--emerald)',
    amber: 'var(--amber)',
    rose: 'var(--rose)',
  }[tone] || 'var(--cyan)';

  return `
    <div class="metric" style="border-color: ${color}55;">
      <span>${escapeHtml(label)}</span>
      <strong style="color: ${color};">${value}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function badge(status) {
  const normalized = String(status || '');
  const tone = normalized.includes('diverg') || normalized.includes('cancel') ? 'danger' : normalized.includes('confirm') || normalized.includes('receb') || normalized.includes('compr') ? 'ok' : 'warn';
  return `<span class="badge ${tone}">${escapeHtml(normalized)}</span>`;
}

function isMobile() {
  return window.innerWidth <= 768;
}

let lastIsMobileState = isMobile();
window.addEventListener('resize', () => {
  const currentIsMobileState = isMobile();
  if (currentIsMobileState !== lastIsMobileState) {
    lastIsMobileState = currentIsMobileState;
    render();
  }
});

function empty(message) {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((Number(value) || 0) / 100);
}

function toCents(value) {
  if (!value) return 0;
  const normalized = String(value).replace(/[^\d,-]/g, '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function emptySummary() {
  return {
    totalOrcado: 0,
    totalComprado: 0,
    totalPendente: 0,
    totalRecebido: 0,
    totalComJuros: 0,
    totalEconomia: 0,
    totalSobrepreco: 0,
    progressoPercentual: 0,
    alertasDivergencia: [],
  };
}

function showToast(message, type = 'info') {
  const color = type === 'success' ? 'var(--emerald)' : type === 'error' ? 'var(--rose)' : 'var(--cyan)';
  els.toast.style.borderColor = `${color}88`;
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 4200);
}

function exportJson() {
  const blob = new Blob([JSON.stringify({
    summary: state.summary,
    catalog: state.catalog,
    purchases: state.purchases,
  }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `obra_vds_${new Date().toISOString().substring(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast('JSON exportado.', 'success');
}
