# Exemplos de ambiente

Esta pasta guarda somente exemplos públicos de configuração. A tabela completa de variáveis e o procedimento de instalação ficam no `README.md` da raiz.

Arquivos com token real, chave real da GIPHY, IDs privados ou URLs privadas de banco nao devem ser salvos no repositorio.

## Como usar em desenvolvimento

Copie o exemplo de desenvolvimento para um `.env` real na raiz do projeto:

No `cmd` do Windows:

```bat
copy env\.env.development.example .env
```

No PowerShell:

```powershell
Copy-Item env\.env.development.example .env
```

Depois preencha no `.env` real. As três variáveis obrigatórias são:

```env
DISCORD_TOKEN=seu_token_local
DISCORD_CLIENT_ID=id_da_aplicacao
DATABASE_URL="file:./dev.db"
```

IDs de servidor, allowlist e GIPHY são opcionais:

```env
DISCORD_DEV_GUILD_ID=id_do_servidor_de_teste
DISCORD_ALLOWED_GUILD_IDS=id_do_servidor_de_teste,outro_servidor_autorizado
GIPHY_API_KEY=sua_chave_de_teste
```

## Como usar em producao

Na VPS, use o exemplo de producao como base:

```bat
copy env\.env.production.example .env
```

Preencha tokens reais somente no `.env` da VPS. Nao envie esse arquivo para Git.

Para aplicar migrations em qualquer instalação a partir do repositório:

```bat
npm run prisma:migrate:deploy
```

## Arquivos esperados

- `.env.example`: modelo geral mínimo.
- `.env.development.example`: modelo para desenvolvimento local.
- `.env.production.example`: modelo para producao.
- `README.md`: esta documentacao.

O `.gitignore` deve manter arquivos `.env` reais ignorados e permitir versionar apenas estes exemplos.

## Cuidados

- `DISCORD_TOKEN` e `GIPHY_API_KEY` sao segredos.
- Se um token vazar, revogue no painel do provider e gere outro.
- `DISCORD_DEV_GUILD_ID` deve apontar para um servidor de teste durante desenvolvimento.
- `DISCORD_ALLOWED_GUILD_IDS` e opcional; quando preenchido, a Aurora ignora/sai de servidores fora da lista.
- `TECHNICAL_LOG_PATH` pode direcionar o log privado para outro caminho.
- `DOTENV_CONFIG_PATH` é lido antes do dotenv e deve ser definido no ambiente do processo, não dentro do próprio arquivo alternativo.
- Para comandos por prefixo, ative Message Content Intent no Discord Developer Portal.
