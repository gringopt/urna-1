import { requireUser } from '../../lib/auth.js';
import { initDatabase } from '../../lib/db.js';
import pool from '../../lib/db.js';

const OWNER_ID = '1467086958147928154';
const OFFICES = ['Senador','Dep Estadual','Dep Federal','Governador','Presidente'];
const LABELS = {'Senador':'Senador','Dep Estadual':'Deputado Estadual','Dep Federal':'Deputado Federal','Governador':'Governador','Presidente':'Presidente'};

export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido.'});
  const session = requireUser(req,res);
  if (!session) return;
  if (String(session.discordId) !== OWNER_ID) return res.status(403).json({error:'Apenas o responsável principal pode executar esta operação.'});
  const action = req.body?.action;
  if (!['announce','reset','open','close'].includes(action)) return res.status(400).json({error:'Operação inválida.'});
  if (action === 'reset' && req.body?.confirmation !== 'REINICIAR') return res.status(400).json({error:'Escreve REINICIAR para confirmar.'});
  try { await initDatabase(); } catch(e) { console.error('election init',e); return res.status(500).json({error:'Erro de ligação à base de dados.'}); }
  const client = await pool.connect().catch(() => null);
  if (!client) return res.status(500).json({error:'Sem ligação à base de dados.'});
  let transaction = false;
  try {
    await client.query('BEGIN'); transaction=true;
    await client.query('SELECT id FROM election_state WHERE id=1 FOR UPDATE');
    const state = (await client.query('SELECT round,announced_at,voting_open FROM election_state WHERE id=1')).rows[0];
    if (action === 'open' || action === 'close') {
      if (action === 'open' && state.announced_at) return res.status(409).json({error:'O governo já foi anunciado. Reinicia a eleição antes de reabrir.'});
      if (action === 'open') {
        const pending=await client.query(`SELECT id,name,office,discord_id FROM candidates WHERE active=TRUE AND signed_at IS NULL ORDER BY office,name`);
        if(pending.rowCount)return res.status(409).json({error:`Existem ${pending.rowCount} candidatura(s) pendente(s) de assinatura. Não é possível abrir a votação.`,pending:pending.rows});
        const total=await client.query(`SELECT COUNT(*)::int AS n FROM candidates WHERE active=TRUE AND signed_at IS NOT NULL`);
        if(total.rows[0].n===0)return res.status(409).json({error:'Regista e oficializa pelo menos uma candidatura antes de abrir a votação.'});
      }
      const votingOpen = action === 'open';
      await client.query('UPDATE election_state SET voting_open=$1 WHERE id=1',[votingOpen]);
      await client.query('COMMIT'); transaction=false;
      return res.status(200).json({ok:true,votingOpen,round:state.round});
    }
    if (action === 'reset') {
      const count = await client.query('SELECT COUNT(*)::int AS count FROM votes');
      await client.query('DELETE FROM votes');
      await client.query('UPDATE election_state SET round=round+1,announced_at=NULL,voting_open=FALSE WHERE id=1');
      await client.query('COMMIT');transaction=false;
      return res.status(200).json({ok:true,removedVotes:count.rows[0].count,newRound:state.round+1});
    }
    if (state.voting_open) return res.status(409).json({error:'Fecha a votação antes de anunciar o governo.'});
    const pending=(await client.query('SELECT COUNT(*)::int AS n FROM candidates WHERE active=TRUE AND signed_at IS NULL')).rows[0].n;
    if(pending)return res.status(409).json({error:'Existem candidaturas pendentes de assinatura. Não é possível anunciar o governo.'});
    if (state.announced_at) return res.status(409).json({error:'O governo desta eleição já foi anunciado. Reinicia a votação para começar uma nova eleição.'});
    const result = await client.query(`SELECT c.id,c.name,c.number,c.office,c.discord_id,COUNT(v.id)::int AS votes
      FROM candidates c LEFT JOIN votes v ON v.candidate_id=c.id AND v.blank_vote=FALSE
      WHERE c.active=TRUE AND c.signed_at IS NOT NULL GROUP BY c.id,c.name,c.number,c.office,c.discord_id`);
    const winners=[];const ties=[];const missing=[];
    for(const office of OFFICES){
      const ranked=result.rows.filter(c=>c.office===office).sort((a,b)=>b.votes-a.votes);
      if(!ranked.length || ranked[0].votes===0){missing.push(office);continue;}
      if(ranked.length>1 && ranked[0].votes===ranked[1].votes){ties.push(office);continue;}
      if(!/^\d{17,20}$/.test(String(ranked[0].discord_id||''))){missing.push(office);continue;}
      winners.push(ranked[0]);
    }
    if(ties.length || missing.length) return res.status(409).json({error:`Não é possível anunciar: ${ties.length?'empate em '+ties.join(', ')+'. ':''}${missing.length?'sem vencedor com votos e ID Discord em '+missing.join(', ')+'.':''}`});
    const url=process.env.DISCORD_GOVERNMENT_WEBHOOK_URL;
    if(!url || !/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url)) return res.status(500).json({error:'Webhook Discord não configurado corretamente no Vercel.'});
    const lines=winners.map(w=>`**${LABELS[w.office]}**\n<@${w.discord_id}> — **${w.name.replace(/[@`*_~|>]/g,'')}** (n.º ${w.number})\n🗳️ **${w.votes} voto(s)**`);
    const payload={username:'MetroVile · Comissão Eleitoral',embeds:[{title:'🏛️ NOVO GOVERNO DE METROVILE',description:`**Resultado oficial da eleição #${state.round}**\n\n${lines.join('\n\n')}`,color:3447003,footer:{text:'MetroVile RP · Sistema eleitoral fictício'},timestamp:new Date().toISOString()}],allowed_mentions:{parse:[],users:winners.map(w=>w.discord_id)}};
    const response=await fetch(url+'?wait=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!response.ok){const detail=await response.text();console.error('Webhook announce',response.status,detail.slice(0,300));return res.status(502).json({error:'O Discord não aceitou o anúncio. Código HTTP '+response.status});}
    await client.query('UPDATE election_state SET announced_at=NOW() WHERE id=1');
    await client.query('COMMIT');transaction=false;
    return res.status(200).json({ok:true,round:state.round,winners:winners.map(w=>({office:w.office,name:w.name,votes:w.votes,discordId:w.discord_id}))});
  }catch(e){console.error('Election management:',e);return res.status(500).json({error:'Erro ao gerir eleição. Verifica os logs.'});}
  finally{if(transaction) await client.query('ROLLBACK').catch(()=>{});client.release();}
}
