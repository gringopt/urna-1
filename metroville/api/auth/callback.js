import { parse, serialize } from "cookie";

import {
  createSession,
  setSessionCookie,
} from "../../lib/auth.js";

import {
  getDiscordUser,
  checkDiscordPermission,
} from "../../lib/discord.js";

import { query } from "../../lib/db.js";

export default async function handler(req, res) {
  try {
    const { code, state } = req.query;

    const cookies = parse(req.headers.cookie || "");

    if (
      !state ||
      !cookies.discord_oauth_state ||
      state !== cookies.discord_oauth_state
    ) {
      return res.redirect("/?error=invalid_state");
    }

    if (!code) {
      return res.redirect("/?error=discord_login");
    }

    const body = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
    });

    const tokenResponse = await fetch(
      "https://discord.com/api/v10/oauth2/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body,
      }
    );

    if (!tokenResponse.ok) {
      console.error(await tokenResponse.text());

      return res.redirect("/?error=token");
    }

    const tokenData = await tokenResponse.json();

    const user = await getDiscordUser(
      tokenData.access_token
    );

    const permission =
      await checkDiscordPermission(user.id);

    if (!permission.allowed) {
      if (permission.reason === "NOT_IN_GUILD") {
        return res.redirect("/?error=not_in_server");
      }

      if (permission.reason === "MISSING_ROLE") {
        return res.redirect("/?error=missing_role");
      }

      return res.redirect("/?error=permission");
    }

    await query(
      `
      INSERT INTO users (
        discord_id,
        username,
        avatar
      )

      VALUES ($1, $2, $3)

      ON CONFLICT (discord_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        avatar = EXCLUDED.avatar
      `,
      [
        user.id,
        user.username,
        user.avatar,
      ]
    );

    const session = createSession(user);

    setSessionCookie(res, session);

    res.setHeader(
      "Set-Cookie",
      [
        serialize(
          "metroville_session",
          session,
          {
            httpOnly: true,
            secure:
              process.env.NODE_ENV ===
              "production",
            sameSite: "lax",
            path: "/",
            maxAge: 604800,
          }
        ),

        serialize(
          "discord_oauth_state",
          "",
          {
            httpOnly: true,
            secure:
              process.env.NODE_ENV ===
              "production",
            sameSite: "lax",
            path: "/",
            expires: new Date(0),
          }
        ),
      ]
    );

    return res.redirect("/");
  } catch (error) {
    console.error(error);

    return res.redirect("/?error=server");
  }
}