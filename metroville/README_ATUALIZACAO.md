# MetroVile 5.4 — Portal da Cidade

## Preservação de dados
Esta versão NÃO remove candidatos, votos, assinaturas, resultados ou utilizadores. As migrações são aditivas (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`). Mantém a mesma variável DATABASE_URL no Vercel e faz backup antes do deploy.

## Funcionalidades
- Perfis dos candidatos existentes com «FALTA INFORMAÇÃO» nos campos não preenchidos. O candidato (Discord ID associado) ou o proprietário podem editar biografia, propostas e partido.
- Diário Oficial: decretos, leis, nomeações, comunicados e calendário eleitoral, com publicação reservada ao proprietário.
- Portal do Cidadão: pedidos, propostas, reclamações, petições e acompanhamento.
- Auditoria das ações do novo portal.
- Visibilidade dos resultados controlada pelo proprietário (aviso no portal; não altera a API antiga de resultados).
- Mantém cronómetros do debate, administração e histórico governamental.

## Limitações
- Integração automática do mute Discord NÃO incluída: exige um bot persistente alojado fora da Vercel.
- Os resultados continuam acessíveis através da API antiga e da área administrativa; o seletor de visibilidade também protege a API de resultados contra acesso de utilizadores não administradores.
- Cópias de segurança automáticas NÃO incluídas; usa o backup do provedor PostgreSQL.
- Os perfis são editados por janelas de introdução do navegador.
