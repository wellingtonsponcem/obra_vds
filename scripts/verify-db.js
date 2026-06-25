import pg from 'pg';
const { Client } = pg;

async function run() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    console.error("ERRO: DATABASE_URL ou POSTGRES_URL é obrigatória como variável de ambiente.");
    process.exit(1);
  }

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
  console.log("Conectado ao banco para verificação.");

  try {
    const projectCount = await client.query("SELECT COUNT(*) FROM project");
    const catalogCount = await client.query("SELECT COUNT(*) FROM catalog_item");
    const purchaseCount = await client.query("SELECT COUNT(*) FROM purchase");
    const purchaseItemCount = await client.query("SELECT COUNT(*) FROM purchase_item");
    const paymentCount = await client.query("SELECT COUNT(*) FROM payment");
    const cardCount = await client.query("SELECT COUNT(*) FROM card");
    const installmentCount = await client.query("SELECT COUNT(*) FROM installment_plan");

    console.log("\n==========================================");
    console.log("ESTADO ATUAL DO BANCO DE DADOS:");
    console.log("==========================================");
    console.log(`Projetos (project):                 ${projectCount.rows[0].count}`);
    console.log(`Itens de Catálogo (catalog_item):   ${catalogCount.rows[0].count} (esperado: 105)`);
    console.log(`Compras (purchase):                 ${purchaseCount.rows[0].count} (esperado: 3)`);
    console.log(`Itens Comprados (purchase_item):    ${purchaseItemCount.rows[0].count} (esperado: 19)`);
    console.log(`Pagamentos (payment):               ${paymentCount.rows[0].count} (esperado: 6)`);
    console.log(`Cartões (card):                     ${cardCount.rows[0].count}`);
    console.log(`Parcelas (installment_plan):        ${installmentCount.rows[0].count}`);
    console.log("==========================================\n");

  } catch (err) {
    console.error("Erro durante a verificação:", err);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
