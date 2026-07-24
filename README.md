# Aurora

Aurora é um bot para Discord que oferece ações leves de roleplay entre membros de um servidor, respostas com frases e GIFs, afinidade por pares, controles de privacidade e ferramentas de moderação do conteúdo usado pelo bot.

## Problema resolvido

Comunidades do Discord costumam depender de vários bots ou de processos manuais para criar interações de roleplay, acompanhar afinidade e moderar o conteúdo dessas experiências. O Aurora reúne esses fluxos em um único bot configurável, com persistência, consentimento, privacidade e ferramentas administrativas por servidor.

## Status atual

O projeto está em versão inicial funcional (`0.1.0`), com código executável, migrations versionadas, testes automatizados, Docker e verificações de qualidade. Ele não inclui credenciais, banco de dados ou mídia privada do autor. O documento em `docs/` é um registro histórico de design e pode conter decisões planejadas; este README e o código são a referência do que está implementado.

## Funcionalidades atuais

- Ações de RP por slash command, prefixo configurável ou menção ao bot.
- Frases locais e frases personalizadas por servidor.
- GIFs da GIPHY com cota horária persistida, cache de metadados e moderação.
- Afinidade por par, marcos, cooldowns, limites diários e ranking.
- Bloqueio de usuários e categorias, consentimento para romance leve e opt-out de afinidade.
- Consulta, exportação e apagamento dos dados de RP do próprio usuário.
- Configuração por servidor de prefixo, canais, categorias, GIFs, afinidade, ranking e menções.
- Comandos administrativos para GIFs e frases, protegidos por `Gerenciar Servidor`.
- Persistência SQLite por Prisma e encerramento gracioso do cliente e do banco.

## Tecnologias e requisitos

- Node.js 22.11 ou superior dentro da linha 22.x (a faixa suportada é `>=22.11.0 <23`).
- npm e o lockfile incluído no repositório.
- Uma aplicação de bot no Discord e um servidor em que você possa instalá-la.
- SQLite, usado pelo Prisma sem instalação separada.
- Chave da GIPHY somente se você quiser buscar novos GIFs externos.
- Docker com Compose é opcional.

## Instalação

Após clonar o repositório:

```sh
npm ci
```

O `postinstall` gera o Prisma Client automaticamente. Para atualizar dependências deliberadamente, use `npm install`; para instalações reproduzíveis e CI, use `npm ci`.

Crie o arquivo local de ambiente a partir do exemplo:

```sh
cp env/.env.example .env
```

No PowerShell:

```powershell
Copy-Item env/.env.example .env
```

O `.env` real é ignorado pelo Git. Não coloque tokens em arquivos rastreados, issues, logs ou capturas de tela.

## Credenciais do Discord e da GIPHY

1. Crie uma aplicação no [Discord Developer Portal](https://discord.com/developers/applications).
2. Na seção **Bot**, crie o usuário do bot, copie o token para `DISCORD_TOKEN` e habilite **Message Content Intent** se for usar comandos por prefixo.
3. Copie o **Application ID** para `DISCORD_CLIENT_ID`.
4. Para testes, ative o modo de desenvolvedor do Discord, copie o ID do servidor e use-o em `DISCORD_DEV_GUILD_ID`.
5. Instale a aplicação no servidor com os escopos `bot` e `applications.commands`. O [guia oficial do Discord](https://docs.discord.com/developers/quick-start/getting-started) descreve esse fluxo.
6. Para GIFs externos, crie uma chave seguindo a [documentação oficial da GIPHY](https://developers.giphy.com/docs/api/) e salve-a em `GIPHY_API_KEY`.

Trate o token do Discord e a chave da GIPHY como senhas. Se houver suspeita de exposição, revogue-os nos respectivos painéis e gere novos valores.

## Configuração

As variáveis abaixo são lidas pelo código. Campos vazios nos exemplos não são credenciais válidas.

| Variável | Obrigatória | Padrão | Uso |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Sim | — | Token do usuário de bot. |
| `DISCORD_CLIENT_ID` | Sim | — | Application ID usado para registrar comandos. |
| `DATABASE_URL` | Sim | — | URL Prisma do SQLite, por exemplo `file:./dev.db`. |
| `NODE_ENV` | Não | `development` | `development`, `test` ou `production`. |
| `DISCORD_DEV_GUILD_ID` | Não | vazio | Registra slash commands apenas nesse servidor. Sem ele, o registro é global. |
| `DISCORD_ALLOWED_GUILD_IDS` | Não | vazio | IDs separados por vírgula. Vazio permite todos os servidores. |
| `GIF_PROVIDER` | Não | `giphy` | O único provider suportado atualmente é `giphy`. |
| `GIPHY_API_KEY` | Não | vazio | Necessária para buscar ou atualizar GIFs pela API. Sem ela, o bot usa texto e GIFs já salvos quando disponíveis. |
| `GIPHY_REQUESTS_PER_HOUR` | Não | `100` | Limite local de chamadas por janela horária, persistido no SQLite. |
| `GIPHY_RATING` | Não | `pg` | `g`, `pg`, `pg-13` ou `r`; `r` é reduzido para `pg` quando NSFW está desativado. |
| `GIPHY_LANG` | Não | `pt` | Idioma enviado à busca da GIPHY. |
| `ACTION_COOLDOWN_SECONDS` | Não | `5` | Janela anti-spam global das ações, de `0` a `3600`. |
| `ALLOW_NSFW` | Não | `false` | Permite rating `r` quando `true`. |
| `ALLOW_UNCATEGORIZED_GIFS` | Não | `true` | Permite reutilizar GIF legado com status `uncategorized` quando compatível. |
| `TECHNICAL_LOG_PATH` | Não | `logs/technical.log` | Caminho do log técnico privado. |
| `DOTENV_CONFIG_PATH` | Não | `.env` | Caminho alternativo do arquivo dotenv; deve ser definido no ambiente do processo. |

O prefixo inicial é `-` e depois pode ser alterado por servidor com `/config prefixo`. O único locale de servidor implementado é `pt-BR`.

## Permissões e intents do Discord

Escopos de instalação:

- `bot`
- `applications.commands`

Permissões do bot:

- Ver canais.
- Enviar mensagens.
- Inserir links.
- Ler histórico de mensagens para o fluxo por prefixo.
- Anexar arquivos para `/exportardados`.

Intents usadas:

- `Guilds`
- `GuildMessages`
- `MessageContent`

Sem **Message Content Intent**, slash commands continuam disponíveis, mas comandos por prefixo podem não ser recebidos. Permissões específicas do canal podem bloquear respostas mesmo que o convite original as tenha concedido.

## Banco de dados

Valide o schema e aplique as migrations versionadas. O script prepara o arquivo SQLite vazio antes de chamar o Prisma Migrate, o que também evita uma falha de criação inicial observada no Windows:

```sh
npm run prisma:validate
npm run prisma:migrate:deploy
```

Com `DATABASE_URL="file:./dev.db"`, o caminho relativo é resolvido pelo Prisma a partir da pasta do schema, portanto o arquivo fica em `prisma/dev.db`. Bancos `*.db`, journals e arquivos SQLite locais são ignorados.

Para inspecionar um banco local:

```sh
npm run prisma -- studio
```

Faça backup do banco antes de migrations em um ambiente que já tenha dados. O projeto não automatiza backup nem restauração.

## Registro dos slash commands

Com `DISCORD_TOKEN` e `DISCORD_CLIENT_ID` configurados:

```sh
npm run deploy:commands
```

Se `DISCORD_DEV_GUILD_ID` estiver preenchido, o script substitui os comandos daquele servidor. Caso contrário, substitui os comandos globais da aplicação. O processo de inicialização não sincroniza comandos automaticamente.

## Execução

Desenvolvimento com recarga:

```sh
npm run dev
```

Execução compilada:

```sh
npm run build
npm run start
```

Antes de conectar ao Discord, o processo valida a configuração, conecta ao SQLite e verifica se as migrations foram aplicadas. Configuração ausente ou banco não preparado encerram o processo com erro, sem imprimir credenciais.

## Comandos disponíveis

### RP, afinidade e ajuda

- `/rp`, `/kiss`, `/hug`, `/beijotesta`, `/beijobochecha`, `/cafune`, `/consolar`, `/proteger`, `/morder` e `/cutucar`.
- `/afinidade`, `/rankafinidade`, `/help` e `/prefixstatus`.
- Os comandos diretos de RP, afinidade, ranking e ajuda também têm forma por prefixo, como `-hug @Usuario` e `-help`.
- A menção ao bot funciona como prefixo auxiliar, por exemplo `@Aurora hug @Usuario`.

As ações não aceitam bots nem o próprio autor como alvo. A resposta pode ficar somente em texto quando não houver GIF utilizável.

O botão **Retribuir** só pode ser usado pelo alvo original, uma vez, durante 15 minutos. Uma tentativa recusada por cooldown, bloqueio ou outra regra libera o botão para uma nova tentativa válida.

### Privacidade e dados próprios

- `/bloquearrp`, `/desbloquearrp` e `/bloquearcategoria`.
- `/preferencias`, `/optout` e `/optin`.
- `/meusdados`, `/exportardados` e `/apagardados confirmacao:APAGAR`.

A exportação é enviada como anexo efêmero. O apagamento remove interações, pares de afinidade, bloqueios criados pelo usuário e estados de botão relacionados; mantém uma preferência mínima de opt-out/ranking oculto e não remove bloqueios criados por terceiros nem a trilha administrativa mínima.

### Administração

Estes comandos exigem `Gerenciar Servidor` por padrão e também validam a permissão no momento da execução:

- GIFs: `/gifadd`, `/gifbuscar`, `/gifaprovar`, `/gifbloquear`, `/gifremove`, `/gifmover`, `/giflist` e `/giftest`.
- Frases: `/fraseadd`, `/fraseremove` e `/fraselist`.
- Servidor: `/config prefixo`, `afinidade`, `gifs`, `categoria`, `canal`, `cooldown`, `idioma`, `mencionar`, `rank` e `reset`.

## Persistência e dados gerados

O SQLite armazena configurações de servidor, preferências, bloqueios, afinidade, interações, metadados e cota de GIFs, frases personalizadas, aliases, estados temporários de botões e logs administrativos.

Os arquivos versionados `data/phrases.json` e `data/giphy-search-terms.json` são dados públicos necessários em runtime. Bancos, logs, arquivos `.env`, mídia baixada e relatórios gerados pela ferramenta de auditoria de GIFs não fazem parte do repositório público.

O log técnico padrão fica em `logs/technical.log`, é ignorado pelo Git e inclui stack traces apenas localmente. Campos com nomes de segredo e valores conhecidos de credenciais são redigidos.

### Seleção e moderação de GIFs

GIFs salvos podem ter status `pending`, `approved`, `blocked`, `disabled` ou `uncategorized`. A resposta pública não mostra URL, provider, nome de arquivo nem identificador interno. Quando a GIPHY está disponível, a origem é escolhida pela quantidade de GIFs aprovados para aquela ação e categoria:

| Aprovados | Banco | Nova busca GIPHY |
| --- | --- | --- |
| 0–19 | 65% | 35% |
| 20–49 | 70% | 30% |
| 50–99 | 75% | 25% |
| 100–199 | 80% | 20% |
| 200 ou mais | 85% | 15% |

Com menos de cinco aprovados, o código prioriza a GIPHY para popular o banco. Sem chave ou cota, usa apenas o banco; se não houver GIF utilizável, envia somente a frase.

## Testes e qualidade

```sh
npm test
npm run lint
npm run format:check
npm run typecheck
npm run build
```

Para executar todas as verificações de código em sequência:

```sh
npm run check
```

Os testes usam `node:test`, não precisam de token, internet, servidor Discord ou conta GIPHY. O lint é uma verificação TypeScript estrita de código não usado, retornos e fallthrough; não é ESLint. A formatação é verificada com Prettier.

## Docker

Preencha `.env` e execute:

```sh
docker compose up -d --build
docker compose logs -f aurora
```

O Compose aplica migrations antes de iniciar o bot. O SQLite fica no volume `aurora-storage`, montado em `/app/storage`, enquanto os JSONs públicos continuam dentro da imagem. O `DATABASE_URL` do contêiner é fixado em `file:/app/storage/aurora.db`; o valor local do `.env` é substituído somente dentro do serviço.

Para parar sem apagar o volume:

```sh
docker compose down
```

Não use `docker compose down -v` se precisar preservar o banco.

## Estrutura do projeto

- `src/commands`: comandos Discord e adaptação das respostas.
- `src/handlers`: eventos de interação, mensagem, guild e prontidão.
- `src/services`: regras de negócio e fronteiras com GIPHY.
- `src/database`: Prisma Client e repositórios.
- `src/config`: validação de ambiente, defaults e ações públicas.
- `src/tools`: ferramenta local de auditoria de GIFs.
- `prisma`: schema e migrations SQLite.
- `data`: frases e termos de busca necessários em runtime.
- `env`: exemplos públicos de configuração.
- `tests`: testes unitários isolados de serviços externos.
- `docs`: documento histórico de design, não uma lista garantida de recursos.

## Problemas comuns

- **`Invalid environment configuration`**: copie o exemplo e preencha as três variáveis obrigatórias.
- **Erro de tabela inexistente ao iniciar**: execute `npm run prisma:migrate:deploy` com o mesmo `DATABASE_URL` usado pelo bot.
- **`Missing Access` ao registrar comandos**: confirme que token e Application ID pertencem à mesma aplicação, que o bot está no servidor de desenvolvimento e que os escopos de instalação estão corretos.
- **Slash command antigo ou indisponível**: execute novamente `npm run deploy:commands` no mesmo escopo em que os comandos foram registrados.
- **Prefixo não responde**: habilite Message Content Intent e confira as permissões do canal e o prefixo atual em `/prefixstatus`.
- **Resposta sem GIF**: configure `GIPHY_API_KEY`, confira a cota e verifique se há conteúdo aprovado para a ação/categoria.
- **`/exportardados` falha**: conceda ao bot a permissão Anexar arquivos no canal.

## Limitações atuais

- Interface e frases são voltadas a `pt-BR`; outros locales não estão implementados.
- SQLite é adequado a uma única instância do bot; execução distribuída não é suportada.
- Não há painel web, backup automático, restore automático ou deploy automático.
- O uso de GIFs externos depende da disponibilidade e dos termos da GIPHY.
- Não existe cobertura de integração ao vivo com Discord no conjunto automatizado; isso exige uma aplicação e um servidor de teste próprios.

## Contribuição e reporte de problemas

Leia [CONTRIBUTING.md](CONTRIBUTING.md) antes de enviar uma alteração. Para falhas que possam expor dados ou credenciais, siga [SECURITY.md](SECURITY.md) e não publique detalhes sensíveis em uma issue aberta.

## Licença

Este repositório ainda não possui uma licença. Isso é um bloqueio jurídico para uso, modificação e redistribuição por terceiros: a disponibilização pública do código, por si só, não concede essas permissões.
