# RP Affection Bot

Bot privado de Discord para a Aurora, focado em interacoes RP leves, afinidade por servidor, GIFs moderados e controles de privacidade.

O objetivo do projeto e permitir comandos como abraco, cafune, consolo, protecao e brincadeiras leves, sempre com arquitetura modular: comandos apenas adaptam entrada/saida, enquanto services concentram a regra de negocio.

## Stack

- TypeScript
- Node.js 20.11+
- discord.js 14
- Prisma
- SQLite no MVP
- GIPHY API para GIFs
- Docker e VPS como alvo de deploy

## Estrutura

- `src/config`: configuracoes e validacao de env.
- `src/commands`: slash commands, comandos por prefixo e adaptadores de resposta.
- `src/handlers`: handlers de eventos do Discord.
- `src/services`: regras de negocio do bot.
- `src/database`: Prisma Client e repositories.
- `src/types`: tipos compartilhados.
- `src/utils`: utilitarios como logger.
- `data`: JSONs base, frases e termos de busca.
- `env`: exemplos de `.env`, sem tokens reais.
- `prisma`: schema Prisma e migrations.
- `tests`: testes unitarios do MVP.

## Instalacao

```bat
npm install
```

Esse comando baixa dependencias e cria `node_modules`. Ele acessa a internet e executa scripts de instalacao dos pacotes declarados no `package.json`.

## Configuracao do `.env`

Crie um `.env` real na raiz do projeto a partir do exemplo.

No `cmd` do Windows:

```bat
copy env\.env.development.example .env
```

No PowerShell:

```powershell
Copy-Item env\.env.development.example .env
```

Depois preencha no `.env`:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_DEV_GUILD_ID=
DATABASE_URL="file:./dev.db"
GIPHY_API_KEY=
```

Nunca coloque token real no Git. O `.gitignore` ignora `.env` e `.env.*` reais.

Variaveis principais:

- `DISCORD_TOKEN`: token do bot no Discord Developer Portal.
- `DISCORD_CLIENT_ID`: Application ID do bot.
- `DISCORD_DEV_GUILD_ID`: ID do servidor de teste; quando preenchido, deploya slash commands apenas nesse servidor.
- `DATABASE_URL`: caminho SQLite usado pelo Prisma.
- `GIPHY_API_KEY`: chave da GIPHY API.
- `GIPHY_REQUESTS_PER_HOUR`: cota local usada pelo bot, padrao `100`.
- `ALLOW_NSFW`: mantenha `false` no MVP.
- `ALLOW_UNCATEGORIZED_GIFS`: permite usar GIF novo ainda nao aprovado em proporcao limitada.

## Discord

No convite do bot, use os scopes:

- `bot`
- `applications.commands`

Permissoes recomendadas:

- View Channels
- Send Messages
- Embed Links
- Use External Emojis
- Read Message History

Intents usadas pelo codigo:

- `Guilds`
- `GuildMessages`
- `MessageContent`

Para comandos por prefixo como `-hug`, habilite a **Message Content Intent** no Discord Developer Portal. Sem ela, os slash commands continuam funcionando, mas comandos com `-` podem nao ser lidos.

## Prisma e banco

Gere o Prisma Client:

```bat
npm run prisma:generate
```

Crie/aplique migration local em desenvolvimento:

```bat
npm run prisma:migrate -- --name init
```

Se ja existirem migrations e voce so quiser aplicar no ambiente:

```bat
npm run prisma -- migrate deploy
```

Abrir Prisma Studio:

```bat
npm run prisma -- studio
```

## Registrar slash commands

Com `.env` preenchido:

```bat
npm run deploy:commands
```

Se `DISCORD_DEV_GUILD_ID` estiver definido, os comandos sao registrados no servidor de desenvolvimento. Sem `DISCORD_DEV_GUILD_ID`, o script registra comandos globais da aplicacao.

## Desenvolvimento

```bat
npm run dev
```

O bot carrega `.env`, valida variaveis obrigatorias e inicia o client Discord.

## Testes e qualidade

Rodar testes:

```bat
npm run test
```

Validar TypeScript:

```bat
npm run typecheck
```

Build:

```bat
npm run build
```

Lint ainda esta como placeholder nesta etapa:

```bat
npm run lint
```

## Producao

Use `env/.env.production.example` como base para o `.env` da VPS:

```bat
copy env\.env.production.example .env
```

Fluxo recomendado:

```bat
npm install
npm run prisma:generate
npm run prisma -- migrate deploy
npm run deploy:commands
npm run build
npm run start
```

Em producao, guarde `.env` em pasta protegida, nunca versionada. Use um gerenciador de processo ou servico da VPS para reiniciar o bot em caso de queda.

## Docker

Docker e VPS fazem parte do alvo de deploy do projeto, mas este repositorio ainda nao possui `Dockerfile` nem `docker-compose.yml`.

Quando um `Dockerfile` for adicionado, o fluxo esperado sera:

```bat
docker build -t rp-affection-bot .
docker run --env-file .env rp-affection-bot
```

Ate la, rode em producao com Node.js diretamente ou prepare o Dockerfile em uma etapa propria.

## Comandos do MVP

Slash e prefixo:

- `/hug` e `-hug`
- `/beijotesta` e `-beijotesta`
- `/beijobochecha` e `-beijobochecha`
- `/cafune` e `-cafune`
- `/consolar` e `-consolar`
- `/proteger` e `-proteger`
- `/morder` e `-morder`
- `/cutucar` e `-cutucar`
- `/afinidade` e `-afinidade`
- `/rankafinidade` e `-rankafinidade`
- `/help` e `-help`

Privacidade:

- `/bloquearrp`
- `/desbloquearrp`
- `/bloquearcategoria`
- `/preferencias`
- `/optout`
- `/optin`

Administracao de GIFs:

- `/gifadd`
- `/gifbuscar`
- `/gifaprovar`
- `/gifbloquear`
- `/gifremove`
- `/gifmover`
- `/giflist`
- `/giftest`

Administracao de frases:

- `/fraseadd`
- `/fraseremove`
- `/fraselist`

Configuracao por servidor:

- `/config prefixo`
- `/config afinidade`
- `/config gifs`
- `/config categoria`
- `/config canal`
- `/config cooldown`
- `/config idioma`
- `/config mencionar`
- `/config rank`
- `/config reset`

## Politica de GIFs

O MVP usa GIPHY API. Nao usa Tenor e nao baixa milhares de arquivos para a VPS.

O banco salva metadados persistentes como provider, `providerGifId`, acao, categoria, status, termo de busca, rating, uso e datas. URLs de midia da GIPHY nao devem ser tratadas como permanentes; quando necessario, o bot renova/busca a midia usando `providerGifId`.

Status de GIF:

- `pending`
- `approved`
- `blocked`
- `disabled`
- `uncategorized`

A resposta publica de RP nao deve mostrar fonte, URL, nome de arquivo, `providerGifId` ou qualquer identificador interno.

## Proporcao progressiva de GIFs

A proporcao depende da quantidade de GIFs `approved` daquela `action/category`:

- 0-19 aprovados: 65% banco / 35% GIPHY nova
- 20-49 aprovados: 70% banco / 30% GIPHY nova
- 50-99 aprovados: 75% banco / 25% GIPHY nova
- 100-199 aprovados: 80% banco / 20% GIPHY nova
- 200+ aprovados: 85% banco / 15% GIPHY nova

Se a cota GIPHY acabar, o bot usa apenas GIFs `approved` do banco. Se nao houver GIF aprovado e nao puder buscar na GIPHY, a resposta deve sair apenas com texto.

## Privacidade

Usuarios podem bloquear interacoes recebidas, bloquear categorias, bloquear romance/brincadeiras, ocultar ranking e sair do sistema de afinidade com `/optout`.

Interacoes bloqueadas nao devem enviar RP nem pontuar afinidade. O botao Retribuir passa pela mesma regra do `actionService`, entao tambem respeita bloqueios, cooldown, consentimento e opt-out.

## Seguranca de segredos

- Nunca publique `DISCORD_TOKEN`.
- Nunca publique `GIPHY_API_KEY`.
- Nao envie `.env` para GitHub, Discord ou prints publicos.
- Revogue e gere um token novo se ele vazar.
- Em VPS, proteja o `.env` com permissao restrita ao usuario do processo.

## Fluxo do zero

```bat
npm install
copy env\.env.development.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run deploy:commands
npm run test
npm run typecheck
npm run build
npm run dev
```

Antes de `deploy:commands` e `dev`, preencha `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_DEV_GUILD_ID` e, se for usar GIFs externos, `GIPHY_API_KEY`.
