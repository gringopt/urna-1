import { requireUser } from '../../lib/auth.js';
import { initDatabase, query } from '../../lib/db.js';
import pool from '../../lib/db.js';

const OWNER_ID = '1467086958147928154';
const OFFICES = ['Senador','Dep Estadual','Dep Federal','Governador','Presidente'];
const LABELS = {'Senador':'Senador','Dep Estadual':'Deputado Estadual','Dep Federal':'Deputado Federal','Governador':'Governador','Presidente':'Presidente'};

export default async function handler(req,res) {
  // Portal cidadão, perfis, publicações, calendário e auditoria: reutiliza esta API (limite Hobby de 12 funções).
  if (req.query?.view === 'portal' || req.body?.action === 'portal') {
    const session=requireUser(req,res); if(!session)return;
    const owner=String(session.discordId)===OWNER_ID;
    try {
      await initDatabase();
      if(req.method==='GET') {
        const [publications, settings, candidates, ownRequests]=await Promise.all([
          query(`SELECT id,kind,title,body,event_at,created_at FROM civic_publications ORDER BY created_at DESC,id DESC LIMIT 100`),
          query(`SELECT value FROM portal_settings WHERE key='results_public'`),
          query(`SELECT id,name,number,office,photo_url,party,biography,proposals,discord_id,signed_at FROM candidates WHERE active=TRUE ORDER BY office,number`),
          query(`SELECT id,category,subject,message,status,created_at FROM citizen_requests WHERE author_discord_id=$1 ORDER BY id DESC LIMIT 30`,[session.discordId])
        ]);
        const result={publications:publications.rows,resultsPublic:settings.rows[0]?.value==='true',candidates:candidates.rows.map(c=>({...c,discord_id:owner||c.discord_id===session.discordId?c.discord_id:null})),requests:ownRequests.rows,owner};
        if(owner){
          const [requests,audit]=await Promise.all([
            query(`SELECT id,author_discord_id,category,subject,message,status,created_at FROM citizen_requests ORDER BY id DESC LIMIT 100`),
            query(`SELECT actor_discord_id,action,details,created_at FROM government_audit ORDER BY id DESC LIMIT 80`)
          ]);
          result.requests=requests.rows;result.audit=audit.rows;
        }
        return res.status(200).json(result);
      }
      if(req.method!=='POST'||req.body?.action!=='portal')return res.status(405).json({error:'Método não permitido.'});
      const op=String(req.body.operation||'');
      const str=(key,max)=>typeof req.body[key]==='string'?req.body[key].trim().slice(0,max):'';
      const actor=String(session.discordId);
      if(op==='request'){
        const category=str('category',30),subject=str('subject',160),message=str('message',3000);
        if(!['proposta','reclamacao','peticao','pedido'].includes(category)||subject.length<3||message.length<10)return res.status(400).json({error:'Preenche assunto e mensagem (mínimo 10 caracteres).'});
        await query(`INSERT INTO citizen_requests(author_discord_id,category,subject,message) VALUES($1,$2,$3,$4)`,[actor,category,subject,message]);
        return res.json({ok:true});
      }
      if(op==='profile'){
        const id=Number(req.body.id);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Candidato inválido.'});
        const found=await query(`SELECT discord_id FROM candidates WHERE id=$1 AND active=TRUE`,[id]);
        if(!found.rowCount)return res.status(404).json({error:'Candidato não encontrado.'});
        if(!owner&&String(found.rows[0].discord_id)!==actor)return res.status(403).json({error:'Só podes editar a tua candidatura.'});
        const party=str('party',80),biography=str('biography',2000),proposals=str('proposals',5000);
        await query(`UPDATE candidates SET party=$2,biography=$3,proposals=$4 WHERE id=$1`,[id,party,biography,proposals]);
        await query(`INSERT INTO government_audit(actor_discord_id,action,details) VALUES($1,'profile_updated',$2)`,[actor,String(id)]);
        return res.json({ok:true});
      }
      if(!owner)return res.status(403).json({error:'Acesso reservado à direção de MetroVile.'});
      if(op==='publication'){
        const kind=str('kind',30),title=str('title',160),body=str('body',6000),date=str('eventAt',50);
        if(!['decreto','lei','nomeacao','comunicado','calendario'].includes(kind)||title.length<3||body.length<5)return res.status(400).json({error:'Publicação incompleta.'});
        const eventAt=date?new Date(date):null;
        if(date&&Number.isNaN(eventAt.getTime()))return res.status(400).json({error:'Data inválida.'});
        await query(`INSERT INTO civic_publications(kind,title,body,event_at,author_discord_id) VALUES($1,$2,$3,$4,$5)`,[kind,title,body,eventAt,actor]);
        await query(`INSERT INTO government_audit(actor_discord_id,action,details) VALUES($1,'publication_created',$2)`,[actor,kind+': '+title]);
        return res.json({ok:true});
      }
      if(op==='request_status'){
        const id=Number(req.body.id),status=str('status',20);
        if(!Number.isSafeInteger(id)||!['recebido','em_analise','resolvido','recusado'].includes(status))return res.status(400).json({error:'Estado inválido.'});
        await query(`UPDATE citizen_requests SET status=$2 WHERE id=$1`,[id,status]);
        await query(`INSERT INTO government_audit(actor_discord_id,action,details) VALUES($1,'request_status',$2)`,[actor,String(id)+': '+status]);
        return res.json({ok:true});
      }
      if(op==='results_visibility'){
        const value=req.body.public===true?'true':'false';
        await query(`UPDATE portal_settings SET value=$1 WHERE key='results_public'`,[value]);
        await query(`INSERT INTO government_audit(actor_discord_id,action,details) VALUES($1,'results_visibility',$2)`,[actor,value]);
        return res.json({ok:true});
      }
      return res.status(400).json({error:'Operação desconhecida.'});
    }catch(e){console.error('Portal MetroVile:',e);return res.status(500).json({error:'Erro no portal governamental. Consulta os logs do Vercel.'});}
  }
  // Painel governamental: só o proprietário pode consultar e controlar.
  if (req.query?.view === 'government' || req.query?.view === 'debate' || req.body?.action === 'debate') {
    const session = requireUser(req,res);
    if (!session) return;
    if (String(session.discordId) !== OWNER_ID) return res.status(403).json({error:'Acesso exclusivo ao proprietário.'});
    try {
      await initDatabase();
      if (req.method === 'GET' && req.query.view === 'government') {
        const [history, state, counts] = await Promise.all([
          query('SELECT election_number,results,announced_at FROM election_history ORDER BY id DESC LIMIT 20'),
          query('SELECT round,voting_open FROM election_state WHERE id=1'),
          query('SELECT COUNT(*)::int AS n FROM candidates WHERE active=TRUE')
        ]);
        return res.status(200).json({history:history.rows,state:state.rows[0],activeCandidates:counts.rows[0].n});
      }
      if (req.method === 'GET' && req.query.view === 'debate') {
        const rows=await query('SELECT slot,candidate_name,remaining_ms,ends_at,ROUND(EXTRACT(EPOCH FROM NOW())*1000)::bigint AS server_now FROM debate_timers ORDER BY slot');
        return res.status(200).json({timers:rows.rows});
      }
      if (req.method !== 'POST' || req.body?.action !== 'debate') return res.status(405).json({error:'Método inválido.'});
      const slot=Number(req.body.slot), op=req.body.operation;
      if (!Number.isInteger(slot) || slot<1 || slot>4 || !['start','pause','reset','rename'].includes(op)) return res.status(400).json({error:'Comando inválido.'});
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        const current=(await client.query('SELECT *,ROUND(EXTRACT(EPOCH FROM NOW())*1000)::bigint AS server_now FROM debate_timers WHERE slot=$1 FOR UPDATE',[slot])).rows[0];
        if(!current) throw Error('Cronómetro não encontrado');
        const remaining=current.ends_at ? Math.max(0,Math.ceil((new Date(current.ends_at).getTime()-Number(current.server_now)))) : current.remaining_ms;
        if(op==='start') await client.query("UPDATE debate_timers SET remaining_ms=$2::integer,ends_at=NOW()+($2::double precision * INTERVAL '1 millisecond'),updated_at=NOW() WHERE slot=$1",[slot,remaining]);
        if(op==='pause') await client.query('UPDATE debate_timers SET remaining_ms=$2,ends_at=NULL,updated_at=NOW() WHERE slot=$1',[slot,remaining]);
        if(op==='reset') await client.query('UPDATE debate_timers SET remaining_ms=300000,ends_at=NULL,updated_at=NOW() WHERE slot=$1',[slot]);
        if(op==='rename') {
          const name=String(req.body.name||'').trim();
          if(!name || name.length>100){await client.query('ROLLBACK');return res.status(400).json({error:'Nome entre 1 e 100 caracteres.'});}
          await client.query('UPDATE debate_timers SET candidate_name=$2,updated_at=NOW() WHERE slot=$1',[slot,name]);
        }
        await client.query('COMMIT');
        return res.status(200).json({ok:true});
      } catch(e) {await client.query('ROLLBACK').catch(()=>{});throw e;} finally{client.release();}
    } catch(e){console.error('Government/debate:',e);return res.status(500).json({error:'Erro no painel governamental.'});}
  }
  if (req.method === 'GET') {
    res.setHeader('Cache-Control','no-store');
    try {
      const result=await query('SELECT round,voting_open,announced_at FROM election_state WHERE id=1');
      const state=result.rows[0];
      const pending=await query('SELECT COUNT(*)::int AS n FROM candidates WHERE active=TRUE AND signed_at IS NULL');
      return res.status(200).json({round:state.round,votingOpen:state.voting_open,announced:!!state.announced_at,pendingCount:pending.rows[0].n});
    } catch(e) { console.error('election status',e); return res.status(500).json({error:'Não foi possível consultar o estado da eleição.'}); }
  }
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
      await client.query('UPDATE election_state SET round=1,announced_at=NULL,voting_open=FALSE WHERE id=1');
      await client.query('COMMIT');transaction=false;
      return res.status(200).json({ok:true,removedVotes:count.rows[0].count,newRound:1});
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
    // Arquiva o apuramento antes de preparar a eleição seguinte.
    await client.query(
      'INSERT INTO election_history (election_number,results) VALUES ($1,$2::jsonb)',
      [state.round, JSON.stringify({winners, candidates:result.rows})]
    );
    // A nova eleição só começa depois de o governo ter sido anunciado.
    // Os votos anteriores são arquivados acima e removidos para permitir votar novamente.
    await client.query('DELETE FROM votes');
    await client.query('UPDATE election_state SET round=round+1,announced_at=NULL,voting_open=FALSE WHERE id=1');
    await client.query('COMMIT');transaction=false;
    return res.status(200).json({ok:true,round:state.round,newRound:state.round+1,winners:winners.map(w=>({office:w.office,name:w.name,votes:w.votes,discordId:w.discord_id}))});
  }catch(e){console.error('Election management:',e);return res.status(500).json({error:'Erro ao gerir eleição. Verifica os logs.'});}
  finally{if(transaction) await client.query('ROLLBACK').catch(()=>{});client.release();}
}
