import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import formidable from 'formidable';
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
  normalizeString,
  calcularSimilaridade,
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
    let path = [];
    if (Array.isArray(rawPath)) {
      path = rawPath;
    } else if (typeof rawPath === 'string') {
      path = rawPath.split('/').filter(Boolean);
    }

    if (path.length === 0 || path[0] === 'health') {
      return jsonResponse(res, 200, {
        ok: true,
        project: 'obra_vds',
        database: process.env.DATABASE_URL || process.env.POSTGRES_URL ? 'configured' : 'missing',
      });
    }

    if (path[0] === 'catalog') {
      return await handleCatalog(req, res, path.slice(1));
    }

    if (path[0] === 'purchase') {
      return await handlePurchase(req, res, path.slice(1));
    }

    if (path[0] === 'config') {
      return await handleConfig(req, res, path.slice(1));
    }

    if (path[0] === 'ocr' && path[1] === 'parse') {
      return await handleOcrParse(req, res);
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

async function handleOcrParse(req, res) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { message: 'Método não permitido, use POST.' });
  let base64 = null;
  let mimeType = null;
  let originalName = null;
  let fileSize = 0;
  const contentType = req.headers['content-type'] || '';
  try {
    if (contentType.includes('application/json')) {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
      base64 = body.imageBase64 || body.base64 || body.image;
      mimeType = body.mimeType || body.mimetype || 'image/jpeg';
      originalName = body.filename || body.nome || 'mobile.jpg';
      fileSize = body.tamanhoBytes || 0;
      if (!base64) return jsonResponse(res, 400, { message: 'imageBase64 é obrigatório.' });
      if (String(base64).includes(',')) base64 = String(base64).split(',')[1];
    } else {
      const form = formidable({ multiples: false, maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
      const [fields, files] = await new Promise((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve([fields, files]);
        });
      });
      if (fields && (fields.imageBase64 || fields.base64)) {
        const v = Array.isArray(fields.imageBase64) ? fields.imageBase64[0] : fields.imageBase64 || fields.base64;
        base64 = v;
        mimeType = Array.isArray(fields.mimeType) ? fields.mimeType[0] : fields.mimeType || 'image/jpeg';
        originalName = 'mobile.jpg';
        if (base64 && base64.includes(',')) base64 = String(base64).split(',')[1];
      } else {
        let file = files.file || files.image || files.photo || files.upload;
        if (Array.isArray(file)) file = file[0];
        if (!file) return jsonResponse(res, 400, { message: 'Arquivo file é obrigatório (multipart file).' });
        mimeType = file.mimetype || file.mimeType || 'image/jpeg';
        originalName = file.originalFilename || file.newFilename || 'upload.jpg';
        fileSize = file.size || 0;
        const buffer = await fs.readFile(file.filepath);
        base64 = buffer.toString('base64');
        await fs.unlink(file.filepath).catch(() => {});
      }
    }
    if (!mimeType || !String(mimeType).startsWith('image/')) {
      return jsonResponse(res, 400, { message: 'Apenas imagens são aceitas.' });
    }
  } catch (e) {
    return jsonResponse(res, 400, { message: 'Falha ao processar upload: ' + (e.message || String(e)) });
  }

  const jobId = `job_${randomUUID()}`;
  try {
    await query(`INSERT INTO ocr_job (id, status, imagem_url) VALUES ($1, $2, $3)`, [jobId, 'processando', `data:${mimeType};base64,${base64.substring(0, 60)}...`]);
    await query(`INSERT INTO attachment (id, ocr_job_id, nome, url, tipo_mime, tamanho_bytes) VALUES ($1, $2, $3, $4, $5, $6)`, [`anx_${randomUUID()}`, jobId, originalName, `data:${mimeType};base64,...`, mimeType, fileSize]);
  } catch {}

  try {
    const prompt = buildPromptOcr();
    let parsed;
    let provider = 'groq';
    const groqKey = await getGroqApiKeyVercel();
    if (groqKey) {
      try {
        parsed = await callGroqVisionVercel(base64, mimeType, prompt, groqKey);
      } catch (groqErr) {
        const geminiKey = await getGeminiApiKeyVercel();
        if (!geminiKey) throw groqErr;
        parsed = await callGeminiVisionVercel(base64, mimeType, prompt, geminiKey);
        provider = 'gemini';
      }
    } else {
      const geminiKey = await getGeminiApiKeyVercel();
      if (!geminiKey) return jsonResponse(res, 503, { message: 'Nenhuma chave OCR configurada (GROQ_API_KEY ou GEMINI_API_KEY).' });
      parsed = await callGeminiVisionVercel(base64, mimeType, prompt, geminiKey);
      provider = 'gemini';
    }
    const jsonResult = normalizeOcrDataVercel(parsed);
    const validation = validatePurchaseEvidenceVercel(jsonResult);
    if (!validation.ok) {
      await query(`UPDATE ocr_job SET status = $1, json_bruto = $2, updated_at = now() WHERE id = $3`, ['erro', JSON.stringify({ ...jsonResult, erro: validation.message }), jobId]).catch(()=>{});
      return jsonResponse(res, 422, { message: validation.message, data: jsonResult });
    }
    const itensComVinculo = await linkCatalogItemsVercel(jsonResult.itens || []);
    jsonResult.itens = itensComVinculo;
    jsonResult.alertas = [...(jsonResult.alertas || []), ...validation.alertas];
    await query(`UPDATE ocr_job SET status = $1, json_bruto = $2, updated_at = now() WHERE id = $3`, ['sucesso', JSON.stringify(jsonResult), jobId]).catch(()=>{});
    await query(`INSERT INTO audit_log (id, usuario, acao, detalhes) VALUES ($1, $2, $3, $4)`, [`aud_${randomUUID()}`, 'sistema', 'OCR_PROCESSAR', JSON.stringify({ jobId, arquivo: originalName, fornecedor: jsonResult.fornecedor, total: jsonResult.resumo.total, provider })]).catch(()=>{});
    return jsonResponse(res, 200, { jobId, status: 'sucesso', data: jsonResult, provider, attachment: { nome: originalName, tipoMime: mimeType, tamanhoBytes: fileSize } });
  } catch (error) {
    await query(`UPDATE ocr_job SET status = $1, json_bruto = $2, updated_at = now() WHERE id = $3`, ['erro', JSON.stringify({ erro: error.message || String(error) }), jobId]).catch(()=>{});
    return sendError(res, error);
  }
}

async function getGroqApiKeyVercel() {
  try {
    const r = await query(`SELECT value FROM system_config WHERE key = $1`, ['groq_api_key']);
    if (r.rowCount > 0 && r.rows[0].value) return String(r.rows[0].value).trim();
  } catch {}
  return String(process.env.GROQ_API_KEY || '').trim();
}
async function getGeminiApiKeyVercel() {
  try {
    const r = await query(`SELECT value FROM system_config WHERE key = $1`, ['gemini_api_key']);
    if (r.rowCount > 0 && r.rows[0].value) return String(r.rows[0].value).trim();
  } catch {}
  return String(process.env.GEMINI_API_KEY || '').trim();
}
async function callGroqVisionVercel(base64, mimeType, prompt, apiKey) {
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen/qwen3.6-27b',
      temperature: 0,
      max_tokens: 400,
      // @ts-ignore Groq reasoning_format hidden para não retornar <think>
      reasoning_format: 'hidden',
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }],
    }),
  });
  if (res.status === 429) {
    const t = await res.text().catch(() => '');
    throw Object.assign(new Error(`Limite Groq atingido (429): ${t.substring(0, 300)} — Aguarde 60s ou faça upgrade em https://console.groq.com/settings/billing. Tente com imagem menor/comprimida.`), { status: 429 });
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw Object.assign(new Error(`Groq Vision falhou: ${res.status} ${t.substring(0, 400)}`), { status: 502 });
  }
  const j = await res.json();
  const rawContent = j.choices?.[0]?.message?.content || j.choices?.[0]?.message?.reasoning || '{}';
  let content = String(rawContent).replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/?think[^>]*>/gi, '').trim();
  content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  if (!content.trim().startsWith('{')) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) content = m[0];
    else {
      const rawM = String(rawContent).match(/\{[\s\S]*\}/);
      if (rawM) content = rawM[0].replace(/<think>[\s\S]*$/gi, '').trim();
    }
  }
  try {
    return JSON.parse(content);
  } catch (e) {
    const m = String(rawContent).match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch {}
      // Tenta limpar think dentro do JSON extraído
      const cleaned = m[0].replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/?think[^>]*>/gi, '').trim();
      return JSON.parse(cleaned);
    }
    throw e;
  }
}
async function callGeminiVisionVercel(base64, mimeType, prompt, apiKey) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
    config: { responseMimeType: 'application/json' },
  });
  return JSON.parse(response.text || '{}');
}
function buildPromptOcr() {
  return `
Você é um extrator de qualquer comprovante de compra (farmácia, mercado, obra, Mercado Livre, loja física, cupom fiscal, NF-e).
RETORNE APENAS JSON VÁLIDO. NÃO use tags <think>, NÃO use markdown, NÃO adicione explicação fora do JSON.
Analise a imagem e extraia somente informações visíveis. Não invente dados.
Se a imagem for farmácia/drogaria com total e itens (ex: Dipirona, Pague Menos), considere is_compra=true mesmo não sendo material de obra.
A imagem pode estar rotacionada 90°/180°, de lado, invertida ou com perspectiva e sombra — tente ler mesmo assim. Procure cabeçalhos como "Documento Auxiliar", "DROGARIAS PACHECO", "CNPJ", "Valor Pago", "PIX", "QR Code", "Tributos Aprox." e itens no formato "QTD x VALOR".
Se a imagem não parecer um comprovante, nota, boleto, checkout, pedido, recibo ou confirmação de compra, retorne:
{
  "is_compra": false,
  "motivo_recusa": "Imagem não parece ser uma compra ou comprovante.",
  "texto_bruto": "",
  "alertas": ["Imagem rejeitada: sem evidência de compra."]
}
Se for compra, retorne JSON válido com esta estrutura:
{
  "is_compra": true,
  "fornecedor": "",
  "tipo_documento": "",
  "comprador": { "nome": "", "cpf": "" },
  "entrega": { "endereco": "", "descricao": "", "previsoes": [] },
  "pagamento": {
    "metodo": "pix|cartao_credito|cartao_debito|boleto|dinheiro|transferencia",
    "cartao": "",
    "final_cartao": "",
    "parcelas": null,
    "valor_parcela": null,
    "juros": null,
    "sem_juros": null,
    "texto_pagamento_bruto": ""
  },
  "resumo": {
    "quantidade_itens": null,
    "valor_produtos": null,
    "desconto": null,
    "frete": null,
    "subtotal": null,
    "total": null,
    "economia": null
  },
  "itens": [
    { "nome": "", "quantidade": null, "valor_unitario": null, "valor_total": null }
  ],
  "observacoes": [],
  "texto_bruto": "",
  "confianca": { "fornecedor": 0, "pagamento": 0, "total": 0, "itens": 0 },
  "alertas": []
}
Regras:
- Valores monetários decimais em BRL, ponto decimal. Ex: 123.45.
- Se houver ambiguidade, use null e registre em alertas.
- Se houver mais de uma opção de parcelamento, não escolha uma; registre em alertas.
- Só preencha fornecedor, total e itens se houver evidência clara.
`;
}
function normalizeOcrDataVercel(data) {
  const pagamentoMetodo = normalizePaymentMethodVercel(data.pagamento?.metodo || data.pagamento?.formaPagamento || '');
  const itens = Array.isArray(data.itens) ? data.itens : [];
  const previsoes = Array.isArray(data.entrega?.previsoes) ? data.entrega.previsoes : [];
  const alertas = Array.isArray(data.alertas) ? data.alertas : [];
  const observacoes = Array.isArray(data.observacoes) ? data.observacoes : [];
  return {
    is_compra: data.is_compra === true,
    motivo_recusa: cleanTextVercel(data.motivo_recusa || ''),
    fornecedor: cleanTextVercel(data.fornecedor),
    tipo_documento: cleanTextVercel(data.tipo_documento),
    comprador: { nome: cleanTextVercel(data.comprador?.nome), cpf: cleanTextVercel(data.comprador?.cpf) },
    entrega: { endereco: cleanTextVercel(data.entrega?.endereco), descricao: cleanTextVercel(data.entrega?.descricao), previsoes: previsoes.map((p) => ({ codigoEnvio: p.codigoEnvio || p.codigo_envio || null, status: cleanTextVercel(p.status), prazo: cleanTextVercel(p.prazo || p.descricao) })) },
    pagamento: { metodo: pagamentoMetodo, cartao: cleanTextVercel(data.pagamento?.cartao), final_cartao: cleanTextVercel(data.pagamento?.final_cartao || data.pagamento?.finalCartao), parcelas: toNullableNumberVercel(data.pagamento?.parcelas), valor_parcela: toNullableDecimalVercel(data.pagamento?.valor_parcela ?? data.pagamento?.valorParcela), juros: toNullableDecimalVercel(data.pagamento?.juros), sem_juros: toNullableBooleanVercel(data.pagamento?.sem_juros ?? data.pagamento?.semJuros), texto_pagamento_bruto: cleanTextVercel(data.pagamento?.texto_pagamento_bruto || data.pagamento?.textoPagamentoBruto) },
    resumo: { quantidade_itens: toNullableNumberVercel(data.resumo?.quantidade_itens ?? data.resumo?.quantidadeItens ?? itens.length), valor_produtos: toNullableDecimalVercel(data.resumo?.valor_produtos ?? data.resumo?.valorProdutos), desconto: toNullableDecimalVercel(data.resumo?.desconto) || 0, frete: toNullableDecimalVercel(data.resumo?.frete) || 0, subtotal: toNullableDecimalVercel(data.resumo?.subtotal), total: toNullableDecimalVercel(data.resumo?.total), economia: toNullableDecimalVercel(data.resumo?.economia) || 0 },
    itens: itens.map((item) => ({ nome: cleanTextVercel(item.nome), quantidade: toNullableNumberVercel(item.quantidade) || 1, valor_unitario: toNullableDecimalVercel(item.valor_unitario ?? item.valorUnitario), valor_total: toNullableDecimalVercel(item.valor_total ?? item.valorTotal) })),
    observacoes, texto_bruto: cleanTextVercel(data.texto_bruto || data.textoBruto), confianca: { fornecedor: toConfidenceVercel(data.confianca?.fornecedor), pagamento: toConfidenceVercel(data.confianca?.pagamento), total: toConfidenceVercel(data.confianca?.total), itens: toConfidenceVercel(data.confianca?.itens) }, alertas,
  };
}
function validatePurchaseEvidenceVercel(data) {
  const alertas = [];
  const hasFornecedor = !!data.fornecedor;
  const hasTotal = typeof data.resumo?.total === 'number';
  const hasItems = Array.isArray(data.itens) && data.itens.length > 0;
  if (data.is_compra === false) {
    if (hasFornecedor || hasTotal || hasItems) {
      alertas.push(data.motivo_recusa ? `Aviso: ${data.motivo_recusa} — aceito para teste pois tem dados.` : 'Aviso: is_compra=false mas tem dados; aceito como avulso.');
    } else {
      return { ok: false, message: data.motivo_recusa || 'Imagem não parece ser uma compra.', alertas };
    }
  }
  if (!hasFornecedor && !hasTotal && !hasItems) return { ok: false, message: 'Não foi possível identificar fornecedor, total ou itens.', alertas: ['Imagem rejeitada: sem evidência de compra.'] };
  if (!hasFornecedor) alertas.push('Fornecedor não identificado com clareza. Revise antes de salvar.');
  if (!hasTotal) alertas.push('Valor total não identificado com clareza. Revise antes de salvar.');
  if (!hasItems) alertas.push('Nenhum item individual identificado. Pode salvar como item avulso se total estiver correto.');
  if (data.pagamento?.parcelas === null && data.pagamento?.texto_pagamento_bruto?.includes('|')) alertas.push('Ambiguidade no parcelamento detectada. Revise antes de salvar.');
  return { ok: true, message: '', alertas };
}
async function linkCatalogItemsVercel(itens) {
  const catalogo = await query(`SELECT id, nome FROM catalog_item WHERE project_id = $1`, [PROJECT_ID]).then(r=>r.rows).catch(()=>[]);
  return itens.map((item) => {
    let melhorMatchId = null;
    let maiorSimilaridade = 0;
    for (const cat of catalogo) {
      const sim = calcularSimilaridade(item.nome || '', cat.nome);
      if (sim > maiorSimilaridade) { maiorSimilaridade = sim; melhorMatchId = cat.id; }
    }
    // Threshold 0.60 para nomes que mudam; 0.35 muito permissivo, 0.60 equilibra. Se produto mudou nome mas mantém substring, cairá em 0.5 boost e passa.
    return { ...item, vinculoCatalogoId: maiorSimilaridade > 0.60 ? melhorMatchId : null, similaridade: maiorSimilaridade };
  });
}
function cleanTextVercel(v) { if (v === null || v === undefined) return ''; return String(v).trim(); }
function toNullableNumberVercel(v) { if (v === null || v === undefined || v === '') return null; const p = Number(v); return Number.isFinite(p) ? p : null; }
function toNullableDecimalVercel(v) { if (v === null || v === undefined || v === '') return null; const raw = String(v).replace(/[^\d,-]/g, ''); const norm = raw.includes(',') && !raw.includes('.') ? raw.replace(',', '.') : raw.replace(/,/g, ''); const p = Number(norm); return Number.isFinite(p) ? p : null; }
function toNullableBooleanVercel(v) { if (typeof v === 'boolean') return v; if (v === null || v === undefined || v === '') return null; return ['true','sim','s','1'].includes(String(v).toLowerCase()); }
function toConfidenceVercel(v) { const p = toNullableNumberVercel(v); if (p === null) return 0; return Math.max(0, Math.min(1, p > 1 ? p/100 : p)); }
function normalizePaymentMethodVercel(value) {
  const normalized = cleanTextVercel(value).toLowerCase();
  if (['pix','boleto','dinheiro','transferencia','cartao_debito','cartao_credito'].includes(normalized)) return normalized;
  if (normalized.includes('crédito') || normalized.includes('credito') || normalized.includes('credit card') || normalized.includes('cartão')) return 'cartao_credito';
  if (normalized.includes('débito') || normalized.includes('debito') || normalized.includes('debit card')) return 'cartao_debito';
  return 'pix';
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
