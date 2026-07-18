# Contribuindo com a Aurora

Obrigado pelo interesse. Antes de alterar código, abra ou consulte uma issue para confirmar o comportamento esperado, especialmente em regras de afinidade, privacidade, persistência e moderação de GIFs.

## Ambiente local

1. Instale Node.js 22.11 ou superior dentro da linha 22.x.
2. Execute `npm ci`.
3. Copie `env/.env.example` para `.env` e use apenas credenciais de uma aplicação de teste própria.
4. Execute `npm run prisma:migrate:deploy`.
5. Rode `npm run check` antes de enviar a mudança.

Testes automatizados não devem usar internet, token real, conta pessoal, servidor externo ou banco privado. Use mocks somente nas fronteiras com Discord e GIPHY.

## Escopo das mudanças

- Preserve a separação entre comandos, handlers, services e repositories.
- Inclua teste de regressão para correções funcionais.
- Atualize README e exemplos de ambiente quando um comando ou variável mudar.
- Não versione `.env`, SQLite, logs, exportações, mídia baixada ou relatórios gerados.
- Não inclua prompts, transcrições, segredos ou dados pessoais.
- Não misture atualização ampla de dependências com uma correção não relacionada.

## Verificação

```sh
npm run prisma:validate
npm run check
git diff --check
```

Explique no pull request o problema, a solução, os testes executados e qualquer risco restante. Consulte `SECURITY.md` antes de relatar uma falha que possa ter impacto sobre credenciais ou dados.

## Licença pendente

O projeto ainda não tem licença. Até uma licença ser definida pelo responsável, não presuma permissão para usar, modificar ou redistribuir o código fora do processo de contribuição aceito pelo mantenedor.
