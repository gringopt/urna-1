import jwt from 'jsonwebtoken';
import { parse, serialize } from 'cookie';
import { discordMember } from './discord.js';
export const ADMIN_IDS = new Set((process.env.ADMIN_IDS || '1467086958147928154,1468654279010029588').split(',').map(x => x.trim()).filter(Boolean));
export const isAdmin = discordId => ADMIN_IDS.has(String(discordId));
export async function checkAdmin(discordId) {
  if (isAdmin(discordId)) return true;
  const role = process.env.DISCORD_ADMIN_ROLE_ID;
  if (!role) return false;
  try { const member = await discordMember(discordId); return !!member && Array.isArray(member.roles) && member.roles.includes(role); }
  catch (error) { console.error('Falha verificação admin:', error.message); return false; }
}
export async function checkVoter(discordId) {
  try { const member = await discordMember(discordId); return !!member && Array.isArray(member.roles) && member.roles.includes(process.env.DISCORD_VOTER_ROLE_ID); }
  catch (error) { console.error('Falha verificação eleitor:', error.message); return false; }
}
export function createSession(user) { return jwt.sign({ discordId: String(user.id), username: user.username, avatar: user.avatar || null }, process.env.SESSION_SECRET, { expiresIn: '7d' }); }
export function getSession(req) { try { const token = parse(req.headers.cookie || '').metroville_session; return token ? jwt.verify(token, process.env.SESSION_SECRET) : null; } catch { return null; } }
export function setSessionCookie(res, token) { res.setHeader('Set-Cookie', serialize('metroville_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 604800 })); }
export function clearSessionCookie(res) { res.setHeader('Set-Cookie', serialize('metroville_session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(0) })); }
export function requireUser(req,res) { const session = getSession(req); if (!session) { res.status(401).json({error:'Não autenticado.'}); return null; } return session; }
export async function requireAdmin(req,res) { const session = requireUser(req,res); if (!session) return null; if (!(await checkAdmin(session.discordId))) { res.status(403).json({error:'Acesso administrativo negado.'}); return null; } return session; }
export async function requireVoter(req,res) { const session = requireUser(req,res); if (!session) return null; if (!(await checkVoter(session.discordId))) { res.status(403).json({error:'Sem cargo de eleitor no servidor MetroVille.'}); return null; } return session; }
