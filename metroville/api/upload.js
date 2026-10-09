import crypto from "node:crypto";
import { put } from '@vercel/blob';
import { requireAdmin } from '../lib/auth.js';
import { query } from '../lib/db.js';
export const config = { api: { bodyParser: false } };
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido.'});
  if (!(await requireAdmin(req,res))) return;
  const election = await query('SELECT voting_open,announced_at FROM election_state WHERE id=1');
  if(election.rows[0]?.voting_open||election.rows[0]?.announced_at)return res.status(423).json({error:'Não é possível carregar fotografias durante a votação ou após o anúncio.'});
  const type = String(req.headers['content-type'] || '').split(';')[0].trim();
  const extensions = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  if (!extensions[type]) return res.status(415).json({error:'Apenas JPG, PNG ou WEBP.'});
  const size = Number(req.headers['content-length'] || 0);
  if (!size || size > 4 * 1024 * 1024) return res.status(413).json({error:'Fotografia obrigatória até 4 MB.'});
  try {
    const name = `candidates/${crypto.randomUUID()}.${extensions[type]}`;
    const blob = await put(name, req, {access:'public', contentType:type, addRandomSuffix:false});
    return res.status(200).json({url:blob.url});
  } catch(e) {console.error('upload:',e); return res.status(500).json({error:'Erro ao guardar imagem no Vercel Blob.'});}
}
