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
      // Substitui a restrição antiga, que também bloqueava números de candidatos eliminados.
      await pool.query(`ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_number_office_key`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS candidates_active_number_office_unique ON candidates(number,office) WHERE active=TRUE`);
      await pool.query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS discord_id VARCHAR(32)`);
      await pool.query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS signature_name TEXT`);
      await pool.query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS signature_version TEXT`);
      await pool.query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS signed_discord_id VARCHAR(32)`);
      await pool.query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS signed_round INTEGER`);
      await pool.query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS signed_consent BOOLEAN NOT NULL DEFAULT FALSE`);
      await pool.query(`CREATE TABLE IF NOT EXISTS election_state (id INTEGER PRIMARY KEY CHECK (id = 1), round INTEGER NOT NULL DEFAULT 1, announced_at TIMESTAMPTZ)`);
      await pool.query(`ALTER TABLE election_state ADD COLUMN IF NOT EXISTS voting_open BOOLEAN NOT NULL DEFAULT FALSE`);
      await pool.query(`INSERT INTO election_state(id, round, voting_open) VALUES (1,1,FALSE) ON CONFLICT(id) DO NOTHING`);
      await pool.query(`CREATE TABLE IF NOT EXISTS debate_timers (
        slot INTEGER PRIMARY KEY CHECK(slot BETWEEN 1 AND 4),
        candidate_name VARCHAR(100) NOT NULL,
        remaining_ms INTEGER NOT NULL DEFAULT 300000,
        ends_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await pool.query(`INSERT INTO debate_timers(slot,candidate_name) VALUES (1,'Candidato 1'),(2,'Candidato 2'),(3,'Candidato 3'),(4,'Candidato 4') ON CONFLICT(slot) DO NOTHING`);
      await pool.query(`CREATE TABLE IF NOT EXISTS election_history (
        id BIGSERIAL PRIMARY KEY,
        election_number INTEGER NOT NULL,
        results JSONB NOT NULL,
        announced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    })().catch(e => { initPromise = null; throw e; });
  }
  return initPromise;
}
export async function query(sql, params = []) { await initDatabase(); return pool.query(sql, params); }
export default pool;
