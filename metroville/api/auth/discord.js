import crypto from 'node:crypto';
import { serialize } from 'cookie';
export default function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_REDIRECT_URI) return res.status(500).json({error:'Configuração OAuth incompleta'});
  const state = crypto.randomBytes(24).toString('hex');
  res.setHeader('Set-Cookie', serialize('discord_oauth_state', state, {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:600}));
  const params = new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,response_type:'code',redirect_uri:process.env.DISCORD_REDIRECT_URI,scope:'identify',state});
  return res.redirect(302, `https://discord.com/oauth2/authorize?${params}`);
}
