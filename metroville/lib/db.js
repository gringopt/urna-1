import pg from 'pg';
const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL em falta. Configura PostgreSQL no Vercel.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
let initPromise;
export async function initDatabase() {
  if (!initPromise) {
    initPromise = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS users (discord_id VARCHAR(32) PRIMARY KEY, username TEXT NOT NULL, avatar TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
      await pool.query(`CREATE TABLE IF NOT EXISTS candidates (id SERIAL PRIMARY KEY, name TEXT NOT NULL, number VARCHAR(10) NOT NULL, office VARCHAR(30) NOT NULL, photo_url TEXT, active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(number,office))`);
      await pool.query(`CREATE TABLE IF NOT EXISTS votes (id SERIAL PRIMARY KEY, discord_id VARCHAR(32) NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE, candidate_id INTEGER REFERENCES candidates(id) ON DELETE SET NULL, office VARCHAR(30) NOT NULL, blank_vote BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(discord_id,office))`);
    })().catch(e => { initPromise = null; throw e; });
  }
  return initPromise;
}
export async function query(sql, params = []) { await initDatabase(); return pool.query(sql, params); }
export default pool;
