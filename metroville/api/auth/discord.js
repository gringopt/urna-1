import crypto from "crypto";
import { serialize } from "cookie";

export default async function handler(req, res) {
  const state = crypto.randomBytes(24).toString("hex");

  res.setHeader(
    "Set-Cookie",
    serialize("discord_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    })
  );

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    scope: "identify",
    state,
  });

  res.redirect(
    `https://discord.com/oauth2/authorize?${params.toString()}`
  );
}