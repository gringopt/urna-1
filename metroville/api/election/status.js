import { query } from '../../lib/db.js';
export default async function handler(req,res) {
  if(req.method !== 'GET') return res.status(405).end();
  res.setHeader('Cache-Control','no-store');
  try {
    const result=await query('SELECT round,voting_open,announced_at FROM election_state WHERE id=1');
    const state=result.rows[0];
    const pending=await query('SELECT COUNT(*)::int AS n FROM candidates WHERE active=TRUE AND signed_at IS NULL');
    return res.status(200).json({round:state.round,votingOpen:state.voting_open,announced:!!state.announced_at,pendingCount:pending.rows[0].n});
  } catch(e) { console.error('election status',e); return res.status(500).json({error:'Não foi possível consultar o estado da eleição.'}); }
}
