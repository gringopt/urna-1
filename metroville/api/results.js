import { requireAdmin } from '../lib/auth.js';
import { query } from '../lib/db.js';
export default async function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!(await requireAdmin(req,res))) return;
  try {
    const [counts,blank,total] = await Promise.all([
      query('SELECT v.office,v.candidate_id,c.name,c.number,COUNT(*)::int AS votes FROM votes v LEFT JOIN candidates c ON c.id=v.candidate_id WHERE v.blank_vote=FALSE GROUP BY v.office,v.candidate_id,c.name,c.number ORDER BY v.office,votes DESC'),
      query('SELECT office,COUNT(*)::int AS votes FROM votes WHERE blank_vote=TRUE GROUP BY office'),
      query('SELECT office,COUNT(*)::int AS votes FROM votes GROUP BY office')
    ]);
    const completed = await query('SELECT COUNT(*)::int AS total FROM (SELECT discord_id FROM votes GROUP BY discord_id HAVING COUNT(DISTINCT office)=5) x');
    return res.status(200).json({results:counts.rows,blankVotes:blank.rows,totals:total.rows,completedVoters:completed.rows[0].total});
  } catch(e) { console.error('results:',e); return res.status(500).json({error:'Erro ao consultar resultados.'}); }
}
