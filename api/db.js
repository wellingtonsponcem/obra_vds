import { Pool } from 'pg';

export const PROJECT_ID = 'obra_vds_001';

export const schemaSql = `
CREATE TABLE IF NOT EXISTS project (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  orcamento_materiais_total INTEGER NOT NULL DEFAULT 0,
  orcamento_mao_obra_total INTEGER NOT NULL DEFAULT 0,
  orcamento_total INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_item (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL DEFAULT '${PROJECT_ID}' REFERENCES project(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  quantidade_planejada INTEGER NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL,
  preco_orcado_unitario INTEGER NOT NULL DEFAULT 0,
  custo_orcado_total INTEGER NOT NULL DEFAULT 0,
  local_compra_planejado TEXT NOT NULL,
  prioridade TEXT,
  status_catalogo TEXT NOT NULL,
  fornecedor_planejado TEXT,
  origem_planilha TEXT NOT NULL DEFAULT 'Manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS card (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  final_cartao TEXT NOT NULL,
  limite INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL DEFAULT '${PROJECT_ID}' REFERENCES project(id) ON DELETE CASCADE,
  origem TEXT NOT NULL,
  fornecedor TEXT NOT NULL,
  status_compra TEXT NOT NULL,
  status_entrega TEXT NOT NULL,
  comprador_nome TEXT,
  comprador_cpf TEXT,
  endereco_entrega TEXT,
  subtotal_produtos INTEGER NOT NULL DEFAULT 0,
  frete INTEGER NOT NULL DEFAULT 0,
  desconto INTEGER NOT NULL DEFAULT 0,
  total_pago INTEGER NOT NULL DEFAULT 0,
  data_compra TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao TEXT,
  ocr_job_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_item (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchase(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  valor_unitario INTEGER,
  valor_total INTEGER,
  vinculo_catalogo_id TEXT REFERENCES catalog_item(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchase(id) ON DELETE CASCADE,
  forma_pagamento TEXT NOT NULL,
  card_id TEXT REFERENCES card(id) ON DELETE SET NULL,
  parcelas INTEGER,
  valor_parcela INTEGER,
  juros INTEGER NOT NULL DEFAULT 0,
  com_juros BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS installment_plan (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor INTEGER NOT NULL,
  data_vencimento TIMESTAMPTZ NOT NULL,
  pago BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_forecast (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchase(id) ON DELETE CASCADE,
  codigo_envio INTEGER,
  status TEXT,
  prazo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attachment (
  id TEXT PRIMARY KEY,
  purchase_id TEXT REFERENCES purchase(id) ON DELETE CASCADE,
  ocr_job_id TEXT,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo_mime TEXT NOT NULL,
  tamanho_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ocr_job (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  json_bruto TEXT,
  imagem_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'purchase_ocr_job_id_fkey'
      AND table_name = 'purchase'
  ) THEN
    ALTER TABLE purchase
    ADD CONSTRAINT purchase_ocr_job_id_fkey
    FOREIGN KEY (ocr_job_id) REFERENCES ocr_job(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  purchase_id TEXT REFERENCES purchase(id) ON DELETE CASCADE,
  usuario TEXT NOT NULL,
  acao TEXT NOT NULL,
  detalhes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_item_project ON catalog_item(project_id);
CREATE INDEX IF NOT EXISTS idx_catalog_item_status ON catalog_item(status_catalogo);
CREATE INDEX IF NOT EXISTS idx_purchase_project ON purchase(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_item_vinculo ON purchase_item(vinculo_catalogo_id);
CREATE INDEX IF NOT EXISTS idx_payment_purchase ON payment(purchase_id);
`;

let poolPromise;
let schemaReady = false;

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

export function createClientConfig(connectionString) {
  const url = new URL(connectionString);
  const config = {
    connectionString,
    ssl: url.protocol === 'postgres:' ? false : { rejectUnauthorized: false },
  };

  if (url.searchParams.get('sslmode') === 'require') {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

export async function getPool() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw Object.assign(new Error('DATABASE_URL or POSTGRES_URL is required.'), { status: 500 });
  }

  if (!poolPromise) {
    poolPromise = (async () => {
      const pool = new Pool(createClientConfig(databaseUrl));
      await pool.query('SELECT 1');
      return pool;
    })();
  }

  return poolPromise;
}

export async function ensureSchema() {
  if (schemaReady) return;

  const pool = await getPool();
  await pool.query(schemaSql);
  await pool.query(`
    INSERT INTO project (id, nome, moeda, orcamento_materiais_total, orcamento_mao_obra_total, orcamento_total)
    VALUES ($1, 'Obra VDS', 'BRL', 0, 0, 0)
    ON CONFLICT (id) DO NOTHING;
  `, [PROJECT_ID]);

  schemaReady = true;
}

export async function query(sql, params = []) {
  await ensureSchema();
  const pool = await getPool();
  return pool.query(sql, params);
}

export async function transaction(handler) {
  await ensureSchema();
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function jsonResponse(res, status, body) {
  return res.status(status).json(body);
}

export async function parseJson(req) {
  const text = await req.text();
  if (!text) return {};
  return JSON.parse(text);
}

export function sendError(res, error) {
  const status = error.status || 500;
  const isDev = process.env.NODE_ENV === 'development';

  return res.status(status).json({
    message: status >= 500 ? 'Erro interno no servidor.' : error.message || 'Requisição inválida.',
    details: isDev ? error.message : undefined,
  });
}

export function money(value = 0) {
  return Number(value || 0);
}

export function optionalDate(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function mapCatalogItem(row, metrics = {}) {
  return {
    id: row.id,
    projectId: row.project_id,
    nome: row.nome,
    categoria: row.categoria,
    quantidadePlanejada: Number(row.quantidade_planejada || 0),
    unidade: row.unidade,
    precoOrcadoUnitario: Number(row.preco_orcado_unitario || 0),
    custoOrcadoTotal: Number(row.custo_orcado_total || 0),
    localCompraPlanejado: row.local_compra_planejado,
    prioridade: row.prioridade,
    statusCatalogo: row.status_catalogo,
    fornecedorPlanejado: row.fornecedor_planejado,
    origemPlanilha: row.origem_planilha,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    precoPagoAcumulado: Number(metrics.precoPagoAcumulado || 0),
    quantidadeComprada: Number(metrics.quantidadeComprada || 0),
    saldoPendente: Number(metrics.saldoPendente || 0),
    economia: Number(metrics.economia || 0),
    sobrepreco: Number(metrics.sobrepreco || 0),
  };
}

export function calculateCatalogMetrics(item, precoPagoAcumulado = 0, quantidadeComprada = 0) {
  const custoOrcadoTotal = Number(item.custo_orcado_total || item.custoOrcadoTotal || 0);
  const pago = Number(precoPagoAcumulado || 0);
  const diff = custoOrcadoTotal - pago;

  return {
    precoPagoAcumulado: pago,
    quantidadeComprada: Number(quantidadeComprada || 0),
    saldoPendente: Math.max(0, diff),
    economia: diff > 0 ? diff : 0,
    sobrepreco: diff < 0 ? Math.abs(diff) : 0,
  };
}

export function progressPercent(comprado, orcado) {
  if (!orcado || comprado < 0) return 0;
  return Math.min(100, Math.max(0, Math.round((comprado / orcado) * 10000) / 100));
}

export async function calculateSummary() {
  const items = await fetchCatalogItems();
  const purchasesResult = await query(`
    SELECT
      p.*,
      COALESCE(SUM(pg.juros), 0) AS total_juros
    FROM purchase p
    LEFT JOIN payment pg ON pg.purchase_id = p.id
    WHERE p.project_id = $1 AND p.status_compra <> 'rascunho'
    GROUP BY p.id
    ORDER BY p.data_compra DESC
  `, [PROJECT_ID]);

  const totalOrcado = items.reduce((sum, item) => sum + item.custoOrcadoTotal, 0);
  const totalComprado = purchasesResult.rows.reduce((sum, row) => sum + Number(row.total_pago || 0), 0);
  const totalPendente = items
    .filter((item) => item.statusCatalogo === 'pendente')
    .reduce((sum, item) => sum + item.saldoPendente, 0);
  const totalRecebido = items
    .filter((item) => item.statusCatalogo === 'recebido')
    .reduce((sum, item) => sum + item.custoOrcadoTotal, 0);
  const totalComJuros = purchasesResult.rows.reduce((sum, row) => sum + Number(row.total_juros || 0), 0);
  const totalEconomia = items.reduce((sum, item) => sum + item.economia, 0);
  const totalSobrepreco = items.reduce((sum, item) => sum + item.sobrepreco, 0);

  return {
    totalOrcado,
    totalComprado,
    totalPendente,
    totalRecebido,
    totalComJuros,
    totalEconomia,
    totalSobrepreco,
    progressoPercentual: progressPercent(totalComprado, totalOrcado),
    alertasDivergencia: items
      .filter((item) => item.sobrepreco > 0)
      .map((item) => ({
        catalogItemId: item.id,
        nome: item.nome,
        orcado: item.custoOrcadoTotal,
        pago: item.precoPagoAcumulado,
        diferenca: item.sobrepreco,
      })),
  };
}

export async function fetchCatalogItems(filters = {}) {
  const where = ['ci.project_id = $1'];
  const params = [PROJECT_ID];

  if (filters.categoria) {
    where.push(`ci.categoria = $${params.length + 1}`);
    params.push(filters.categoria);
  }

  if (filters.statusCatalogo) {
    where.push(`ci.status_catalogo = $${params.length + 1}`);
    params.push(filters.statusCatalogo);
  }

  if (filters.prioridade) {
    where.push(`ci.prioridade = $${params.length + 1}`);
    params.push(filters.prioridade === 'null' ? null : filters.prioridade);
  }

  if (filters.localCompraPlanejado) {
    where.push(`ci.local_compra_planejado = $${params.length + 1}`);
    params.push(filters.localCompraPlanejado);
  }

  if (filters.search) {
    where.push(`ci.nome ILIKE $${params.length + 1}`);
    params.push(`%${filters.search}%`);
  }

  const result = await query(`
    SELECT
      ci.*,
      COALESCE(SUM(CASE WHEN p.status_compra <> 'rascunho' THEN pi.valor_total ELSE 0 END), 0) AS preco_pago_acumulado,
      COALESCE(SUM(CASE WHEN p.status_compra <> 'rascunho' THEN pi.quantidade ELSE 0 END), 0) AS quantidade_comprada
    FROM catalog_item ci
    LEFT JOIN purchase_item pi ON pi.vinculo_catalogo_id = ci.id
    LEFT JOIN purchase p ON p.id = pi.purchase_id
    WHERE ${where.join(' AND ')}
    GROUP BY ci.id
    ORDER BY ci.nome ASC
  `, params);

  return result.rows.map((row) => {
    const metrics = calculateCatalogMetrics(row, row.preco_pago_acumulado, row.quantidade_comprada);
    return mapCatalogItem(row, metrics);
  });
}

export async function fetchPurchaseDetails(id) {
  const purchaseResult = await query(`
    SELECT * FROM purchase
    WHERE id = $1 AND project_id = $2
  `, [id, PROJECT_ID]);

  if (purchaseResult.rowCount === 0) {
    throw Object.assign(new Error('Compra não encontrada.'), { status: 404 });
  }

  const [itens, pagamentos, installmentPlans, entregas, anexos, auditorias] = await Promise.all([
    query(`
      SELECT pi.*, ci.nome AS catalog_item_nome, ci.categoria AS catalog_item_categoria
      FROM purchase_item pi
      LEFT JOIN catalog_item ci ON ci.id = pi.vinculo_catalogo_id
      WHERE pi.purchase_id = $1
      ORDER BY pi.created_at ASC
    `, [id]),
    query(`
      SELECT pg.*, c.nome AS card_nome, c.final_cartao AS card_final_cartao
      FROM payment pg
      LEFT JOIN card c ON c.id = pg.card_id
      WHERE pg.purchase_id = $1
      ORDER BY pg.created_at ASC
    `, [id]),
    query(`
      SELECT * FROM installment_plan
      WHERE payment_id IN (SELECT id FROM payment WHERE purchase_id = $1)
      ORDER BY numero_parcela ASC
    `, [id]),
    query(`
      SELECT * FROM delivery_forecast
      WHERE purchase_id = $1
      ORDER BY created_at ASC
    `, [id]),
    query(`
      SELECT * FROM attachment
      WHERE purchase_id = $1
      ORDER BY created_at ASC
    `, [id]),
    query(`
      SELECT * FROM audit_log
      WHERE purchase_id = $1
      ORDER BY created_at DESC
    `, [id]),
  ]);

  return mapPurchase(purchaseResult.rows[0], {
    itens: itens.rows,
    pagamentos: pagamentos.rows,
    installmentPlans: installmentPlans.rows,
    entregas: entregas.rows,
    anexos: anexos.rows,
    auditorias: auditorias.rows,
  });
}

export async function fetchPurchases(filters = {}) {
  const where = ['p.project_id = $1'];
  const params = [PROJECT_ID];

  if (filters.fornecedor) {
    where.push(`p.fornecedor ILIKE $${params.length + 1}`);
    params.push(`%${filters.fornecedor}%`);
  }

  if (filters.statusCompra) {
    where.push(`p.status_compra = $${params.length + 1}`);
    params.push(filters.statusCompra);
  }

  const result = await query(`
    SELECT p.*
    FROM purchase p
    WHERE ${where.join(' AND ')}
    ORDER BY p.data_compra DESC
  `, params);

  const purchases = await Promise.all(result.rows.map((row) => fetchPurchaseDetails(row.id)));

  if (filters.formaPagamento) {
    return purchases.filter((purchase) =>
      purchase.pagamentos.some((payment) => payment.formaPagamento === filters.formaPagamento),
    );
  }

  if (filters.cardId) {
    return purchases.filter((purchase) =>
      purchase.pagamentos.some((payment) => payment.cardId === filters.cardId),
    );
  }

  return purchases;
}

export function mapPurchase(row, nested = {}) {
  const installmentByPayment = (nested.installmentPlans || []).reduce((acc, item) => {
    acc[item.payment_id] = acc[item.payment_id] || [];
    acc[item.payment_id].push(item);
    return acc;
  }, {});

  return {
    id: row.id,
    projectId: row.project_id,
    origem: row.origem,
    fornecedor: row.fornecedor,
    statusCompra: row.status_compra,
    statusEntrega: row.status_entrega,
    compradorNome: row.comprador_nome,
    compradorCpf: row.comprador_cpf,
    enderecoEntrega: row.endereco_entrega,
    subtotalProdutos: Number(row.subtotal_produtos || 0),
    frete: Number(row.frete || 0),
    desconto: Number(row.desconto || 0),
    totalPago: Number(row.total_pago || 0),
    dataCompra: row.data_compra ? new Date(row.data_compra).toISOString().substring(0, 10) : null,
    observacao: row.observacao,
    ocrJobId: row.ocr_job_id,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    itens: (nested.itens || []).map((item) => ({
      id: item.id,
      nome: item.nome,
      quantidade: Number(item.quantidade || 0),
      valorUnitario: Number(item.valor_unitario || 0),
      valorTotal: Number(item.valor_total || 0),
      vinculoCatalogoId: item.vinculo_catalogo_id,
      catalogItem: item.catalog_item_nome
        ? {
            id: item.vinculo_catalogo_id,
            nome: item.catalog_item_nome,
            categoria: item.catalog_item_categoria,
          }
        : null,
    })),
    pagamentos: (nested.pagamentos || []).map((payment) => ({
      id: payment.id,
      formaPagamento: payment.forma_pagamento,
      cardId: payment.card_id,
      card: payment.card_nome
        ? {
            nome: payment.card_nome,
            finalCartao: payment.card_final_cartao,
          }
        : null,
      parcelas: payment.parcelas,
      valorParcela: Number(payment.valor_parcela || 0),
      juros: Number(payment.juros || 0),
      comJuros: Boolean(payment.com_juros),
      parcelamento: (installmentByPayment[payment.id] || []).map((plan) => ({
        id: plan.id,
        numeroParcela: plan.numero_parcela,
        valor: Number(plan.valor || 0),
        dataVencimento: new Date(plan.data_vencimento).toISOString().substring(0, 10),
        pago: Boolean(plan.pago),
      })),
    })),
    entregas: (nested.entregas || []).map((entrega) => ({
      id: entrega.id,
      codigoEnvio: entrega.codigo_envio,
      status: entrega.status,
      prazo: entrega.prazo,
    })),
    anexos: (nested.anexos || []).map((anexo) => ({
      id: anexo.id,
      nome: anexo.nome,
      url: anexo.url,
      tipoMime: anexo.tipo_mime,
      tamanhoBytes: Number(anexo.tamanho_bytes || 0),
    })),
    auditorias: (nested.auditorias || []).map((audit) => ({
      id: audit.id,
      usuario: audit.usuario,
      acao: audit.acao,
      detalhes: audit.detalhes,
      createdAt: audit.created_at ? new Date(audit.created_at).toISOString() : null,
    })),
  };
}

export function normalizeString(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export function calcularSimilaridade(a, b) {
  const s1 = normalizeString(a);
  const s2 = normalizeString(b);

  if (!s1 || !s2) return 0;
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.5 + (Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length)) * 0.5;
  }

  const max = Math.max(s1.length, s2.length);
  const costs = Array.from({ length: s2.length + 1 }, (_, index) => index);

  for (let i = 1; i <= s1.length; i += 1) {
    let previous = i - 1;
    costs[0] = i;

    for (let j = 1; j <= s2.length; j += 1) {
      const current = costs[j];
      costs[j] = Math.min(
        costs[j] + 1,
        costs[j - 1] + 1,
        previous + (s1[i - 1] === s2[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }

  return Math.max(0, (max - costs[s2.length]) / max);
}

export function calcularJurosEfetivos(valorParcelaCentavos, numParcelas, valorAVistaCentavos) {
  const totalFinanciado = Number(valorParcelaCentavos || 0) * Number(numParcelas || 0);
  const total = Number(valorAVistaCentavos || 0);
  return totalFinanciado > total ? totalFinanciado - total : 0;
}
