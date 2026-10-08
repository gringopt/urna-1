import { requireAdmin } from '../../lib/auth.js';
import { query } from '../../lib/db.js';
export default async function handler(req,res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).end();
  if (!(await requireAdmin(req,res))) return;
  const id = Number(req.body?.id || req.query?.id);
  if (!Number.isSafeInteger(id) || id<=0) return res.status(400).json({error:'ID inválido.'});
  try { const result = await query('UPDATE candidates SET active=FALSE WHERE id=$1 RETURNING id',[id]); return result.rowCount ? res.status(200).json({ok:true}) : res.status(404).json({error:'Candidato não encontrado.'}); }
  catch(e) { console.error('delete candidate:',e); return res.status(500).json({error:'Erro ao remover candidato.'}); }
}
