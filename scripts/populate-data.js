import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
const { Client } = pg;

// Mapeamento explícito entre o item do JSON (normalizado) e o nome do item no HTML
const explicitMapping = {
  "estabilizador scorp-c-2 feiyutech s": "Estabilizador",
  "cabo flat 3 em 1 para dji mini 2/min": "Cabo Flat 3 Em 1 Para Dji",
  "kit ferramentas eletricas 5 em 1 shi": "Kit Ferramentas Elétricas 5 Em 1 Shili Tools",
  "maquina de solda inversora mig se": "Máquina De Solda Sem Gás MIG",
  "jogo 10 pecas bits philips ph2 e fe": "Jogo Bits PH2 Phillips Magnético 25-150mm Impacto",
  "chave de fenda especial para eletr": "Chave De Fenda Cruzada Com Profissional PH1 PH2",
  "trena profissional fita metrica fluor": "Fita Métrica Aço Inoxidável 5/7.5/10m",
  "esquadro combinado 12 pol 300m": "Esquadro Combinado 12 Pol 300mm 323675 Sparta",
  "mascara de solda automatica 4k a": "Máscara De Solda Automática +4 Esquadros Magnéticos 12kg",
  "modulo indicador de carga para 5s": "Módulo Indicador De Carga Para 5s 18v - 21v Para Cél 18650",
  "placa de protecao bms 5s 18v a 21": "Placa De Proteção Bms 5s 18v A 21v - 20a Com Balanceamento",
  "martelo profissional unha 450g ca": "Martelo Unha 560g, Cabeça 26mm Magnética",
  "cilindro compativel brother dcp-80": "Cilindro Compatível Brother Dcp-80...",
  "corretor postural alinhador coluna": "Corretor Postural Alinhador Coluna ...",
  "cinto multiuso p/ cameras fotogra": "Cinto Multiuso P/ Câmeras",
  "fogao cooktop inducao 1 boca pain": "Fogão Cooktop Indução",
  "kit 300 parafusos chipboard philips": "Kit 300 Parafusos Chipboard",
  "capacete infantil juvenil regulador": "Capacete Infantil Juvenil",
  "case capa porta lente neoprene a": "Case Capa Porta Lente"
};

// Normalização de strings para comparação resiliente
function normalize(str) {
  if (!str) return "";
  return str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\w\s]/g, "") // remove pontuação
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(name) {
  const norm = normalize(name).replace(/\s/g, "");
  return 'cat_' + createHash('md5').update(norm).digest('hex').substring(0, 16);
}

function parseMoney(val) {
  if (!val) return 0;
  const clean = val.replace(/R\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

function parseQuantity(val) {
  if (!val) return 0;
  const clean = val.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
}

function parsePurchaseDate(dateStr) {
  const months = {
    'janeiro': 0, 'fevereiro': 1, 'marco': 2, 'abril': 3, 'maio': 4, 'junho': 5,
    'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
  };
  const parts = dateStr.toLowerCase().split(' de ');
  if (parts.length >= 2) {
    const day = parseInt(parts[0], 10);
    const monthName = parts[1].trim();
    const month = months[monthName] ?? 5;
    return new Date(2026, month, day, 12, 0, 0, 0).toISOString();
  }
  return new Date().toISOString();
}

// Retorna o nome do item no HTML a partir da descrição do JSON
function matchJsonItemToHtml(jsonDesc) {
  const normJson = normalize(jsonDesc);
  for (const [key, value] of Object.entries(explicitMapping)) {
    const normKey = normalize(key);
    if (normJson.startsWith(normKey) || normKey.startsWith(normJson) || normJson.includes(normKey)) {
      return value;
    }
  }
  return null;
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    console.error("ERRO: DATABASE_URL ou POSTGRES_URL é obrigatória como variável de ambiente.");
    process.exit(1);
  }

  // 1. Ler e analisar HTML
  console.log("Lendo arquivo HTML...");
  const htmlPath = "./Material VDS/Lista Geral.html";
  const htmlContent = await readFile(htmlPath, "utf-8");

  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;

  const htmlItems = [];
  let trMatch;
  let isData = false;

  while ((trMatch = trRegex.exec(htmlContent)) !== null) {
    const trContent = trMatch[1];
    const cells = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      let cellText = tdMatch[1].replace(/<[^>]*>/g, '').trim();
      // Desfazer escape básico de HTML
      cellText = cellText
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
      cells.push(cellText);
    }

    if (cells.length > 10) {
      if (cells[1] === "Material" && cells[2] === "Categoria") {
        isData = true;
        continue;
      }
      if (isData && cells[1] && cells[1] !== "Material") {
        htmlItems.push({
          nome: cells[1],
          categoria: cells[2],
          quantidadePlanejada: parseQuantity(cells[3]),
          unidade: cells[4],
          precoOrcadoUnitario: parseMoney(cells[5]),
          custoOrcadoTotal: parseMoney(cells[6]),
          localCompraPlanejado: cells[7] || "Online",
          prioridade: cells[8] === "\u200b" || !cells[8] ? null : cells[8],
          statusCatalogo: cells[9] || "Pendente",
          fornecedorPlanejado: cells[10] || null
        });
      }
    }
  }

  console.log(`Sucesso: ${htmlItems.length} itens extraídos do HTML.`);

  // 2. Ler os 3 JSONs de compras
  console.log("Lendo arquivos JSON de compras...");
  const jsonFiles = ["compra 1.json", "compra 2.json", "compra 3.json"];
  const purchases = [];

  for (const file of jsonFiles) {
    const content = await readFile(file, "utf-8");
    purchases.push(JSON.parse(content));
  }

  // Configuração do Cliente Postgres
  const url = new URL(databaseUrl);
  const clientConfig = {
    connectionString: databaseUrl,
    ssl: url.protocol === 'postgres:' ? false : { rejectUnauthorized: false },
  };
  if (url.searchParams.get('sslmode') === 'require') {
    clientConfig.ssl = { rejectUnauthorized: false };
  }

  const client = new Client(clientConfig);
  await client.connect();
  console.log("Conectado ao PostgreSQL com sucesso.");

  try {
    // Inicia transação
    await client.query("BEGIN");

    // Garantir que o projeto padrão existe
    await client.query(`
      INSERT INTO project (id, nome, moeda, orcamento_materiais_total, orcamento_mao_obra_total, orcamento_total)
      VALUES ('obra_vds_001', 'Obra VDS', 'BRL', 0, 0, 0)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Inserir os catalog_items primeiro
    console.log("Inserindo itens de catálogo (catalog_item)...");
    const catalogItemMap = new Map(); // nome do HTML -> ID estável

    for (const item of htmlItems) {
      const id = stableId(item.nome);
      catalogItemMap.set(normalize(item.nome), id);

      await client.query(`
        INSERT INTO catalog_item (
          id, project_id, nome, categoria, quantidade_planejada, unidade,
          preco_orcado_unitario, custo_orcado_total, local_compra_planejado,
          prioridade, status_catalogo, fornecedor_planejado, origem_planilha
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          categoria = EXCLUDED.categoria,
          quantidade_planejada = EXCLUDED.quantidade_planejada,
          unidade = EXCLUDED.unidade,
          preco_orcado_unitario = EXCLUDED.preco_orcado_unitario,
          custo_orcado_total = EXCLUDED.custo_orcado_total,
          local_compra_planejado = EXCLUDED.local_compra_planejado,
          prioridade = EXCLUDED.prioridade,
          status_catalogo = EXCLUDED.status_catalogo,
          fornecedor_planejado = EXCLUDED.fornecedor_planejado,
          origem_planilha = EXCLUDED.origem_planilha,
          updated_at = now();
      `, [
        id,
        'obra_vds_001',
        item.nome,
        item.categoria,
        item.quantidadePlanejada,
        item.unidade,
        item.precoOrcadoUnitario,
        item.custoOrcadoTotal,
        item.localCompraPlanejado,
        item.prioridade,
        item.statusCatalogo,
        item.fornecedorPlanejado,
        'Spreadsheet HTML'
      ]);
    }

    console.log("Catalog items salvos.");

    // Inserir compras, cartões, pagamentos e itens de compra
    console.log("Inserindo compras e transações financeiras...");
    for (let idx = 0; idx < purchases.length; idx++) {
      const { detalhes_da_compra } = purchases[idx];
      const purchaseId = `cmp_json_${idx + 1}`;
      const dataCompra = parsePurchaseDate(detalhes_da_compra.data_compra);

      const subtotalCents = Math.round(detalhes_da_compra.resumo_financeiro.valor_produtos * 100);
      const freteCents = Math.round(detalhes_da_compra.resumo_financeiro.frete * 100);
      const descontoCents = Math.round(Math.abs(detalhes_da_compra.resumo_financeiro.desconto_a_vista || detalhes_da_compra.resumo_financeiro.desconto || 0) * 100);
      const totalPagoCents = Math.round(detalhes_da_compra.resumo_financeiro.valor_total * 100);

      // Inserir compra
      await client.query(`
        INSERT INTO purchase (
          id, project_id, origem, fornecedor, status_compra, status_entrega,
          subtotal_produtos, frete, desconto, total_pago, data_compra
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          origem = EXCLUDED.origem,
          fornecedor = EXCLUDED.fornecedor,
          status_compra = EXCLUDED.status_compra,
          status_entrega = EXCLUDED.status_entrega,
          subtotal_produtos = EXCLUDED.subtotal_produtos,
          frete = EXCLUDED.frete,
          desconto = EXCLUDED.desconto,
          total_pago = EXCLUDED.total_pago,
          data_compra = EXCLUDED.data_compra,
          updated_at = now();
      `, [
        purchaseId,
        'obra_vds_001',
        'Mercado Livre',
        'Mercado Livre',
        'confirmado',
        'entregue',
        subtotalCents,
        freteCents,
        descontoCents,
        totalPagoCents,
        dataCompra
      ]);

      // Inserir itens da compra
      const items = detalhes_da_compra.itens;
      for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
        const item = items[itemIdx];
        const itemId = `pit_json_${idx + 1}_${itemIdx + 1}`;
        const qty = item.quantidade;
        const priceCents = Math.round(item.preco_pago * 100);
        const totalCents = priceCents * qty;

        // Encontrar catalog_item correspondente
        const matchedHtmlName = matchJsonItemToHtml(item.descricao_item);
        let vinculoId = null;
        if (matchedHtmlName) {
          vinculoId = catalogItemMap.get(normalize(matchedHtmlName)) || null;
        }

        if (!vinculoId) {
          console.warn(`Aviso: Não foi possível vincular o item do JSON "${item.descricao_item}" a um item do catálogo.`);
        }

        await client.query(`
          INSERT INTO purchase_item (
            id, purchase_id, nome, quantidade, valor_unitario, valor_total, vinculo_catalogo_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            nome = EXCLUDED.nome,
            quantidade = EXCLUDED.quantidade,
            valor_unitario = EXCLUDED.valor_unitario,
            valor_total = EXCLUDED.valor_total,
            vinculo_catalogo_id = EXCLUDED.vinculo_catalogo_id,
            updated_at = now();
        `, [
          itemId,
          purchaseId,
          item.descricao_item,
          qty,
          priceCents,
          totalCents,
          vinculoId
        ]);
      }

      // Inserir condições de pagamento e cartões
      const conds = detalhes_da_compra.condicoes_de_pagamento || [];
      const sumCondicaoTotals = conds.reduce((sum, c) => sum + (c.valor_total_condicao || 0), 0);

      for (let condIdx = 0; condIdx < conds.length; condIdx++) {
        const cond = conds[condIdx];
        const paymentId = `pay_json_${idx + 1}_${condIdx + 1}`;
        
        let cardId = null;
        if (cond.metodo === "Cartão de Crédito" && cond.final_cartao) {
          cardId = `crd_${cond.final_cartao}`;
          // Inserir cartão
          await client.query(`
            INSERT INTO card (id, nome, final_cartao)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO NOTHING;
          `, [cardId, cond.bandeira || "Cartão", cond.final_cartao]);
        }

        const parcelas = cond.parcelas || 1;
        const valorParcelaCents = Math.round((cond.valor_parcela || cond.valor_total_condicao || 0) * 100);
        const valorTotalCondicaoCents = Math.round(cond.valor_total_condicao * 100);

        // Calcular juros reais: total condicionado menos o equivalente proporcional à vista
        // Equivalente à vista proporcional = (valor_total_condicao / sumCondicaoTotals) * subtotal_produtos
        const propFactor = sumCondicaoTotals > 0 ? (cond.valor_total_condicao / sumCondicaoTotals) : 1;
        const cashEquivCents = Math.round(propFactor * (subtotalCents + freteCents - descontoCents));
        const jurosCents = Math.max(0, valorTotalCondicaoCents - cashEquivCents);

        await client.query(`
          INSERT INTO payment (
            id, purchase_id, forma_pagamento, card_id, parcelas, valor_parcela, juros, com_juros
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            forma_pagamento = EXCLUDED.forma_pagamento,
            card_id = EXCLUDED.card_id,
            parcelas = EXCLUDED.parcelas,
            valor_parcela = EXCLUDED.valor_parcela,
            juros = EXCLUDED.juros,
            com_juros = EXCLUDED.com_juros,
            updated_at = now();
        `, [
          paymentId,
          purchaseId,
          cond.metodo || "Cartão de Crédito",
          cardId,
          parcelas,
          valorParcelaCents,
          jurosCents,
          jurosCents > 0
        ]);

        // Inserir parcelas no plano de parcelamento
        for (let p = 1; p <= parcelas; p++) {
          const installmentId = `inst_json_${idx + 1}_${condIdx + 1}_${p}`;
          // Calcular data de vencimento: adicionar p meses à data de compra
          const dueDate = new Date(dataCompra);
          dueDate.setMonth(dueDate.getMonth() + p);

          await client.query(`
            INSERT INTO installment_plan (
              id, payment_id, numero_parcela, valor, data_vencimento, pago
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
              valor = EXCLUDED.valor,
              data_vencimento = EXCLUDED.data_vencimento,
              pago = EXCLUDED.pago,
              updated_at = now();
          `, [
            installmentId,
            paymentId,
            p,
            valorParcelaCents,
            dueDate.toISOString(),
            true // Já aprovado e debitado na fatura
          ]);
        }
      }
    }

    await client.query("COMMIT");
    console.log("==========================================");
    console.log("POPULAÇÃO DE DADOS FINALIZADA COM SUCESSO!");
    console.log("==========================================");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ERRO durante a transação de população de dados:", err);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
