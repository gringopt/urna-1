import {
  requireAdmin,
} from "../../lib/auth.js";

import { query } from "../../lib/db.js";

export default async function handler(req, res) {
  try {
    const admin =
      requireAdmin(req, res);

    if (!admin) return;

    if (req.method !== "DELETE") {
      return res.status(405).json({
        error: "Método não permitido.",
      });
    }

    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        error:
          "ID do candidato obrigatório.",
      });
    }

    const result = await query(
      `
      UPDATE candidates
      SET active = FALSE
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error:
          "Candidato não encontrado.",
      });
    }

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Erro interno.",
    });
  }
}