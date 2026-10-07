import {
  requireAdmin,
} from "../lib/auth.js";

import { query } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    const admin =
      requireAdmin(req, res);

    if (!admin) return;

    if (req.method !== "GET") {
      return res.status(405).json({
        error: "Método não permitido.",
      });
    }

    const candidates = await query(`
      SELECT
        c.id,
        c.name,
        c.number,
        c.office,
        c.photo_url,
        COUNT(v.id)::INTEGER AS votes

      FROM candidates c

      LEFT JOIN votes v
        ON v.candidate_id = c.id
        AND v.blank_vote = FALSE

      GROUP BY
        c.id,
        c.name,
        c.number,
        c.office,
        c.photo_url

      ORDER BY
        c.office,
        votes DESC,
        c.number
    `);

    const blankVotes = await query(`
      SELECT
        office,
        COUNT(*)::INTEGER AS votes

      FROM votes

      WHERE blank_vote = TRUE

      GROUP BY office
    `);

    const voters = await query(`
      SELECT COUNT(DISTINCT discord_id)::INTEGER
      AS total
      FROM votes
    `);

    const finished = await query(`
      SELECT COUNT(*)::INTEGER AS total

      FROM (
        SELECT discord_id
        FROM votes
        GROUP BY discord_id
        HAVING COUNT(DISTINCT office) = 5
      ) completed
    `);

    return res.status(200).json({
      candidates:
        candidates.rows,

      blankVotes:
        blankVotes.rows,

      voters:
        voters.rows[0].total,

      completedVoters:
        finished.rows[0].total,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        "Não foi possível carregar os resultados.",
    });
  }
}