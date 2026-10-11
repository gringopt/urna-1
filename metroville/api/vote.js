import { requireVoter } from '../lib/auth.js';
import { initDatabase } from '../lib/db.js';
import pool from '../lib/db.js';
const OFFICES = ['Senador','Dep Estadual','Dep Federal','Governador','Presidente'];
export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = await requireVoter(req,res); if (!session) return;
  const {office,candidateId,blank} = req.body || {};
  if (!OFFICES.includes(office) || typeof blank !== 'boolean' || (blank ? candidateId != null : !Number.isSafeInteger(Number(candidateId)))) return res.status(400).json({error:'Voto inválido.'});
  let client;
  try {
    await initDatabase(); client = await pool.connect(); await client.query('BEGIN');
    const election = await client.query('SELECT voting_open FROM election_state WHERE id=1 FOR SHARE');
    if (!election.rows[0]?.voting_open) { await client.query('ROLLBACK'); return res.status(423).json({error:'A votação está encerrada. Aguarda pela abertura oficial.'}); }
    if (!blank) { const candidate = await client.query('SELECT id FROM candidates WHERE id=$1 AND office=$2 AND active=TRUE AND signed_at IS NOT NULL',[Number(candidateId),office]); if (!candidate.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({error:'Candidato inválido para este cargo.'}); } }
    const result = await client.query('INSERT INTO votes(discord_id,candidate_id,office,blank_vote) VALUES($1,$2,$3,$4) ON CONFLICT(discord_id,office) DO NOTHING RETURNING id',[session.discordId,blank?null:Number(candidateId),office,blank]);
    if (!result.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({error:'Já votaste neste cargo.'}); }
    await client.query('COMMIT'); return res.status(200).json({ok:true,office});
  } catch(e) { if(client) await client.query('ROLLBACK').catch(()=>{}); console.error('vote:',e); return res.status(500).json({error:'Erro ao registar voto.'}); }
  finally { if(client) client.release(); }
}
