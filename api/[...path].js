import { randomUUID } from 'node:crypto';
import {
  PROJECT_ID,
  calcularJurosEfetivos,
  calculateSummary,
  fetchCatalogItems,
  fetchPurchaseDetails,
  fetchPurchases,
  jsonResponse,
  parseJson,
  query,
  sendError,
  transaction,
} from './db.js';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '4mb',
  },
};

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    const rawPath = req.query.path || [];
    const path = Array.isArray(rawPath) ? rawPath : [rawPath].filter(Boolean);

    if (path.length === 0 || path[0] === 'health') {
      return jsonResponse(res, 200, {
        ok: true,
        project: 'obra_vds',
        database: process.env.DATABASE_URL || process.env.POSTGRES_URL ? 'configured' : 'missing',
      });
    }

    if (path[0] === 'catalog') {
      return handleCatalog(req, res, path.slice(1));
    }

    if (path[0] === 'purchase') {
      return handlePurchase(req, res, path.slice(1));
    }

    if (path[0] === 'config') {
      return handleConfig(req, res, path.slice(1));
    }

    if (path[0] === 'ocr' && path[1] === 'parse') {
      return jsonResponse(res, 501, {
        message: 'OCR ainda não está disponível nesta versão estática. Use o backend separado ou implemente uma função serverless específica.',
      });
    }

    return jsonResponse(res, 404, { message: 'Rota não encontrada.' });
  } catch (error) {
    if (error instanceof SyntaxError) {
      error.status = 400;
    }

    return sendError(res, error);
  }
}

async function handleCatalog(req, res, path) {
  if (path.length === 0) {
    if (req.method === 'GET') {
      const items = await fetchCatalogItems(req.query);
      return jsonResponse(res, 200, items);
    }

    if (req.method === 'POST') {
      const body = await parseJson(req);
      const item = await createCatalogItem(body);
      return jsonResponse(res, 201, item);
    }
  }

  if (path[0] === 'summary' && req.method === 'GET') {
    return jsonResponse(res, 200, await calculateSummary());
  }

  if (path[0]) {
    if (req.method === 'GET') {
      return jsonResponse(res, 200, await fetchCatalogItem(path[0]));
    }

    if (req.method === 'PATCH') {
      const body = await parseJson(req);
      return jsonResponse(res, 200, await updateCatalogItem(path[0], body));
    }

    if (req.method === 'DELETE') {
      await deleteCatalogItem(path[0]);
      return jsonResponse(res, 200, { deleted: true, id: path[0] });
    }
  }

  return jsonResponse(res, 405, { message: 'Método não permitido.' });
}

async function fetchCatalogItem(id) {
  const result = await query(
    `
    SELECT *
    FROM catalog_item
    WHERE id = $1 AND project_id = $2
    `,
    [id, PROJECT_ID],
  );

  if (result.rowCount === 0) {
    throw Object.assign(new Error('Item do catálogo não encontrado.'), { status: 404 });
  }

  return mapCatalogItemWithMetrics(result.rows[0]);
}

async function createCatalogItem(body) {
  const id = body.id || `cat_${randomUUID()}`;
  const result = await query(
    `
    INSERT INTO catalog_item (
      id,
      project_id,
      nome,
      categoria,
      quantidade_planejada,
      unidade,
      preco_orcado_unitario,
      custo_orcado_total,
      local_compra_planejado,
      prioridade,
      status_catalogo,
      fornecedor_planejado,
      origem_planilha
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
    `,
    [
      id,
      PROJECT_ID,
      body.nome || 'Item sem nome',
      body.categoria || 'Diversos',
      Number(body.quantidadePlanejada ?? body.quantidade_planejada ?? 0),
      body.unidade || 'un',
      Number(body.precoOrcadoUnitario ?? body.preco_orcado_unitario ?? 0),
      Number(body.custoOrcadoTotal ?? body.custo_orcado_total ?? 0),
      body.localCompraPlanejado || body.local_compra_planejado || 'Online',
      body.prioridade || null,
      body.statusCatalogo || body.status_catalogo || 'pendente',
      body.fornecedorPlanejado || body.fornecedor_planejado || null,
      body.origemPlanilha || body.origem_planilha || 'Manual',
    ],
  );

  return mapCatalogItemWithMetrics(result.rows[0]);
}

async function updateCatalogItem(id, body) {
  const allowed = {
    nome: 'nome',
    categoria: 'categoria',
    quantidadePlanejada: 'quantidade_planejada',
    quantidade_planejada: 'quantidade_planejada',
    unidade: 'unidade',
    precoOrcadoUnitario: 'preco_orcado_unitario',
    preco_orcado_unitario: 'preco_orcado_unitario',
    custoOrcadoTotal: 'custo_orcado_total',
    custo_orcado_total: 'custo_orcado_total',
    localCompraPlanejado: 'local_compra_planejado',
    local_compra_planejado: 'local_compra_planejado',
    prioridade: 'prioridade',
    statusCatalogo: 'status_catalogo',
    status_catalogo: 'status_catalogo',
    fornecedorPlanejado: 'fornecedor_planejado',
    fornecedor_planejado: 'fornecedor_planejado',
  };

  const assignments = [];
  const params = [PROJECT_ID];

  for (const [inputKey, column] of Object.entries(allowed)) {
    if (body[inputKey] !== undefined) {
      params.push(body[inputKey]);
      assignments.push(`${column} = $${params.length}`);
    }
  }

  if (assignments.length === 0) {
    throw Object.assign(new Error('Nenhum campo válido foi informado.'), { status: 400 });
  }

  params.push(id);

  const result = await query(
    `
    UPDATE catalog_item
    SET ${assignments.join(', ')}, updated_at = now()
    WHERE project_id = $1 AND id = $${params.length}
    RETURNING *
    `,
    params,
  );

  if (result.rowCount === 0) {
    throw Object.assign(new Error('Item do catálogo não encontrado.'), { status: 404 });
  }

  return mapCatalogItemWithMetrics(result.rows[0]);
}

async function deleteCatalogItem(id) {
  const result = await query(
    `
    DELETE FROM catalog_item
    WHERE project_id = $1 AND id = $2
    RETURNING id
    `,
    [PROJECT_ID, id],
  );

  if (result.rowCount === 0) {
    throw Object.assign(new Error('Item do catálogo não encontrado.'), { status: 404 });
  }
}

async function handlePurchase(req, res, path) {
  if (path.length === 0) {
    if (req.method === 'GET') {
      return jsonResponse(res, 200, await fetchPurchases(req.query));
    }

    if (req.method === 'POST') {
      const body = await parseJson(req);
      return jsonResponse(res, 201, await createPurchase(body));
    }
  }

  if (path.length === 2 && path[1] === 'status' && req.method === 'PATCH') {
    const body = await parseJson(req);
    const usuario = req.headers['x-usuario'] || 'admin';
    return jsonResponse(res, 200, await updatePurchaseStatus(path[0], body.statusCompra, usuario));
  }

  if (path[0]) {
    if (req.method === 'GET') {
      return jsonResponse(res, 200, await fetchPurchaseDetails(path[0]));
    }

    if (req.method === 'DELETE') {
      const usuario = req.headers['x-usuario'] || 'admin';
      await deletePurchase(path[0], usuario);
      return jsonResponse(res, 200, { deleted: true, id: path[0] });
    }
  }

  return jsonResponse(res, 405, { message: 'Método não permitido.' });
}

async function createPurchase(body) {
  const id = body.id || `cmp_${randomUUID()}`;
  const dataCompra = body.dataCompra || new Date().toISOString();
  const usuario = body.usuarioResponsavel || body.usuario || 'admin';
  const itens = Array.isArray(body.itens) ? body.itens : [];
  const pagamentos = Array.isArray(body.pagamentos) ? body.pagamentos : [];
  const entregas = Array.isArray(body.entregas) ? body.entregas : [];
  const anexos = Array.isArray(body.anexos) ? body.anexos : [];

  if (Number(body.totalPago || 0) < 0 || Number(body.subtotalProdutos || 0) < 0 || Number(body.frete || 0) < 0 || Number(body.desconto || 0) < 0) {
    throw Object.assign(new Error('Valores financeiros não podem ser negativos.'), { status: 400 });
  }

  await transaction(async (client) => {
    await client.query(
      `
      INSERT INTO purchase (
        id,
        project_id,
        origem,
        fornecedor,
        status_compra,
        status_entrega,
        comprador_nome,
        comprador_cpf,
        endereco_entrega,
        subtotal_produtos,
        frete,
        desconto,
        total_pago,
        data_compra,
        observacao,
        ocr_job_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `,
      [
        id,
        PROJECT_ID,
        body.origem || 'manual',
        body.fornecedor || 'Fornecedor sem nome',
        body.statusCompra || body.status_compra || 'confirmado',
        body.statusEntrega || body.status_entrega || 'aguardando_entrega',
        body.compradorNome || body.comprador_nome || null,
        body.compradorCpf || body.comprador_cpf || null,
        body.enderecoEntrega || body.endereco_entrega || null,
        Number(body.subtotalProdutos || body.subtotal_produtos || 0),
        Number(body.frete || 0),
        Number(body.desconto || 0),
        Number(body.totalPago || body.total_pago || 0),
        dataCompra,
        body.observacao || null,
        body.ocrJobId || body.ocr_job_id || null,
      ],
    );

    for (const item of itens) {
      const itemId = item.id || `pit_${randomUUID()}`;
      const vinculoCatalogoId = item.vinculoCatalogoId || item.vinculo_catalogo_id || null;

      await client.query(
        `
        INSERT INTO purchase_item (
          id,
          purchase_id,
          nome,
          quantidade,
          valor_unitario,
          valor_total,
          vinculo_catalogo_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          itemId,
          id,
          item.nome || 'Item avulso',
          Number(item.quantidade || 0),
          Number(item.valorUnitario ?? item.valor_unitario ?? 0),
          Number(item.valorTotal ?? item.valor_total ?? 0),
          vinculoCatalogoId,
        ],
      );

      if (vinculoCatalogoId) {
        await updateLinkedCatalogStatus(client, vinculoCatalogoId, id, body.statusEntrega || body.status_entrega, Number(item.valorTotal || 0));
      }
    }

    for (const payment of pagamentos) {
      const paymentId = payment.id || `pay_${randomUUID()}`;
      const parcelas = Number(payment.parcelas || 0);
      const valorParcela = Number(payment.valorParcela || payment.valor_parcela || 0);
      const juros = calcularJurosEfetivos(valorParcela, parcelas, Number(body.totalPago || 0));

      await client.query(
        `
        INSERT INTO payment (
          id,
          purchase_id,
          forma_pagamento,
          card_id,
          parcelas,
          valor_parcela,
          juros,
          com_juros
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          paymentId,
          id,
          payment.formaPagamento || payment.forma_pagamento || 'pix',
          payment.cardId || payment.card_id || null,
          parcelas || null,
          valorParcela || null,
          juros,
          Boolean(payment.comJuros ?? payment.com_juros ?? juros > 0),
        ],
      );

      if (parcelas > 0 && valorParcela > 0) {
        await createInstallmentPlans(client, paymentId, dataCompra, parcelas, valorParcela);
      }
    }

    for (const entrega of entregas) {
      await client.query(
        `
        INSERT INTO delivery_forecast (
          id,
          purchase_id,
          codigo_envio,
          status,
          prazo
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          entrega.id || `ent_${randomUUID()}`,
          id,
          entrega.codigoEnvio || entrega.codigo_envio || null,
          entrega.status || null,
          entrega.prazo || '',
        ],
      );
    }

    for (const anexo of anexos) {
      await client.query(
        `
        INSERT INTO attachment (
          id,
          purchase_id,
          nome,
          url,
          tipo_mime,
          tamanho_bytes
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          anexo.id || `anx_${randomUUID()}`,
          id,
          anexo.nome || 'Anexo',
          anexo.url || '',
          anexo.tipoMime || anexo.tipo_mime || 'application/octet-stream',
          Number(anexo.tamanhoBytes || anexo.tamanho_bytes || 0),
        ],
      );
    }

    await client.query(
      `
      INSERT INTO audit_log (id, purchase_id, usuario, acao, detalhes)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        `aud_${randomUUID()}`,
        id,
        usuario,
        'CRIAR',
        JSON.stringify({
          mensagem: `Compra criada via ${body.origem || 'manual'} por ${usuario}`,
          totalPago: Number(body.totalPago || 0),
          fornecedor: body.fornecedor,
        }),
      ],
    );
  });

  return fetchPurchaseDetails(id);
}

async function updateLinkedCatalogStatus(client, catalogItemId, purchaseId, statusEntrega, itemValorTotal) {
  const catalog = await client.query(
    `
    SELECT id, custo_orcado_total
    FROM catalog_item
    WHERE id = $1 AND project_id = $2
    `,
    [catalogItemId, PROJECT_ID],
  );

  if (catalog.rowCount === 0) return;

  const accumulated = await client.query(
    `
    SELECT COALESCE(SUM(pi.valor_total), 0) AS total_pago_acumulado
    FROM purchase_item pi
    JOIN purchase p ON p.id = pi.purchase_id
    WHERE pi.vinculo_catalogo_id = $1 AND pi.purchase_id <> $2 AND p.status_compra <> 'rascunho'
    `,
    [catalogItemId, purchaseId],
  );

  const totalPagoAcumulado = Number(accumulated.rows[0].total_pago_acumulado || 0) + Number(itemValorTotal || 0);
  const custoOrcadoTotal = Number(catalog.rows[0].custo_orcado_total || 0);
  let novoStatus = 'comprado';

  if (statusEntrega === 'entregue') {
    novoStatus = 'recebido';
  } else if (totalPagoAcumulado > custoOrcadoTotal) {
    novoStatus = 'divergente';
  }

  await client.query(
    `
    UPDATE catalog_item
    SET status_catalogo = $1, updated_at = now()
    WHERE id = $2 AND project_id = $3
    `,
    [novoStatus, catalogItemId, PROJECT_ID],
  );
}

async function createInstallmentPlans(client, paymentId, dataCompra, parcelas, valorParcela) {
  const values = [];
  const params = [];
  const initialDate = new Date(dataCompra);

  for (let i = 1; i <= parcelas; i += 1) {
    const vencimento = new Date(initialDate);
    vencimento.setMonth(vencimento.getMonth() + i);
    values.push(`($${params.length + 1}, $${params.length + 2}, $${params.length + 3}, $${params.length + 4}, $${params.length + 5})`);
    params.push(`ins_${randomUUID()}`, paymentId, i, valorParcela, vencimento.toISOString());
  }

  if (values.length === 0) return;

  await client.query(
    `
    INSERT INTO installment_plan (
      id,
      payment_id,
      numero_parcela,
      valor,
      data_vencimento
    )
    VALUES ${values.join(', ')}
    `,
    params,
  );
}

async function updatePurchaseStatus(id, statusCompra, usuario) {
  if (!statusCompra) {
    throw Object.assign(new Error('statusCompra é obrigatório.'), { status: 400 });
  }

  const previous = await fetchPurchaseDetails(id);

  await transaction(async (client) => {
    const updated = await client.query(
      `
      UPDATE purchase
      SET status_compra = $1, updated_at = now()
      WHERE id = $2 AND project_id = $3
      RETURNING id
      `,
      [statusCompra, id, PROJECT_ID],
    );

    if (updated.rowCount === 0) {
      throw Object.assign(new Error('Compra não encontrada.'), { status: 404 });
    }

    await client.query(
      `
      INSERT INTO audit_log (id, purchase_id, usuario, acao, detalhes)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        `aud_${randomUUID()}`,
        id,
        usuario,
        'EDITAR',
        JSON.stringify({
          campo: 'statusCompra',
          de: previous.statusCompra,
          para: statusCompra,
        }),
      ],
    );
  });

  return fetchPurchaseDetails(id);
}

async function deletePurchase(id, usuario) {
  const purchase = await fetchPurchaseDetails(id);

  await transaction(async (client) => {
    await client.query(
      `
      INSERT INTO audit_log (id, purchase_id, usuario, acao, detalhes)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        `aud_${randomUUID()}`,
        id,
        usuario,
        'DELETAR',
        JSON.stringify({
          mensagem: `Compra ${id} excluída por ${usuario}`,
          fornecedor: purchase.fornecedor,
          totalPago: purchase.totalPago,
        }),
      ],
    );

    for (const item of purchase.itens) {
      if (!item.vinculoCatalogoId) continue;

      const remaining = await client.query(
        `
        SELECT COALESCE(SUM(pi.valor_total), 0) AS total_pago_acumulado, COUNT(pi.id) AS total_itens
        FROM purchase_item pi
        JOIN purchase p ON p.id = pi.purchase_id
        WHERE pi.vinculo_catalogo_id = $1 AND pi.purchase_id <> $2 AND p.status_compra <> 'rascunho'
        `,
        [item.vinculoCatalogoId, id],
      );

      const novoStatus = Number(remaining.rows[0].total_itens || 0) > 0 ? 'comprado' : 'pendente';

      await client.query(
        `
        UPDATE catalog_item
        SET status_catalogo = $1, updated_at = now()
        WHERE id = $2 AND project_id = $3
        `,
        [novoStatus, item.vinculoCatalogoId, PROJECT_ID],
      );
    }

    await client.query(
      `
      DELETE FROM purchase
      WHERE id = $1 AND project_id = $2
      `,
      [id, PROJECT_ID],
    );
  });
}

async function handleConfig(req, res, path) {
  if (path[0] === 'cards') {
    if (req.method === 'GET') {
      return jsonResponse(res, 200, await getCards());
    }

    if (req.method === 'POST') {
      const body = await parseJson(req);
      return jsonResponse(res, 201, await createCard(body));
    }

    if (req.method === 'DELETE' && path[1]) {
      await deleteCard(path[1]);
      return jsonResponse(res, 200, { deleted: true, id: path[1] });
    }
  }

  if (path[0] === 'suggestions' && req.method === 'GET') {
    return jsonResponse(res, 200, await getSuggestions());
  }

  if (path[0] === 'keys') {
    if (req.method === 'GET') {
      return jsonResponse(res, 200, await getKeys());
    }

    if (req.method === 'POST') {
      const body = await parseJson(req);
      return jsonResponse(res, 200, await updateKey(body.key, body.value));
    }
  }

  return jsonResponse(res, 405, { message: 'Método não permitido.' });
}

async function getCards() {
  const result = await query(`
    SELECT *
    FROM card
    ORDER BY nome ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    nome: row.nome,
    finalCartao: row.final_cartao,
    limite: row.limite,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }));
}

async function createCard(body) {
  const id = body.id || `card_${randomUUID()}`;
  const result = await query(
    `
    INSERT INTO card (id, nome, final_cartao, limite)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [id, body.nome || 'Cartão', body.finalCartao || body.final_cartao || '', Number(body.limite || 0)],
  );

  return {
    id: result.rows[0].id,
    nome: result.rows[0].nome,
    finalCartao: result.rows[0].final_cartao,
    limite: result.rows[0].limite,
  };
}

async function deleteCard(id) {
  const result = await query(`DELETE FROM card WHERE id = $1 RETURNING id`, [id]);

  if (result.rowCount === 0) {
    throw Object.assign(new Error('Cartão não encontrado.'), { status: 404 });
  }
}

async function getSuggestions() {
  const [purchases, cards] = await Promise.all([
    query(`SELECT DISTINCT fornecedor FROM purchase WHERE project_id = $1 ORDER BY fornecedor ASC`, [PROJECT_ID]),
    getCards(),
  ]);

  return {
    fornecedores: purchases.rows.map((row) => row.fornecedor),
    cartoes: cards,
  };
}

async function getKeys() {
  const result = await query(`SELECT key, value FROM system_config ORDER BY key ASC`);

  return result.rows.map((row) => {
    if (row.key.includes('key') && row.value) {
      return {
        key: row.key,
        value: `${row.value.substring(0, 4)}...${row.value.substring(row.value.length - 4)}`,
      };
    }

    return row;
  });
}

async function updateKey(key, value) {
  if (!key || value === undefined) {
    throw Object.assign(new Error('key e value são obrigatórios.'), { status: 400 });
  }

  const result = await query(
    `
    INSERT INTO system_config (key, value)
    VALUES ($1, $2)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    RETURNING key, value
    `,
    [key, String(value)],
  );

  return result.rows[0];
}

function mapCatalogItemWithMetrics(row) {
  const metrics = calculateCatalogMetrics(row);
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
    ...metrics,
  };
}
