import { getSession, checkAdmin, checkVoter, isAdmin } from '../../lib/auth.js';
import { query } from '../../lib/db.js';
export default async function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).end();
  const session = getSession(req);
  if (!session) return res.status(200).json({authenticated:false,isAdmin:false,canVote:false,votedOffices:[]});
  try {
    const [isAdmin,canVote,votes] = await Promise.all([checkAdmin(session.discordId),checkVoter(session.discordId),query('SELECT office FROM votes WHERE discord_id=$1',[session.discordId])]);
    return res.status(200).json({authenticated:true,user:{id:session.discordId,username:session.username,avatar:session.avatar},isAdmin,canManageElection:isAdmin && session.discordId === '1467086958147928154',canVote,votedOffices:votes.rows.map(r=>r.office)});
  } catch(e) { console.error('auth/me:',e); return res.status(500).json({error:'Erro ao consultar conta ou base de dados.'}); }
}
