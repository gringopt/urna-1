
import crypto from "node:crypto";
import { serialize } from "cookie";

export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: "Configuração Discord incompleta."
    });
  }

  const state = crypto.randomBytes(24).toString("hex");

  res.setHeader(
    "Set-Cookie",
    serialize("discord_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600
    })
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state: state
  });

  return res.redirect(
    "https://discord.com/oauth2/authorize?" +
    params.toString()
  );
}
