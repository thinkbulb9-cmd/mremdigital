import fs from 'node:fs/promises';
import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local');
const client = new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try { await client.query(await fs.readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8'));
 await client.query(await fs.readFile(new URL('../sql/staff-mapping.sql', import.meta.url), 'utf8'));
 await client.query(await fs.readFile(new URL('../sql/campus-catalog.sql', import.meta.url), 'utf8'));
 console.log('Base and staff mapping schemas initialized successfully'); }
finally { await client.end(); }
