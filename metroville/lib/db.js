import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

let initialized = false;

export async function initDatabase() {
  if (initialized) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      discord_id VARCHAR(32) PRIMARY KEY,
      username TEXT NOT NULL,
      avatar TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      number VARCHAR(10) NOT NULL,
      office VARCHAR(30) NOT NULL,
      photo_url TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),

      UNIQUE(number, office)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      discord_id VARCHAR(32) NOT NULL,
      candidate_id INTEGER,
      office VARCHAR(30) NOT NULL,
      blank_vote BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),

      UNIQUE(discord_id, office),

      FOREIGN KEY (discord_id)
        REFERENCES users(discord_id)
        ON DELETE CASCADE,

      FOREIGN KEY (candidate_id)
        REFERENCES candidates(id)
        ON DELETE SET NULL
    );
  `);

  initialized = true;
}

export async function query(text, params = []) {
  await initDatabase();
  return pool.query(text, params);
}

export default pool;