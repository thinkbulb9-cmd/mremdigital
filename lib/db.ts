import 'server-only';
import { Pool } from 'pg';
let pool: Pool | undefined;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not configured');
  return (pool ||= new Pool({connectionString:process.env.DATABASE_URL, max:8}));
}
