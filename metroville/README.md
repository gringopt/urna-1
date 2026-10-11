# MetroVile — Sistema eleitoral RP v5.0

Site para Vercel + PostgreSQL Neon + Discord OAuth. **Não é um sistema eleitoral oficial.**

## Instalação
1. Coloca os ficheiros na raiz do repositório GitHub e liga-o ao Vercel.
2. Cria uma base de dados Neon e define `DATABASE_URL` com o URL PostgreSQL completo (não apenas o nome).
3. No Discord Developer Portal, regista o redirect `https://metrovileeleitoral.vercel.app/api/auth/callback` e instala o bot no servidor.
4. Define as variáveis do `.env.example` em **Vercel → Settings → Environment Variables → Production**. Faz redeploy.
5. Configura Vercel Blob para upload de fotografias (opcional se usares URL HTTPS).
6. O proprietário abre a votação apenas depois de todas as candidaturas ativas estarem assinadas.

## Regras
- Só administradores por ID ou cargo Discord podem criar/remover candidatos e consultar resultados.
- Só o Discord ID `1467086958147928154` abre/fecha a votação, reinicia votos e anuncia o governo.
- O ID Discord do candidato tem de pertencer ao servidor; a candidatura começa pendente.
- Só a própria conta Discord do candidato pode assinar o termo, mesmo com a votação fechada.
- A assinatura é guardada no PostgreSQL com data, versão do termo, ID Discord e nome virtual; o PDF assinado pode ser descarregado por candidato e admins.
- Votação aberta impede adicionar/remover candidatos, carregar imagens e assinar termos.
- Candidaturas pendentes bloqueiam a abertura; só candidatos assinados podem receber votos.
- Cada eleitor com o cargo adequado vota uma vez por cargo, incluindo Presidente.
- O anúncio do governo usa webhook privado e menciona vencedores com os votos; empates ou cargos sem vencedor impedem anúncio.
- O reinício apaga votos e fecha a eleição; mantém candidatos e assinaturas.

## Nota de segurança
O webhook partilhado anteriormente deve ser revogado e substituído. Guarda o novo apenas em `DISCORD_GOVERNMENT_WEBHOOK_URL` no Vercel, nunca no GitHub.

## Limitação
A assinatura é uma aceitação eletrónica para fins de roleplay, não uma assinatura digital qualificada com validade jurídica.

## Compatibilidade Vercel Hobby
O estado eleitoral foi integrado em GET /api/election/manage, mantendo POST para gestão. Total: 12 funções Serverless.

## Correção 404
A página principal está em `public/index.html` para ser publicada como recurso estático pela Vercel. Não coloques uma segunda cópia na raiz.
