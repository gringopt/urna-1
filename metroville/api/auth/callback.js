import { parse, serialize } from 'cookie';
import { discordToken, discordUser } from '../../lib/discord.js';
import { createSession, setSessionCookie } from '../../lib/auth.js';
import { query } from '../../lib/db.js';
export default async function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).end();
  const cookies = parse(req.headers.cookie || '');
  const {code,state,error} = req.query;
  if (error || !code || !state || !cookies.discord_oauth_state || state !== cookies.discord_oauth_state) return res.redirect(302,'/?error=oauth_state');
  res.setHeader('Set-Cookie',serialize('discord_oauth_state','',{path:'/',httpOnly:true,maxAge:0}));
  try {
    const token = await discordToken(code);
    const user = await discordUser(token.access_token);
    await query('INSERT INTO users(discord_id,username,avatar) VALUES($1,$2,$3) ON CONFLICT(discord_id) DO UPDATE SET username=EXCLUDED.username,avatar=EXCLUDED.avatar',[user.id,user.username,user.avatar || null]);
    setSessionCookie(res,createSession(user));
    return res.redirect(302,'/');
  } catch(e) { console.error('OAuth callback:',e); return res.redirect(302,'/?error=login'); }
}
