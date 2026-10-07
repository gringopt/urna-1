import {
  put,
} from "@vercel/blob";

import {
  requireAdmin,
} from "../lib/auth.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  try {
    const admin =
      requireAdmin(req, res);

    if (!admin) return;

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Método não permitido.",
      });
    }

    const filename =
      req.query.filename;

    if (!filename) {
      return res.status(400).json({
        error:
          "Nome do ficheiro obrigatório.",
      });
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    const contentType =
      req.headers["content-type"];

    if (
      !allowedTypes.includes(
        contentType
      )
    ) {
      return res.status(400).json({
        error:
          "Utiliza uma imagem JPG, PNG ou WEBP.",
      });
    }

    const blob = await put(
      `candidates/${Date.now()}-${filename}`,
      req,
      {
        access: "public",
        contentType,
        addRandomSuffix: true,
      }
    );

    return res.status(200).json({
      url: blob.url,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        "Não foi possível enviar a fotografia.",
    });
  }
}