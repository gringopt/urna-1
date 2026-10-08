import { query } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
export const OFFICES = ['Senador','Dep Estadual','Dep Federal','Governador','Presidente'];
export default async function handler(req,res) {
  try {
    if (req.method === 'GET') { const data = await query('SELECT id,name,number,office,photo_url,active FROM candidates WHERE active=TRUE ORDER BY office,number'); return res.status(200).json({candidates:data.rows}); }
    if (req.method !== 'POST') return res.status(405).end();
    if (!(await requireAdmin(req,res))) return;
    const {name,number,office,photoUrl} = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.length>100 || typeof number !== 'string' || !/^\d{1,5}$/.test(number) || !OFFICES.includes(office) || (photoUrl && (typeof photoUrl !== 'string' || photoUrl.length>2000 || !/^https:\/\//i.test(photoUrl)))) return res.status(400).json({error:'Dados do candidato inválidos.'});
    const result = await query('INSERT INTO candidates(name,number,office,photo_url,active) VALUES($1,$2,$3,$4,TRUE) ON CONFLICT(number,office) DO UPDATE SET name=EXCLUDED.name,photo_url=EXCLUDED.photo_url,active=TRUE RETURNING *',[name.trim(),number,office,photoUrl || null]);
    return res.status(200).json({candidate:result.rows[0]});
  } catch(e) { console.error('candidates:',e); return res.status(500).json({error:'Erro ao consultar/guardar candidatos.'}); }
}
