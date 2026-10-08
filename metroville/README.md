# MetroVille · Urna RP

## Instalação

1. Substitui os ficheiros do repositório GitHub pelos deste ZIP.
2. No Vercel, mantém as variáveis Discord, `DATABASE_URL`, `SESSION_SECRET` e `BLOB_READ_WRITE_TOKEN` da versão anterior.
3. Configura `DISCORD_GOVERNMENT_WEBHOOK_URL` com o **novo** URL secreto do webhook Discord, apenas no Vercel (Production). Nunca o coloques no HTML nem no GitHub.
4. Faz redeploy para aplicar as variáveis.

## Funcionalidades

- ID Discord obrigatório na criação de candidatos; o backend valida a presença no servidor usando o bot.
- Apenas o Discord ID `1467086958147928154` pode reiniciar os votos e anunciar o governo.
- O anúncio usa os vencedores dos cinco cargos e menciona os IDs Discord correspondentes.
- Empates, cargos sem votos ou vencedores sem ID impedem o anúncio; não se inventam vencedores.
- Uma eleição só pode ser anunciada uma vez. Reiniciar apaga votos, preserva candidatos e inicia uma nova eleição.

## Segurança

O URL de webhook partilhado na conversa é uma credencial: revoga-o e cria um novo no Discord antes de configurar a variável. Não partilhes o novo URL publicamente.

## Bloquear / abrir a votação

O utilizador Discord `1467086958147928154` tem no painel **Gestão da eleição** o botão **Abrir votação / Encerrar votação**.

- As novas instalações começam com a votação **ENCERRADA**.
- A configuração é guardada em PostgreSQL, não no navegador.
- O endpoint `/api/vote` verifica o estado numa transação e recusa votos quando encerrada (HTTP 423).
- Os votos anteriores permanecem ao fechar.
- Para anunciar o governo é obrigatório fechar primeiro a votação.
- Reiniciar votos também deixa a eleição encerrada; é necessário reabrir manualmente.
- A interface consulta `/api/election/status` ao iniciar; a proteção real é feita no servidor.
