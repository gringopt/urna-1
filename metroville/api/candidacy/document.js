import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getSession, checkAdmin } from '../../lib/auth.js';
import { query } from '../../lib/db.js';
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).end();
 const session=getSession(req);if(!session)return res.status(401).json({error:'Não autenticado.'});
 const id=Number(req.query?.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'ID inválido.'});
 try{
  const r=await query(`SELECT id,name,office,discord_id,signed_at,signature_name,signature_version,signed_discord_id FROM candidates WHERE id=$1`,[id]);
  const c=r.rows[0];if(!c||!c.signed_at)return res.status(404).json({error:'Termo ainda não assinado.'});
  if(session.discordId!==c.discord_id&&!(await checkAdmin(session.discordId)))return res.status(403).json({error:'Acesso negado.'});
  const bytes=await readFile(fileURLToPath(new URL('../../lib/termo-responsabilidade.pdf',import.meta.url)));
  const pdf=await PDFDocument.load(bytes);const page=pdf.getPages()[0];const font=await pdf.embedFont(StandardFonts.Helvetica);
  const {height,width}=page.getSize();
  const clean=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'').slice(0,75);
  const lines=[`PERSONAGEM: ${clean(c.name)}`,`CARGO: ${clean(c.office)}`,`DISCORD ID: ${clean(c.signed_discord_id)}`,`DATA: ${new Date(c.signed_at).toISOString()}`,`ASSINATURA VIRTUAL: ${clean(c.signature_name)}`,`TERMO: ${clean(c.signature_version)}`];
  // Registo adicional na margem inferior do termo original.
  page.drawRectangle({x:30,y:15,width:width-60,height:88,color:rgb(0.94,0.96,0.99),borderColor:rgb(0.35,0.48,0.7),borderWidth:0.6});
  lines.forEach((line,i)=>page.drawText(line,{x:38,y:91-i*13,size:8,font,color:rgb(0.09,0.19,0.34),maxWidth:width-76}));
  const result=await pdf.save();res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="MetroVile-termo-assinado-${id}.pdf"`);res.setHeader('Cache-Control','private, no-store');return res.status(200).send(Buffer.from(result));
 }catch(e){console.error('PDF assinatura:',e);return res.status(500).json({error:'Erro ao gerar PDF assinado.'});}
}
