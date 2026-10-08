const BASE = 'https://discord.com/api/v10';
export async function discordMember(discordId) {
  const guildId = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!guildId || !token || !discordId) throw new Error('Configuração Discord incompleta');
  const response = await fetch(`${BASE}/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordId)}`, { headers: { Authorization: `Bot ${token}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Discord member lookup HTTP ${response.status}`);
  return response.json();
}
export async function discordUser(accessToken) {
  const response = await fetch(`${BASE}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Discord user HTTP ${response.status}`);
  return response.json();
}
export async function discordToken(code) {
  const params = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: process.env.DISCORD_REDIRECT_URI });
  const response = await fetch(`${BASE}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  if (!response.ok) throw new Error(`Discord token exchange HTTP ${response.status}`);
  return response.json();
}
