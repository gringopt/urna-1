import jwt from "jsonwebtoken";
import { parse, serialize } from "cookie";

export const ADMIN_IDS = new Set([
  "1467086958147928154",
  "1468654279010029588",
]);

export function isAdmin(discordId) {
  return ADMIN_IDS.has(String(discordId));
}

export function createSession(user) {
  return jwt.sign(
    {
      discordId: user.id,
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

export function requireAdmin(req, res) {
  const session = requireUser(req, res);

  if (!session) return null;

  if (!isAdmin(session.discordId)) {
    res.status(403).json({
      error: "Acesso administrativo negado.",
    });

    return null;
  }

  return session;
}