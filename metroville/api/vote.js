import {
  requireUser,
} from "../lib/auth.js";

import {
  checkDiscordPermission,
} from "../lib/discord.js";

import { query } from "../lib/db.js";

const OFFICES = [
  "senator",
  "state_deputy",
  "federal_deputy",
  "governor",
  "president",
];

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Método não permitido.",
      });
    }

    const session =
      requireUser(req, res);

    if (!session) return;

    const permission =
      await checkDiscordPermission(
        session.discordId
      );

    if (!permission.allowed) {
      return res.status(403).json({
        error:
          "Já não tens autorização para votar.",
      });
    }

    const {
      office,
      candidateId,
      blank,
    } = req.body;

    if (!OFFICES.includes(office)) {
      return res.status(400).json({
        error: "Cargo inválido.",
      });
    }

    const existing = await query(
      `
      SELECT id
      FROM votes
      WHERE discord_id = $1
      AND office = $2
      `,
      [
        session.discordId,
        office,
      ]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error:
          "Já votaste neste cargo.",
      });
    }

    if (blank === true) {
      await query(
        `
        INSERT INTO votes (
          discord_id,
          office,
          blank_vote
        )

        VALUES ($1, $2, TRUE)
        `,
        [
          session.discordId,
          office,
        ]
      );

      return res.status(201).json({
        success: true,
        blank: true,
      });
    }

    if (!candidateId) {
      return res.status(400).json({
        error:
          "Seleciona um candidato.",
      });
    }

    const candidate = await query(
      `
      SELECT id
      FROM candidates
      WHERE id = $1
      AND office = $2
      AND active = TRUE
      `,
      [
        candidateId,
        office,
      ]
    );

    if (!candidate.rows.length) {
      return res.status(400).json({
        error:
          "Candidato inválido para este cargo.",
      });
    }

    await query(
      `
      INSERT INTO votes (
        discord_id,
        candidate_id,
        office,
        blank_vote
      )

      VALUES ($1, $2, $3, FALSE)
      `,
      [
        session.discordId,
        candidateId,
        office,
      ]
    );

    return res.status(201).json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.status(409).json({
        error:
          "Já existe um voto teu para este cargo.",
      });
    }

    return res.status(500).json({
      error:
        "Não foi possível registar o voto.",
    });
  }
}