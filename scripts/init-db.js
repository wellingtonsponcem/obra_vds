import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { schemaSql } from '../api/db.js';

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL or POSTGRES_URL is required.');
}

const client = new Client(await createClientConfig(databaseUrl));
await client.connect();

try {
  await client.query(schemaSql);
  await client.query(`
    INSERT INTO project (id, nome, moeda, orcamento_materiais_total, orcamento_mao_obra_total, orcamento_total)
    VALUES ('obra_vds_001', 'Obra VDS', 'BRL', 0, 0, 0)
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log('Database schema initialized.');
} finally {
  await client.end();
}

async function createClientConfig(connectionString) {
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
