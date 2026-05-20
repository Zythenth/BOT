# Env

Esta pasta guarda apenas exemplos e documentacao de configuracao.

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

Depois preencha no `.env` real:

```env
DISCORD_TOKEN=seu_token_local
DISCORD_CLIENT_ID=id_da_aplicacao
DISCORD_DEV_GUILD_ID=id_do_servidor_de_teste
GIPHY_API_KEY=sua_chave_quando_a_integracao_giphy_for_usada
```

Tambem confirme:

```env
DATABASE_URL="file:./dev.db"
GIF_PROVIDER=giphy
GIPHY_REQUESTS_PER_HOUR=100
ALLOW_NSFW=false
ALLOW_UNCATEGORIZED_GIFS=true
```

## Como usar em producao

Na VPS, use o exemplo de producao como base:

```bat
copy env\.env.production.example .env
```

Preencha tokens reais somente no `.env` da VPS. Nao envie esse arquivo para Git.

Para aplicar migrations em producao, prefira:

```bat
npm run prisma -- migrate deploy
```

## Arquivos esperados

- `.env.example`: modelo geral minimo.
- `.env.development.example`: modelo para desenvolvimento local.
- `.env.production.example`: modelo para producao.
- `README.md`: esta documentacao.

O `.gitignore` deve manter arquivos `.env` reais ignorados e permitir versionar apenas estes exemplos.

## Cuidados

- `DISCORD_TOKEN` e `GIPHY_API_KEY` sao segredos.
- Se um token vazar, revogue no painel do provider e gere outro.
- `DISCORD_DEV_GUILD_ID` deve apontar para um servidor de teste durante desenvolvimento.
- Para comandos por prefixo, ative Message Content Intent no Discord Developer Portal.
