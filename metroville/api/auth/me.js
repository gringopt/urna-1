import {
  getSession,
  isAdmin,
} from "../../lib/auth.js";

import {
  checkDiscordPermission,
} from "../../lib/discord.js";

import { query } from "../../lib/db.js";

const OFFICES = [
  "senator",
  "state_deputy",
  "federal_deputy",
  "governor",
  "president",
];

export default async function handler(req, res) {
  try {
    const session = getSession(req);

    if (!session) {
      return res.status(200).json({
        authenticated: false,
      });
    }

    const permission =
      await checkDiscordPermission(
        session.discordId
      );

    if (!permission.allowed) {
      return res.status(403).json({
        authenticated: true,
        allowed: false,
      });
    }

    const votes = await query(
      `
      SELECT office
      FROM votes
      WHERE discord_id = $1
      `,
      [session.discordId]
    );

    const completedOffices =
      votes.rows.map((vote) => vote.office);

    const finished = OFFICES.every(
      (office) =>
        completedOffices.includes(office)
    );

    return res.status(200).json({
      authenticated: true,
      allowed: true,

      user: {
        id: session.discordId,
        username: session.username,
        avatar: session.avatar,
      },

      admin: isAdmin(
        session.discordId
      ),

      completedOffices,

      finished,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Erro interno.",
    });
  }
}