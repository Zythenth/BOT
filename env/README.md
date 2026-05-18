# Env

Esta pasta guarda apenas exemplos e documentacao de configuracao.

Arquivos com token real, chave real da GIPHY, IDs privados ou URLs privadas de banco nao devem ser salvos no repositorio.

## Como usar em desenvolvimento

Copie o exemplo de desenvolvimento para um `.env` real na raiz do projeto:

```txt
env/.env.development.example -> .env
```

Depois preencha no `.env` real:

```env
DISCORD_TOKEN=seu_token_local
DISCORD_CLIENT_ID=id_da_aplicacao
DISCORD_DEV_GUILD_ID=id_do_servidor_de_teste
GIPHY_API_KEY=sua_chave_quando_a_integracao_giphy_for_usada
```

## Arquivos esperados

- `.env.example`: modelo geral minimo.
- `.env.development.example`: modelo para desenvolvimento local.
- `.env.production.example`: modelo para producao.
- `README.md`: esta documentacao.

O `.gitignore` deve manter arquivos `.env` reais ignorados e permitir versionar apenas estes exemplos.
