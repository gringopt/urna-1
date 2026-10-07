import {
  getSession,
  requireAdmin,
} from "../../lib/auth.js";

import { query } from "../../lib/db.js";

const VALID_OFFICES = [
  "senator",
  "state_deputy",
  "federal_deputy",
  "governor",
  "president",
];

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const session = getSession(req);

      if (!session) {
        return res.status(401).json({
          error: "Não autenticado.",
        });
      }

      const { office } = req.query;

      if (
        office &&
        !VALID_OFFICES.includes(office)
      ) {
        return res.status(400).json({
          error: "Cargo inválido.",
        });
      }

      let result;

      if (office) {
        result = await query(
          `
          SELECT
            id,
            name,
            number,
            office,
            photo_url
          FROM candidates
          WHERE office = $1
          AND active = TRUE
          ORDER BY
            LENGTH(number),
            number
          `,
          [office]
        );
      } else {
        result = await query(`
          SELECT
            id,
            name,
            number,
            office,
            photo_url
          FROM candidates
          WHERE active = TRUE
          ORDER BY office, number
        `);
      }

      return res.status(200).json(
        result.rows
      );
    }

    if (req.method === "POST") {
      const admin =
        requireAdmin(req, res);

      if (!admin) return;

      const {
        name,
        number,
        office,
        photoUrl,
      } = req.body;

      if (
        !name ||
        !number ||
        !office
      ) {
        return res.status(400).json({
          error:
            "Nome, número e cargo são obrigatórios.",
        });
      }

      if (
        !VALID_OFFICES.includes(office)
      ) {
        return res.status(400).json({
          error: "Cargo inválido.",
        });
      }

      if (
        !/^[0-9]{1,10}$/.test(
          String(number)
        )
      ) {
        return res.status(400).json({
          error:
            "O número deve conter apenas algarismos.",
        });
      }

      const result = await query(
        `
        INSERT INTO candidates (
          name,
          number,
          office,
          photo_url
        )

        VALUES ($1, $2, $3, $4)

        RETURNING *
        `,
        [
          name.trim(),
          String(number),
          office,
          photoUrl || null,
        ]
      );

      return res.status(201).json(
        result.rows[0]
      );
    }

    return res.status(405).json({
      error: "Método não permitido.",
    });
  } catch (error) {
    console.error(error);

    if (
      error.code === "23505"
    ) {
      return res.status(409).json({
        error:
          "Já existe um candidato com esse número neste cargo.",
      });
    }

    return res.status(500).json({
      error: "Erro interno.",
    });
  }
}