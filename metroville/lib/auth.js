
import jwt from "jsonwebtoken";
import { parse, serialize } from "cookie";

export const ADMIN_IDS = new Set([
  "1467086958147928154",
  "1468654279010029588",
]);

const ADMIN_ROLE_ID =
  process.env.DISCORD_ADMIN_ROLE_ID ||
  "1557797121577451691";

const GUILD_ID =
  process.env.DISCORD_GUILD_ID;

export function isAdmin(discordId) {
  return ADMIN_IDS.has(String(discordId));
}

// Verifica se o utilizador tem o cargo administrativo
// através da API oficial do Discord.
export async function checkAdmin(discordId) {
  if (isAdmin(discordId)) {
    return true;
  }

  if (
    !discordId ||
    !GUILD_ID ||
    !ADMIN_ROLE_ID ||
    !process.env.DISCORD_BOT_TOKEN
  ) {
    return false;
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordId}`,
      {
        headers: {
          Authorization:
            `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      console.error(
        "Erro ao verificar cargo administrativo:",
        response.status
      );

      return false;
    }

    const member = await response.json();

    return (
      Array.isArray(member.roles) &&
      member.roles.includes(ADMIN_ROLE_ID)
    );
  } catch (error) {
    console.error(
      "Falha na verificação administrativa:",
      error
    );

    return false;
  }
}

export function createSession(user) {
  return jwt.sign(
    {
      discordId: String(user.id),
      username: user.username,
      avatar: user.avatar || null,
    },
    process.env.SESSION_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

export function getSession(req) {
  try {
    const cookies = parse(req.headers.cookie || "");

    if (!cookies.metroville_session) {
      return null;
    }

    return jwt.verify(
      cookies.metroville_session,
      process.env.SESSION_SECRET
    );
  } catch {
    return null;
  }
}

export function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    serialize("metroville_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    serialize("metroville_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    })
  );
}

export function requireUser(req, res) {
  const session = getSession(req);

  if (!session) {
    res.status(401).json({
      error: "Não autenticado.",
    });

    return null;
  }

  return session;
}

// Agora é assíncrona porque consulta o Discord.
export async function requireAdmin(req, res) {
  const session = requireUser(req, res);

  if (!session) return null;

  const authorized = await checkAdmin(
    session.discordId
  );

  if (!authorized) {
    res.status(403).json({
      error: "Acesso administrativo negado.",
    });

    return null;
  }

  return session;
}
