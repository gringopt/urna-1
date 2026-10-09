import { requireUser } from '../../lib/auth.js';
import { initDatabase } from '../../lib/db.js';
import pool from '../../lib/db.js';
const VERSION='MetroVile-Termo-Responsabilidade-v1';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).end();
 const session=requireUser(req,res);if(!session)return;
 let client;
 try{
  await initDatabase();
  if(req.method==='GET'){
   const result=await pool.query(`SELECT id,name,number,office,discord_id,signed_at,signature_name FROM candidates WHERE active=TRUE AND discord_id=$1 ORDER BY id`,[session.discordId]);
   return res.json({candidacies:result.rows,documentUrl:'/termo-responsabilidade.pdf',version:VERSION});
  }
  const id=Number(req.body?.candidateId),signature=String(req.body?.signature||'').trim();
  if(!Number.isSafeInteger(id)||id<1||signature.length<3||signature.length>120||req.body?.accepted!==true)return res.status(400).json({error:'Lê o termo, aceita as condições e introduz a assinatura (3 a 120 caracteres).'});
  client=await pool.connect();await client.query('BEGIN');
  const state=(await client.query('SELECT round,voting_open,announced_at FROM election_state WHERE id=1 FOR SHARE')).rows[0];
  if(state.voting_open||state.announced_at){await client.query('ROLLBACK');return res.status(423).json({error:'A assinatura só é permitida antes da abertura da votação.'});}
  const row=await client.query(`UPDATE candidates SET signed_at=NOW(),signature_name=$1,signature_version=$2,signed_discord_id=$3,signed_round=$4,signed_consent=TRUE WHERE id=$5 AND discord_id=$3 AND active=TRUE AND signed_at IS NULL RETURNING id,name,office,signed_at`,[signature,VERSION,session.discordId,state.round,id]);
  if(!row.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'Candidatura inexistente, já assinada ou não associada ao teu Discord.'});}
  await client.query('COMMIT');return res.json({ok:true,candidate:row.rows[0]});
 }catch(e){if(client)await client.query('ROLLBACK').catch(()=>{});console.error(e);return res.status(500).json({error:'Erro ao consultar ou assinar candidatura.'});}
 finally{client?.release();}
}
