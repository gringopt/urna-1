import { initDatabase } from '../../lib/db.js';
import pool from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { discordMember } from '../../lib/discord.js';
const OFFICES = ['Senador','Dep Estadual','Dep Federal','Governador','Presidente'];
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method === 'GET') {
    try { await initDatabase(); const rows = await pool.query(`SELECT id,name,number,office,photo_url,discord_id,active,signed_at FROM candidates WHERE active=TRUE ORDER BY office,number`); return res.json({candidates:rows.rows}); }
    catch(e){console.error(e);return res.status(500).json({error:'Não foi possível carregar candidatos.'});}
  }
  if (req.method !== 'POST') return res.status(405).end();
  if (!(await requireAdmin(req,res))) return;
  const {name,number,office,photoUrl,discordId} = req.body || {};
  if (!/^\d{17,20}$/.test(String(discordId||''))) return res.status(400).json({error:'Indica um ID Discord válido.'});
  if (typeof name!=='string'||!name.trim()||name.length>100||typeof number!=='string'|| !/^\d{1,5}$/.test(number)||!OFFICES.includes(office)|| (photoUrl && (typeof photoUrl!=='string'||photoUrl.length>2000||!/^https:\/\//i.test(photoUrl)))) return res.status(400).json({error:'Dados inválidos.'});
  try { if (!(await discordMember(discordId))) return res.status(400).json({error:'Este Discord ID não pertence ao servidor MetroVile.'}); }
  catch(e){console.error(e);return res.status(502).json({error:'Não foi possível verificar o membro no Discord.'});}
  let client;
  try { await initDatabase();client=await pool.connect();await client.query('BEGIN');
    const state=(await client.query('SELECT voting_open,announced_at FROM election_state WHERE id=1 FOR UPDATE')).rows[0];
    if(state.voting_open) {await client.query('ROLLBACK');return res.status(423).json({error:'Não é possível adicionar candidatos durante a votação.'});}
    if(state.announced_at) {await client.query('ROLLBACK');return res.status(409).json({error:'Reinicia a eleição antes de registar novos candidatos.'});}
    const row=await client.query(`INSERT INTO candidates(name,number,office,photo_url,discord_id,active) VALUES($1,$2,$3,$4,$5,TRUE) RETURNING id,name,number,office,photo_url,discord_id,signed_at`,[name.trim(),number,office,photoUrl||null,discordId]);
    await client.query('COMMIT');return res.status(201).json({candidate:row.rows[0]});
  }catch(e){if(client)await client.query('ROLLBACK').catch(()=>{});if(e.code==='23505')return res.status(409).json({error:'Já existe um candidato ativo com esse número nesse cargo.'});console.error(e);return res.status(500).json({error:'Erro ao criar candidatura.'});}
  finally{client?.release();}
}
