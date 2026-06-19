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
