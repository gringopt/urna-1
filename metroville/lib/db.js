
import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL não está configurada no Vercel."
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

let initializationPromise = null;

export async function initDatabase() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
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
  })();

  try {
    await initializationPromise;
  } catch (error) {
    initializationPromise = null;
    throw error;
  }
}

export async function query(text, params = []) {
  await initDatabase();
  return pool.query(text, params);
}

export default pool;
