import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('DATABASE_URL no seed:', process.env.DATABASE_URL);
  console.log('Iniciando o seed...');

  // Limpando o banco antes de popular
  await prisma.systemConfig.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.deliveryForecast.deleteMany({});
  await prisma.installmentPlan.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.purchaseItem.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.card.deleteMany({});
  await prisma.catalogItem.deleteMany({});
  await prisma.project.deleteMany({});

  // 1. Criar a Obra (Project)
  const project = await prisma.project.create({
    data: {
      id: 'obra_vds_001',
      nome: 'Obra VDS',
      moeda: 'BRL',
      orcamentoMateriaisTotal: 1475382, // R$ 14.753,82
      orcamentoMaoObraTotal: 0,
      orcamentoTotal: 1475382,
    },
  });
  console.log(`Projeto criado: ${project.nome}`);

  // 2. Criar itens do catálogo (CatalogItems)
  const catalogMaterials = [
    {
      id: 'mat_0001',
      nome: 'Assento Sanitário Max Tigre Cinza',
      categoria: 'Acabamento',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 3590, // R$ 35,90
      custoOrcadoTotal: 3590,
      localCompraPlanejado: 'Online',
      prioridade: null,
      statusCatalogo: 'pendente',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Lista Geral',
    },
    {
      id: 'mat_0002',
      nome: 'Estabilizador',
      categoria: 'Diversos',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 164721, // R$ 1647,21
      custoOrcadoTotal: 164721,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Lista Geral',
    },
    {
      id: 'mat_0003',
      nome: 'Cabo Flat 3 Em 1 Para Dji',
      categoria: 'Diversos',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 8226, // R$ 82,26
      custoOrcadoTotal: 8226,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Lista Geral',
    },
    {
      id: 'mat_0004',
      nome: 'Kit Ferramentas Elétricas 5 Em 1 Shili Tools',
      categoria: 'Ferramentas',
      quantidadePlanejada: 1,
      unidade: 'Kit',
      precoOrcadoUnitario: 161550, // R$ 1615,50
      custoOrcadoTotal: 161550,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Material online',
    },
    {
      id: 'mat_0005',
      nome: 'Máscara De Solda Automática +4 Esquadros Magnéticos 12kg',
      categoria: 'Ferramentas',
      quantidadePlanejada: 1,
      unidade: 'kit',
      precoOrcadoUnitario: 16535, // R$ 165,35
      custoOrcadoTotal: 16535,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Material online',
    },
    {
      id: 'mat_0006',
      nome: 'Módulo Indicador De Carga Para 5s 18v - 21v Para Cél 18650',
      categoria: 'Ferramentas',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 1877, // R$ 18,77
      custoOrcadoTotal: 1877,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Material online',
    },
    {
      id: 'mat_0007',
      nome: 'Placa De Proteção Bms 5s 18v A 21v - 20a Com Balanceamento',
      categoria: 'Ferramentas',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 2182, // R$ 21,82
      custoOrcadoTotal: 2182,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Material online',
    },
    {
      id: 'mat_0008',
      nome: 'Porta Veneziana de Giro 1 Folha Alumínio Pintado Preto 2,10x0,80m Lado Esquerdo Linha Slim Líder',
      categoria: 'Acabamento',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 57192, // R$ 571,92
      custoOrcadoTotal: 57192,
      localCompraPlanejado: 'Loja Física',
      prioridade: null,
      statusCatalogo: 'pendente',
      fornecedorPlanejado: 'Leroy',
      origemPlanilha: 'Loja Física',
    },
    // Itens faltantes extraídos de compras-print/ (pedidos 2000013652145111 e 2000013676528193) — filtrados obra/ferramenta + Fogão como Diversos
    {
      id: 'mat_0009',
      nome: 'Jogo 10 Peças Bits Philips Ph2 E Fenda',
      categoria: 'Ferramentas',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 2737,
      custoOrcadoTotal: 2737,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Mercado Livre - compras-print',
    },
    {
      id: 'mat_0010',
      nome: 'Trena Profissional Fita Métrica Fluor 5m',
      categoria: 'Ferramentas',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 2502,
      custoOrcadoTotal: 2502,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Mercado Livre - compras-print',
    },
    {
      id: 'mat_0011',
      nome: 'Martelo Profissional Unha 450g Cabo Fibra',
      categoria: 'Ferramentas',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 5570,
      custoOrcadoTotal: 5570,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Mercado Livre - compras-print',
    },
    {
      id: 'mat_0012',
      nome: 'Chave De Fenda Especial Para Eletrônica',
      categoria: 'Ferramentas',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 2103,
      custoOrcadoTotal: 2103,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Mercado Livre - compras-print',
    },
    {
      id: 'mat_0013',
      nome: 'Máquina De Solda Inversora Mig Sem Gás Verde',
      categoria: 'Ferramentas',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 36999,
      custoOrcadoTotal: 36999,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Mercado Livre - compras-print',
    },
    {
      id: 'mat_0014',
      nome: 'Fogão Cooktop Indução 1 Boca Painel Preto 127V',
      categoria: 'Diversos',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 11990,
      custoOrcadoTotal: 11990,
      localCompraPlanejado: 'Online',
      prioridade: null,
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Mercado Livre - compras-print',
    },
    {
      id: 'mat_0015',
      nome: 'Esquadro Combinado 12 Pol 300mm',
      categoria: 'Ferramentas',
      quantidadePlanejada: 1,
      unidade: 'un',
      precoOrcadoUnitario: 4290,
      custoOrcadoTotal: 4290,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Mercado Livre - compras-print',
    },
    {
      id: 'mat_0016',
      nome: 'Kit 300 Parafusos Chipboard Philips',
      categoria: 'Material',
      quantidadePlanejada: 1,
      unidade: 'kit',
      precoOrcadoUnitario: 2803,
      custoOrcadoTotal: 2803,
      localCompraPlanejado: 'Online',
      prioridade: 'Alta',
      statusCatalogo: 'comprado',
      fornecedorPlanejado: 'ML',
      origemPlanilha: 'Mercado Livre - compras-print',
    },
  ];

  for (const item of catalogMaterials) {
    await prisma.catalogItem.create({
      data: {
        ...item,
        projectId: project.id,
      },
    });
  }
  console.log(`${catalogMaterials.length} itens de catálogo importados.`);

  // 3. Criar Cartão de Crédito
  const card = await prisma.card.create({
    data: {
      nome: 'Santander',
      finalCartao: '8685',
    },
  });
  console.log(`Cartão criado: ${card.nome} **** ${card.finalCartao}`);

  // 4. Criar Compra exemplo (cmp_0001)
  const purchase = await prisma.purchase.create({
    data: {
      id: 'cmp_0001',
      projectId: project.id,
      origem: 'ocr_checkout',
      fornecedor: 'Mercado Livre',
      statusCompra: 'revisar', // Precisa revisar parcelamento devido à ambiguidade
      statusEntrega: 'aguardando_entrega',
      compradorNome: 'Wellington da Silva Faustino Poncem',
      compradorCpf: '154.626.737-95',
      enderecoEntrega: 'Rua Pedro Carlos De Souza 222',
      subtotalProdutos: 319934, // R$ 3.199,34
      frete: 2099, // R$ 20,99
      desconto: 92376, // R$ 923,76 (desconto_produtos)
      totalPago: 355091, // R$ 3.550,91
      observacao: 'OCR encontrou duas opções de parcelamento na mesma captura',
    },
  });

  // Criar itens da compra
  const purchaseItems = [
    {
      nome: 'Módulo Indicador De Carga Para 5s 18v - 21v Para Cél 18650',
      quantidade: 1,
      valorUnitario: 1877,
      valorTotal: 1877,
      vinculoCatalogoId: 'mat_0006',
    },
    {
      nome: 'Máscara De Solda Automática 4k Auto Escurecimento Solar Din 9.13 Com Proteção Uv+4 Esquadros Magnéticos 12kg Preto Liso',
      quantidade: 1,
      valorUnitario: 16535,
      valorTotal: 16535,
      vinculoCatalogoId: 'mat_0005',
    },
    {
      nome: 'Cabo Flat 3 Em 1 Para Dji Mini 2/mini Se/mini 4k/mavic Mini',
      quantidade: 1,
      valorUnitario: 8226,
      valorTotal: 8226,
      vinculoCatalogoId: 'mat_0003',
    },
    {
      nome: 'Kit Ferramentas Elétricas 5 Em 1 Shill Tools Motor Brushless',
      quantidade: 1,
      valorUnitario: 161550,
      valorTotal: 161550,
      vinculoCatalogoId: 'mat_0004',
    },
    {
      nome: 'Estabilizador Scorp-c-2 Feiyutech Suporta Até 3,5 Kg l.a Preto',
      quantidade: 1,
      valorUnitario: 164721,
      valorTotal: 164721,
      vinculoCatalogoId: 'mat_0002',
    },
    {
      nome: 'Placa De Proteção Bms 5s 18v A 21v - 20a Com Balanceamento',
      quantidade: 1,
      valorUnitario: 2182,
      valorTotal: 2182,
      vinculoCatalogoId: 'mat_0007',
    },
  ];

  for (const item of purchaseItems) {
    await prisma.purchaseItem.create({
      data: {
        ...item,
        purchaseId: purchase.id,
      },
    });
  }
  console.log(`Itens da compra cmp_0001 inseridos.`);

  // Criar previsão de entregas
  const deliveries = [
    { codigoEnvio: 1, status: 'FULL', prazo: 'Chegará no seu endereço amanhã sábado' },
    { codigoEnvio: 2, prazo: 'Chegará no seu endereço entre segunda-feira e sábado 27/jun' },
    { codigoEnvio: 3, prazo: 'Chegará no seu endereço entre segunda-feira e quinta-feira' },
    { codigoEnvio: 4, prazo: 'Chegará no seu endereço entre quinta-feira e terça-feira 30/jun' },
    { codigoEnvio: 5, prazo: 'Chegará no seu endereço entre quarta-feira e segunda-feira 29/jun' },
  ];

  for (const delivery of deliveries) {
    await prisma.deliveryForecast.create({
      data: {
        ...delivery,
        purchaseId: purchase.id,
      },
    });
  }

  // Criar método de pagamento e parcelamento provisório (a revisar)
  const payment = await prisma.payment.create({
    data: {
      purchaseId: purchase.id,
      formaPagamento: 'cartao_credito',
      cardId: card.id,
      parcelas: 5,
      valorParcela: 68819, // R$ 688,19 (5x)
      juros: 24004, // Exemplo de cálculo de juros (5 * 688,19 = 3440,95 + frete/diferença = juros efetivos)
      comJuros: true,
    },
  });

  // 5. Criar compras faltantes de compras-print/ (rateio proporcional obra/ferramenta + Fogão Diversos, 5 não-obra descartados)
  // cmp_0002 — pedido 2000013652145111 (22 jun) — 4 itens obra mantidos de 6
  const purchase2 = await prisma.purchase.create({
    data: {
      id: 'cmp_0002',
      projectId: project.id,
      origem: 'ocr_checkout',
      fornecedor: 'Mercado Livre',
      statusCompra: 'confirmado',
      statusEntrega: 'aguardando_entrega',
      compradorNome: 'Wellington da Silva Faustino Poncem',
      compradorCpf: '154.626.737-95',
      enderecoEntrega: 'Rua Pedro Carlos De Souza 222',
      // Rateio proporcional: valor mantido 12912c de 22025c total produtos → frete 2599, desconto 4653 rateados
      subtotalProdutos: 12912, // soma dos 4 itens mantidos (2737+2502+5570+2103)
      frete: 1523, // 2599 * 12912/22025 ≈ 1523
      desconto: 2725, // (36.53+10.00)*100 * 12912/22025 ≈ 2725
      totalPago: 11710, // 12912+1523-2725 = 11710 (R$117,10) — impostos 989 descartados com itens não-obra
      observacao: 'Importado de compras-print/ pedido 2000013652145111 — 2 itens não-obra descartados (Cilindro, Corretor)',
    },
  });

  for (const item of [
    { nome: 'Jogo 10 Peças Bits Philips Ph2 E Fenda', quantidade: 1, valorUnitario: 2737, valorTotal: 2737, vinculoCatalogoId: 'mat_0009' },
    { nome: 'Trena Profissional Fita Métrica Fluor 5m', quantidade: 1, valorUnitario: 2502, valorTotal: 2502, vinculoCatalogoId: 'mat_0010' },
    { nome: 'Martelo Profissional Unha 450g Cabo Fibra', quantidade: 1, valorUnitario: 5570, valorTotal: 5570, vinculoCatalogoId: 'mat_0011' },
    { nome: 'Chave De Fenda Especial Para Eletrônica', quantidade: 1, valorUnitario: 2103, valorTotal: 2103, vinculoCatalogoId: 'mat_0012' },
  ]) {
    await prisma.purchaseItem.create({ data: { ...item, purchaseId: purchase2.id } });
  }

  for (const delivery of [
    { codigoEnvio: 1, status: 'FULL', prazo: 'Chegará entre 2-5 dias úteis (FULL)' },
    { codigoEnvio: 2, status: 'FULL', prazo: 'Chegará entre 2-5 dias úteis (FULL)' },
    { codigoEnvio: 3, status: 'FULL', prazo: 'Chegará entre 2-5 dias úteis (FULL)' },
    { codigoEnvio: 4, status: 'FULL', prazo: 'Chegará entre 3-7 dias úteis' },
  ]) {
    await prisma.deliveryForecast.create({ data: { ...delivery, purchaseId: purchase2.id } });
  }

  await prisma.payment.create({
    data: {
      purchaseId: purchase2.id,
      formaPagamento: 'cartao_credito',
      cardId: card.id,
      parcelas: 3,
      valorParcela: 3903, // 11710/3 ≈ 3903
      juros: 0,
      comJuros: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      purchaseId: purchase2.id,
      usuario: 'sistema',
      acao: 'CRIAR',
      detalhes: JSON.stringify({
        mensagem: 'Importado de compras-print/ pedido 2000013652145111 — filtrado obra/ferramenta (4/6 itens)',
        pedido: '2000013652145111',
        itensRemovidos: ['Cilindro Compatível Brother', 'Corretor Postural'],
      }),
    },
  });

  // cmp_0003 — pedido 2000013676528193 (24 jun) — 4 mantidos de 7 (3 não-obra descartados)
  const purchase3 = await prisma.purchase.create({
    data: {
      id: 'cmp_0003',
      projectId: project.id,
      origem: 'ocr_checkout',
      fornecedor: 'Mercado Livre',
      statusCompra: 'confirmado',
      statusEntrega: 'aguardando_entrega',
      compradorNome: 'Wellington da Silva Faustino Poncem',
      compradorCpf: '154.626.737-95',
      enderecoEntrega: 'Rua Pedro Carlos De Souza 222',
      subtotalProdutos: 56082, // 36999+11990+4290+2803
      frete: 0,
      desconto: 11857, // 20644 * 56082/97548 ≈ 11857
      totalPago: 44225, // 56082-11857 = 44225 (R$442,25)
      observacao: 'Importado de compras-print/ pedido 2000013676528193 — 3 itens não-obra descartados (Cinto, Capacete, Case)',
    },
  });

  for (const item of [
    { nome: 'Máquina De Solda Inversora Mig Sem Gás Verde', quantidade: 1, valorUnitario: 36999, valorTotal: 36999, vinculoCatalogoId: 'mat_0013' },
    { nome: 'Fogão Cooktop Indução 1 Boca Painel Preto 127V', quantidade: 1, valorUnitario: 11990, valorTotal: 11990, vinculoCatalogoId: 'mat_0014' },
    { nome: 'Esquadro Combinado 12 Pol 300mm', quantidade: 1, valorUnitario: 4290, valorTotal: 4290, vinculoCatalogoId: 'mat_0015' },
    { nome: 'Kit 300 Parafusos Chipboard Philips', quantidade: 1, valorUnitario: 2803, valorTotal: 2803, vinculoCatalogoId: 'mat_0016' },
  ]) {
    await prisma.purchaseItem.create({ data: { ...item, purchaseId: purchase3.id } });
  }

  for (const delivery of [
    { codigoEnvio: 1, prazo: 'Chegará entre 5-10 dias úteis' },
    { codigoEnvio: 2, status: 'FULL', prazo: 'Chegará entre 2-5 dias úteis (FULL)' },
    { codigoEnvio: 3, status: 'FULL', prazo: 'Chegará entre 2-5 dias úteis (FULL)' },
    { codigoEnvio: 4, prazo: 'Chegará entre 5-10 dias úteis' },
  ]) {
    await prisma.deliveryForecast.create({ data: { ...delivery, purchaseId: purchase3.id } });
  }

  await prisma.payment.create({
    data: {
      purchaseId: purchase3.id,
      formaPagamento: 'cartao_credito',
      cardId: card.id,
      parcelas: 4,
      valorParcela: 11056, // 44225/4 ≈ 11056
      juros: 0,
      comJuros: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      purchaseId: purchase3.id,
      usuario: 'sistema',
      acao: 'CRIAR',
      detalhes: JSON.stringify({
        mensagem: 'Importado de compras-print/ pedido 2000013676528193 — filtrado obra/ferramenta + Fogão Diversos (4/7 itens)',
        pedido: '2000013676528193',
        itensRemovidos: ['Cinto Multiuso Câmeras', 'Capacete Infantil', 'Case Lente Neoprene'],
        categoriaDiversos: 'Fogão Cooktop Indução',
      }),
    },
  });

  // Criar logs de auditoria
  await prisma.auditLog.createMany({
    data: [
      {
        purchaseId: purchase.id,
        usuario: 'sistema',
        acao: 'CRIAR',
        detalhes: JSON.stringify({
          mensagem: 'Lançamento importado automaticamente via OCR de checkout.',
          ocrOriginal: {
            cartao: 'Santander **** 8685',
            parcelamento_1: '4x R$ 27,49',
            parcelamento_2: '5x R$ 688,19',
          },
        }),
      },
    ],
  });

  // Salvar configs iniciais
  await prisma.systemConfig.createMany({
    data: [
      { key: 'gemini_api_key', value: '' },
      { key: 'storage_bucket', value: 'obra-vds-prestacao-contas' },
      { key: 'storage_endpoint', value: '' },
      { key: 'storage_access_key', value: '' },
      { key: 'storage_secret_key', value: '' },
    ],
  });

  console.log('Seed do banco de dados concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro ao executar o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
