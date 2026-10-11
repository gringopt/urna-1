import { requireAdmin } from '../../lib/auth.js';
import { initDatabase } from '../../lib/db.js';
import pool from '../../lib/db.js';
export default async function handler(req,res) {
 if(!['POST','DELETE'].includes(req.method))return res.status(405).end();
 if(!(await requireAdmin(req,res)))return;
 const id=Number(req.body?.id||req.query?.id);
 if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'ID inválido.'});
 let client;
 try{await initDatabase();client=await pool.connect();await client.query('BEGIN');
 const state=(await client.query('SELECT voting_open,announced_at FROM election_state WHERE id=1 FOR UPDATE')).rows[0];
 if(state.voting_open||state.announced_at){await client.query('ROLLBACK');return res.status(423).json({error:'Não é permitido alterar candidatos durante a votação ou após o anúncio.'});}
 const result=await client.query('UPDATE candidates SET active=FALSE WHERE id=$1 AND active=TRUE RETURNING id',[id]);
 await client.query('COMMIT');return result.rowCount?res.json({ok:true}):res.status(404).json({error:'Candidato não encontrado.'});
 }catch(e){if(client)await client.query('ROLLBACK').catch(()=>{});console.error(e);return res.status(500).json({error:'Erro ao remover candidatura.'});}
 finally{client?.release();}
}
