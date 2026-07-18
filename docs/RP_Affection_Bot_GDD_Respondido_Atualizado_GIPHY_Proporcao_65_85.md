# GDD respondido - Aurora

> **Documento histórico de design.** Este arquivo registra decisões e também pode conter itens planejados ou desatualizados. Ele não garante que uma funcionalidade esteja implementada. Para instalação, configuração, comandos e limitações verificadas, consulte o `README.md` da raiz e o código atual.

Documento de decisões para o bot de roleplay fofo no Discord. O nome final do bot é **Aurora**. **RP Affection Bot** permanece apenas como nome antigo/codename histórico do projeto, não como nome público final.

## Resumo das decisões principais

- **Nome final:** Aurora.
- **Nome antigo/codename:** RP Affection Bot.
- **Linguagem:** TypeScript com Node.js.
- **Biblioteca Discord:** discord.js.
- **ORM:** Prisma.
- **Hospedagem:** VPS com Docker.
- **Banco:** SQLite no MVP.
- **Comandos:** slash `/` e prefixo `-` desde a primeira versão.
- **Prefixo padrão:** `-`, configurável por servidor.
- **Arquitetura:** modular, com comandos, handlers, services, repositories, config, types e utils separados. O projeto não deve virar um arquivo único gigante. Comandos slash e prefixo devem chamar a mesma lógica, sem regra de negócio duplicada.
- **GIFs:** GIPHY API com chave beta de 100 chamadas por hora, catálogo persistente no banco de dados, status por GIF e categorização corrigível por administradores.
- **Visual das ações:** embed/card de RP com frase principal, GIF grande e botão `😊 Retribuir`, sem exibir fonte, URL, arquivo, ID do GIF ou dica/configuração de gênero para o usuário final.
- **Botão Retribuir:** toda ação de RP deve incluir botão `😊 Retribuir`; somente o alvo original pode clicar, e o clique chama `actionService` com autor/alvo invertidos.
- **Afinidade:** bidirecional, separada por servidor, com limite de 1000 pontos.
- **Perda de pontos:** não haverá perda automática.
- **Privacidade:** usuários poderão bloquear interações, ocultar ranking, exportar e apagar dados.
- **MVP:** hug, beijotesta, beijobochecha, cafune, consolar, proteger, morder, cutucar, afinidade, rankafinidade, help, GIPHY + banco de GIFs categorizados, botão Retribuir e bloqueio pessoal.

## Atualização — sistema de GIFs com GIPHY

- **Fonte externa:** GIPHY API no MVP, usando chave beta de 100 chamadas por hora.
- **Tenor:** não será usado no MVP.
- **Configuração:** a chave da GIPHY fica somente em `.env`; a pasta `env/` deve conter exemplos de configuração e nenhum token real deve ser versionado.
- **Persistência:** GIFs não ficam só em cache; todo GIF importado/usado deve gerar registro no banco.
- **O que salvar:** salvar `provider`, `providerGifId`, ação, categoria, status, termo de busca, rating, contadores de uso e datas. Não depender de cache volátil que apaga ao reiniciar. Não baixar milhares de arquivos para a VPS. Não salvar cópias dos arquivos nem tratar URLs de mídia como permanentes; o banco deve guardar a classificação e o ID do GIF.
- **Status do GIF:** `pending`, `approved`, `blocked`, `disabled` ou `uncategorized`.
- **Categoria corrigível:** se um GIF vier para `kiss`, mas servir melhor para `beijotesta`, administrador pode mover com `/gifmover`.
- **Proporção progressiva:** o bot começa usando 65% GIFs aprovados do banco e 35% GIFs novos da GIPHY. Conforme a ação/categoria tiver mais GIFs aprovados, o uso do banco aumenta gradualmente até o máximo de 85% banco e 15% GIPHY, sempre respeitando a cota de 100 chamadas por hora.
- **Separação de ações:** `kiss` significa beijo na boca/selinho romântico leve; `beijotesta` significa beijo na testa; `beijobochecha` significa beijo na bochecha. Cada ação tem termos de busca próprios.
- **Termos de busca:** os termos devem ficar em `data/giphy-search-terms.json` e não devem misturar `kiss`, `beijotesta` e `beijobochecha`.

Exemplo de `data/giphy-search-terms.json`:

```json
{
  "kiss": [
    "anime kiss",
    "cute anime kiss",
    "romantic anime kiss"
  ],
  "beijotesta": [
    "forehead kiss anime",
    "anime forehead kiss",
    "cute forehead kiss"
  ],
  "beijobochecha": [
    "cheek kiss anime",
    "anime cheek kiss",
    "cute cheek kiss"
  ],
  "hug": [
    "anime hug",
    "comfort hug anime",
    "cute hug"
  ],
  "cafune": [
    "anime head pat",
    "headpat anime",
    "pat head cute"
  ]
}
```

Regra de proporção progressiva por ação/categoria:

```txt
0–19 GIFs aprovados: 65% banco / 35% GIPHY nova
20–49 GIFs aprovados: 70% banco / 30% GIPHY nova
50–99 GIFs aprovados: 75% banco / 25% GIPHY nova
100–199 GIFs aprovados: 80% banco / 20% GIPHY nova
200+ GIFs aprovados: 85% banco / 15% GIPHY nova
```

Exemplo: se `kiss` tiver poucos GIFs aprovados, o bot ainda buscará mais novidades na GIPHY. Se `beijotesta` já tiver muitos GIFs aprovados e bem categorizados, o bot usará mais o banco e menos chamadas externas.

Se a cota de 100 chamadas por hora acabar, a Aurora deve usar apenas GIFs `approved` já existentes no banco. Se não houver GIF aprovado para aquela `action/category` e não puder buscar na GIPHY, deve enviar apenas texto, sem expor erro técnico ao usuário.

## Ambiente e variáveis

A pasta `env/` deve existir apenas com exemplos e documentação. Tokens reais e chaves reais nunca devem ser salvos no repositório.

Estrutura obrigatória:

```txt
env/
├─ .env.example
├─ .env.development.example
├─ .env.production.example
└─ README.md
```

Conteúdo mínimo de `env/.env.example`:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_DEV_GUILD_ID=
DATABASE_URL="file:./dev.db"

GIF_PROVIDER=giphy
GIPHY_API_KEY=
GIPHY_REQUESTS_PER_HOUR=100
GIPHY_RATING=pg
GIPHY_LANG=pt

GIF_DB_MIN_RATIO=0.65
GIF_DB_MAX_RATIO=0.85
GIF_GIPHY_MIN_RATIO=0.15
GIF_GIPHY_MAX_RATIO=0.35

ALLOW_NSFW=false
ALLOW_UNCATEGORIZED_GIFS=true
```

## Resposta visual de RP

Depois que um usuário usar qualquer ação de RP, como `/hug`, `-hug`, `/beijotesta`, `-cafune`, `/morder` ou `-consolar`, a Aurora deve responder com um embed/card visual limpo, parecido com bots de RP:

- frase principal no topo;
- menção ou nome do autor, conforme configuração do servidor;
- ação executada;
- menção ou nome do alvo, conforme configuração do servidor;
- GIF grande dentro do embed;
- botão `😊 Retribuir` abaixo do embed.

Exemplo esperado:

```txt
@UsuarioA abraçou @UsuarioB!
[GIF grande da ação]
[😊 Retribuir]
```

A resposta pública não deve mostrar botão de fonte da imagem, dica de gênero, configuração de gênero, nome de arquivo, URL do GIF, `provider_gif_id`, `providerGifId` ou qualquer identificador interno. A experiência pública deve ser limpa e focada na ação.

## Botão Retribuir

Toda ação de RP deve ter botão `😊 Retribuir`.

Funcionamento obrigatório:

- Se UsuarioA usa `/hug @UsuarioB`, o embed mostra “UsuarioA abraçou UsuarioB!”.
- O botão permite que UsuarioB retribua a mesma ação em UsuarioA.
- Ao clicar, a Aurora executa a mesma ação invertendo autor e alvo.
- Exemplo de retribuição: “UsuarioB retribuiu o abraço em UsuarioA!”.
- A retribuição também mostra GIF e pode gerar afinidade.
- A retribuição deve respeitar cooldown, bloqueios, consentimento, opt-out, limite diário e limite máximo de pontos.
- Apenas o alvo original pode clicar em `Retribuir`.
- Se outra pessoa clicar, a resposta deve ser efêmera: “Só quem recebeu essa ação pode retribuir.”
- Se o alvo tiver bloqueado a categoria, a retribuição não deve acontecer.
- Se a ação for romântica, a retribuição deve respeitar opt-in/consentimento.
- Se o botão expirar, a Aurora deve mostrar erro efêmero curto.
- O botão pode gerar nova resposta com botão, mas deve respeitar cooldown para evitar loops e spam.
- O `customId` deve guardar informações mínimas e seguras: `action`, autor original, alvo original, `guildId` e timestamp.
- Dados sensíveis não devem ser salvos no `customId`.
- Para dados longos ou estado complexo, usar registro temporário no banco, como tabela `ButtonInteractionState`.
- O botão não duplica regra de negócio: `retributeService` valida o clique e chama `actionService` com autor e alvo invertidos.

## Respostas numeradas

## 1. Visão geral do bot
1. **Qual será o nome final do bot?**  
   **Resposta:** Aurora. RP Affection Bot fica apenas como nome antigo/codename histórico.
2. **O bot terá avatar próprio?**  
   **Resposta:** Sim. Terá avatar próprio em estilo fofo/anime, sem usar arte protegida sem permissão.
3. **O bot terá uma descrição curta para o perfil do Discord?**  
   **Resposta:** Sim: "Aurora é um bot privado de roleplay fofo com GIFs, afinidade e comandos de carinho para Discord."
4. **O tom do bot será mais fofo, romântico, engraçado, anime, neutro ou misto?**  
   **Resposta:** Misto: fofo, anime e engraçado, com romance leve configurável e tom sempre seguro.
5. **O bot será usado em apenas um servidor ou em vários servidores privados?**  
   **Resposta:** Vários servidores privados autorizados por allowlist.
6. **O bot terá idioma principal em português, inglês ou ambos?**  
   **Resposta:** Português do Brasil como idioma principal, com aliases em inglês.
7. **Os comandos terão respostas apenas em português ou poderão variar entre português e inglês?**  
   **Resposta:** Português por padrão; inglês poderá ser ativado por configuração de servidor no futuro.
8. **O bot terá personalidade própria nas mensagens ou apenas narrará ações entre usuários?**  
   **Resposta:** Terá personalidade leve de narrador fofo, sem falar como personagem principal.
9. **O objetivo principal é roleplay fofo?**  
   **Resposta:** Sim. Esse é o objetivo central.
10. **O objetivo principal é criar afinidade entre membros?**  
   **Resposta:** Sim. A afinidade será um sistema secundário para estimular interações.
11. **O objetivo principal é gerar interações com GIFs?**  
   **Resposta:** Sim. Os GIFs serão parte principal da experiência visual.
12. **O bot terá foco em servidores de amizade, namoro RP, anime, comunidade geral ou uso pessoal?**  
   **Resposta:** Foco em servidores de amizade, anime, comunidade geral e RP leve; não será voltado a conteúdo adulto.
13. **O bot deve evitar qualquer interação adulta, explícita ou pesada?**  
   **Resposta:** Sim. O bot deve bloquear conteúdo adulto, explícito, pesado, violento ou sugestivo.

## 2. Tecnologia da aplicação
14. **Qual linguagem será usada para desenvolver o bot?**  
   **Resposta:** TypeScript.
15. **A preferência é por JavaScript, TypeScript, Python ou outra linguagem?**  
   **Resposta:** TypeScript com Node.js.
16. **A escolha da linguagem deve priorizar facilidade, estabilidade, performance ou manutenção?**  
   **Resposta:** Prioridade: manutenção e estabilidade; depois facilidade e performance.
17. **O bot será feito com Node.js?**  
   **Resposta:** Sim. Será feito com Node.js.
18. **O bot será feito com TypeScript para ter tipagem melhor?**  
   **Resposta:** Sim. TypeScript será usado para tipagem e manutenção melhor.
19. **O bot será feito com Python por simplicidade?**  
   **Resposta:** Não na versão principal. Python fica descartado para manter o ecossistema em discord.js.
20. **Quem vai manter o código entende melhor qual linguagem?**  
   **Resposta:** Quem mantiver o código deve entender JavaScript/TypeScript básico e estrutura de bots Discord.
21. **Qual biblioteca será usada para conectar o bot ao Discord?**  
   **Resposta:** discord.js.
22. **Se for Node.js, será usado discord.js?**  
   **Resposta:** Sim. Se for Node.js, a biblioteca será discord.js.
23. **Se for Python, será usado discord.py, py-cord ou outra biblioteca?**  
   **Resposta:** Não se aplica ao projeto principal, porque Python não será usado.
24. **A biblioteca escolhida suporta slash commands?**  
   **Resposta:** Sim. discord.js suporta slash commands.
25. **A biblioteca escolhida suporta comandos por prefixo?**  
   **Resposta:** Sim. O prefixo será tratado pelo evento de mensagens.
26. **A biblioteca escolhida permite registrar aliases facilmente?**  
   **Resposta:** Sim. Aliases serão resolvidos por um mapa interno.
27. **A biblioteca escolhida permite intents necessárias para ler comandos por prefixo?**  
   **Resposta:** Sim. A biblioteca permite usar as intents necessárias.
28. **O bot precisará da intent de conteúdo de mensagem para comandos -?**  
   **Resposta:** Sim. Para comandos com `-`, será necessária a Message Content Intent.
29. **Como será feita a sincronização dos slash commands?**  
   **Resposta:** Por script de deploy e sincronização no startup; em desenvolvimento por servidor, em produção para servidores autorizados.
30. **Onde o bot será hospedado?**  
   **Resposta:** Em uma VPS pequena rodando Docker.
31. **O bot rodará localmente no computador?**  
   **Resposta:** Apenas para desenvolvimento e testes locais.
32. **O bot rodará em VPS?**  
   **Resposta:** Sim. A produção ficará em VPS.
33. **O bot rodará em Docker?**  
   **Resposta:** Sim. Docker será usado para facilitar deploy e reinício.
34. **O bot precisa ficar online 24/7?**  
   **Resposta:** Sim. O objetivo é 24/7.
35. **Como o bot será reiniciado se cair?**  
   **Resposta:** Com Docker restart policy e, se possível, systemd.
36. **Haverá logs de erro?**  
   **Resposta:** Sim. Haverá logs em console, arquivo e canal privado de logs.
37. **Haverá backup automático dos dados?**  
   **Resposta:** Sim. Backup automático do banco e dos arquivos de configuração.
38. **O bot terá arquivo .env para token e configurações privadas?**  
   **Resposta:** Sim. Token, IDs sensíveis e configs privadas ficarão em `.env`.
39. **Quem terá acesso ao token do bot?**  
   **Resposta:** Apenas o dono/desenvolvedor responsável.
40. **Qual banco de dados será usado?**  
   **Resposta:** SQLite no MVP.
41. **SQLite é suficiente por ser um bot privado?**  
   **Resposta:** Sim. SQLite é suficiente para bot privado.
42. **Qual ORM será usado?**  
   **Resposta:** Prisma, com schema em `prisma/schema.prisma` e migrações versionadas.
43. **PostgreSQL seria necessário?**  
   **Resposta:** Não no MVP. PostgreSQL só seria necessário se o bot crescesse muito.
44. **Os dados de afinidade serão salvos por servidor?**  
   **Resposta:** Sim. Afinidade será separada por servidor.
45. **Os dados de usuários serão salvos globalmente?**  
   **Resposta:** Preferências pessoais podem ser globais; afinidade será por servidor.
46. **O banco guardará apenas IDs do Discord ou também nomes?**  
   **Resposta:** Principalmente IDs do Discord; nomes não serão fonte de verdade.
47. **O bot deve funcionar mesmo se o usuário mudar de nome?**  
   **Resposta:** Sim. Como o bot usa IDs, mudança de nome não quebra dados.
48. **O banco terá backups?**  
   **Resposta:** Sim. Backups automáticos e exportação manual.
49. **O banco terá limpeza de dados?**  
   **Resposta:** Sim. Limpeza para logs antigos, histórico antigo e dados de usuários removidos conforme política.
50. **O banco terá migrações de versão?**  
   **Resposta:** Sim. Migrações simples versionadas para o SQLite.

## 3. Escopo privado e uso controlado da GIPHY API
51. **O bot será adicionado manualmente apenas em servidores autorizados?**  
   **Resposta:** Sim. Convite controlado e servidores autorizados.
52. **Haverá uma lista de servidores permitidos?**  
   **Resposta:** Sim. Uma allowlist de guild IDs.
53. **O bot deve sair automaticamente de servidores não autorizados?**  
   **Resposta:** Sim. Se entrar em servidor não autorizado, deve sair ou desativar comandos.
54. **Apenas o dono poderá configurar o bot?**  
   **Resposta:** O dono global configura o bot; no servidor, administradores autorizados configuram opções locais.
55. **Alguns administradores do servidor poderão configurar o bot?**  
   **Resposta:** Sim. Administradores ou cargos gerenciadores poderão configurar.
56. **O bot terá comandos bloqueados para usuários comuns?**  
   **Resposta:** Sim. Comandos administrativos serão bloqueados para usuários comuns.
57. **O uso de GIPHY/API externa está permitido no MVP?**  
   **Resposta:** Sim. O MVP usará GIPHY API, com chave beta limitada a 100 chamadas por hora. Não usará Tenor no MVP.
58. **Todos os GIFs serão armazenados manualmente em listas aprovadas?**  
   **Resposta:** Não apenas manualmente. GIFs vindos da GIPHY serão salvos no banco com status, ação, categoria e metadados; GIFs aprovados terão prioridade.
59. **Os GIFs serão links fixos?**  
   **Resposta:** Não como regra principal. O banco salvará `provider`, `providerGifId`, ação, categoria, status e metadados; a URL de mídia será obtida/renovada pela GIPHY quando necessário.
60. **Os GIFs serão arquivos locais enviados pelo bot?**  
   **Resposta:** Não no MVP. O padrão será GIPHY + banco de dados. Arquivos locais ficam opcionais para fallback futuro.
61. **Os GIFs serão hospedados em algum lugar privado?**  
   **Resposta:** Não. O MVP não hospedará cópias privadas dos GIFs; usará IDs/metadados da GIPHY salvos no banco.
62. **O bot poderá usar apenas URLs de GIFs já aprovados?**  
   **Resposta:** Não. O bot poderá usar GIFs aprovados do banco e uma porcentagem controlada de GIFs novos da GIPHY ainda não categorizados. A proporção começa em 65% banco / 35% GIPHY e sobe até 85% banco / 15% GIPHY conforme a ação/categoria tiver mais GIFs aprovados, respeitando rating seguro e limite de requisições.
63. **Quem aprovará os GIFs?**  
   **Resposta:** Dono do bot, administradores autorizados ou cargo gerenciador definido no servidor.
64. **Como novos GIFs serão adicionados?**  
   **Resposta:** Por `/gifbuscar` usando GIPHY, por `/gifadd` manual, ou por importação automática limitada. Todo GIF salvo no banco terá status e categoria.
65. **Como GIFs ruins serão removidos?**  
   **Resposta:** Por `/gifbloquear`, `/gifremove` ou desativação. GIF errado também poderá ser movido para outra ação/categoria com `/gifmover`.
66. **O bot terá comando interno para cadastrar GIF?**  
   **Resposta:** Sim. `/gifadd` para adicionar manualmente e `/gifbuscar` para buscar/importar da GIPHY.
67. **O bot terá comando interno para listar GIFs cadastrados?**  
   **Resposta:** Sim. `/giflist`, com filtros por ação, categoria, status e origem.
68. **O bot terá comando interno para remover GIF?**  
   **Resposta:** Sim. `/gifremove`, `/gifbloquear` e `/gifmover` para recategorizar sem perder o GIF.
69. **O bot terá fallback se uma ação não tiver GIF cadastrado?**  
   **Resposta:** Sim. Primeiro tenta banco aprovado; se faltar, pode buscar na GIPHY dentro da cota. Se a cota acabar ou não houver resultado seguro, envia apenas texto.

## 4. Sistema de comandos
70. **O bot terá slash commands / e comandos por prefixo - ao mesmo tempo?**  
   **Resposta:** Sim. Slash `/` e prefixo `-` funcionarão juntos.
71. **Os dois modos terão exatamente os mesmos comandos?**  
   **Resposta:** No MVP, sim para os comandos principais; comandos administrativos podem começar só em slash.
72. **Algum comando existirá apenas em slash?**  
   **Resposta:** Sim. Alguns comandos administrativos e de configuração serão apenas slash.
73. **Algum comando existirá apenas por prefixo?**  
   **Resposta:** Não no MVP; prefixo terá principalmente ações de RP e consultas rápidas.
74. **O prefixo será sempre -?**  
   **Resposta:** O padrão será `-`.
75. **O prefixo poderá ser configurado por servidor?**  
   **Resposta:** Sim. Poderá ser configurado por servidor.
76. **O bot responderá a mensagens com prefixo errado?**  
   **Resposta:** Não. Prefixo errado será ignorado para evitar spam.
77. **O bot ignorará bots?**  
   **Resposta:** Sim. Mensagens de bots serão ignoradas.
78. **O bot ignorará comandos enviados em DM?**  
   **Resposta:** Sim. Comandos de RP em DM serão ignorados.
79. **O bot funcionará em DM ou apenas em servidores?**  
   **Resposta:** Apenas em servidores.
80. **Todo comando de ação exigirá um usuário alvo?**  
   **Resposta:** Sim. Ações de RP exigem alvo, exceto comandos como perfil, ajuda e ranking.
81. **O usuário poderá usar o comando em si mesmo?**  
   **Resposta:** Não. Auto-interação não contará e será bloqueada nos comandos de ação.
82. **O bot permitirá interações com bots?**  
   **Resposta:** Não. Interações com bots serão bloqueadas.
83. **O bot permitirá interação com o próprio bot?**  
   **Resposta:** Não. O bot não aceitará ações direcionadas a ele mesmo.
84. **O bot impedirá comandos sem menção?**  
   **Resposta:** Sim. Comandos de ação sem alvo retornam erro curto.
85. **O bot aceitará ID de usuário além de menção?**  
   **Resposta:** Sim. Menção e ID serão aceitos.
86. **O bot aceitará nome de usuário além de menção?**  
   **Resposta:** Não como padrão, porque nomes são ambíguos; pode existir autocomplete em slash.
87. **O bot aceitará mensagem personalizada junto com a ação?**  
   **Resposta:** Sim. Mensagem curta opcional, filtrada contra termos proibidos.
88. **O bot terá respostas aleatórias por comando?**  
   **Resposta:** Sim. Cada comando terá frases aleatórias.
89. **Quantas frases cada comando deve ter?**  
   **Resposta:** Mínimo de 5 frases por comando no MVP; ideal de 10 por comando.
90. **Cada comando terá GIF aleatório?**  
   **Resposta:** Sim. GIF aleatório respeitando proporção progressiva entre banco aprovado e busca GIPHY nova, começando em 65% banco / 35% GIPHY e subindo até 85% banco / 15% GIPHY conforme a ação/categoria tiver mais GIFs aprovados.
91. **Cada comando terá ganho de afinidade próprio?**  
   **Resposta:** Sim. Cada ação terá pontuação própria, herdando um padrão da categoria.
92. **A resposta será mensagem simples ou embed?**  
   **Resposta:** Embed/card visual por padrão; mensagem simples apenas como fallback quando o bot não puder enviar embed.
93. **O GIF aparecerá dentro do embed ou abaixo da mensagem?**  
   **Resposta:** Dentro do embed como imagem principal grande.
94. **A mensagem mostrará avatar do autor?**  
   **Resposta:** Sim. O autor aparecerá no cabeçalho do embed.
95. **A mensagem mostrará avatar do alvo?**  
   **Resposta:** Sim. O alvo poderá aparecer como thumbnail ou no texto.
96. **A mensagem mostrará o total de afinidade?**  
   **Resposta:** Sim, quando afinidade estiver ativa.
97. **A mensagem mostrará quanto de afinidade foi ganho?**  
   **Resposta:** Sim. Exibirá `+N afinidade`.
98. **A mensagem mostrará o marco atual da relação?**  
   **Resposta:** Sim. Exibirá o marco atual quando houver pontos.
99. **A mensagem terá botões?**  
   **Resposta:** Sim. Toda ação de RP no MVP terá botão `😊 Retribuir` abaixo do embed.
100. **A mensagem terá reações automáticas?**  
   **Resposta:** Não no MVP. Reações automáticas ficam desativadas por padrão.
101. **A resposta deve mencionar os usuários diretamente?**  
   **Resposta:** Sim, com menção direta por padrão.
102. **As mensagens devem evitar ping real usando nomes em vez de menções?**  
   **Resposta:** Pode ser configurado para usar nomes sem ping.
103. **O bot deve permitir configurar se menciona ou não os usuários?**  
   **Resposta:** Sim. Configuração `mencionar` por servidor.

### Regras do botão Retribuir nos comandos

- `interactionHandler.ts` deve lidar com slash commands e button interactions.
- `buttonService.ts` deve criar os botões de ação.
- `retributeService.ts` deve processar o botão `😊 Retribuir`.
- `actionService.ts` deve continuar sendo a única fonte da lógica de ação.
- O botão `Retribuir` não deve duplicar regra de negócio.
- Ao clicar em `Retribuir`, `retributeService` chama `actionService` com autor e alvo invertidos.
- Se outra pessoa clicar no botão, a resposta deve ser efêmera: “Só quem recebeu essa ação pode retribuir.”
- O botão deve respeitar cooldown, bloqueios, consentimento, opt-out, limites de pontos e expiração.
- O `customId` deve conter apenas dados mínimos e seguros; estado grande deve ir para `ButtonInteractionState` ou tabela temporária equivalente.

## 5. Lista de comandos de carinho fofo
104. **/hug e -hug: abraçar outro usuário?**  
   **Resposta:** Sim. `/hug` e `-hug` serão comando principal de abraço.
105. **abraçar, abraco e abraço serão aliases de hug?**  
   **Resposta:** Sim. No prefixo, `-abraçar`, `-abraco` e `-abraço` apontam para `hug`; em slash, aliases aparecem via `/rp ação` com autocomplete quando não forem comandos diretos.
106. **/abraco e /abraço devem ser slash commands separados?**  
   **Resposta:** Não obrigatoriamente. O slash principal do MVP é `/hug`; nomes alternativos devem ser resolvidos por `/rp ação` ou autocomplete para evitar excesso de comandos.
107. **Aliases com acento e sem acento devem funcionar?**  
   **Resposta:** Sim. Prefix commands aceitam acento e sem acento; slash commands usam nomes principais sem acento sempre que possível.
108. **/beijotesta e -beijotesta: beijo na testa?**  
   **Resposta:** Sim. Comando principal de beijo na testa.
109. **foreheadkiss e bjt serão aliases de beijo na testa?**  
   **Resposta:** Sim. `-foreheadkiss` e `-bjt` apontam para `beijotesta`; em slash, podem aparecer no autocomplete de `/rp ação`.
110. **/bjt precisa existir como slash command separado?**  
   **Resposta:** Não no MVP. O slash principal é `/beijotesta`.
111. **/beijobochecha e -beijobochecha: beijo na bochecha?**  
   **Resposta:** Sim. Comando principal de beijo na bochecha.
112. **cheekkiss e bjb serão aliases de beijo na bochecha?**  
   **Resposta:** Sim. `-cheekkiss` e `-bjb` apontam para `beijobochecha`; em slash, podem aparecer no autocomplete de `/rp ação`.
113. **/bjb precisa existir como slash command separado?**  
   **Resposta:** Não no MVP. O slash principal é `/beijobochecha`.
114. **/cafune e -cafune: fazer cafuné?**  
   **Resposta:** Sim. Comando principal de cafuné.
115. **cafuné, headpat e pat serão aliases de cafune?**  
   **Resposta:** Sim. `-cafuné`, `-headpat` e `-pat` apontam para `cafune`; em slash, podem aparecer no autocomplete de `/rp ação`.
116. **/cafuné precisa existir como slash command separado?**  
   **Resposta:** Não no MVP. O slash principal é `/cafune`.
117. **/headpat e /pat precisam existir como slash commands separados?**  
   **Resposta:** Não no MVP. O slash principal é `/cafune`; aliases extras ficam no prefixo e no autocomplete.
118. **/colo e -colo: colocar o alvo no colo ou oferecer colo?**  
   **Resposta:** Sim. Ação de oferecer colo/aconchego, com frase não íntima.
119. **/segurarmao e -segurarmao: segurar a mão?**  
   **Resposta:** Sim. Comando de segurar a mão.
120. **/segurar-mao e -segurar-mao: alias com hífen?**  
   **Resposta:** Sim. Alias com hífen de `segurarmao`.
121. **/carinho e -carinho: ação aleatória de carinho?**  
   **Resposta:** Sim. Ação aleatória de carinho.
122. **/acariciar e -acariciar: carinho direto?**  
   **Resposta:** Sim. Ação direta de carinho.
123. **/boanoite e -boanoite: desejar boa noite de forma fofa?**  
   **Resposta:** Sim. Boa noite fofa, com alvo opcional.
124. **/bomdia e -bomdia: desejar bom dia de forma fofa?**  
   **Resposta:** Sim. Bom dia fofo, com alvo opcional.
125. **/mimo e -mimo: mimar o alvo?**  
   **Resposta:** Sim. Ação de mimar o alvo.
126. **/aconchegar e -aconchegar: aconchegar o alvo?**  
   **Resposta:** Sim. Ação de aconchegar.
127. **/apertarbochecha e -apertarbochecha: apertar bochecha de forma fofa?**  
   **Resposta:** Sim. Ação fofa de apertar bochecha.

## 6. Lista de comandos de romance leve
128. **/selinho e -selinho: dar selinho?**  
   **Resposta:** Sim. Selinho leve, condicionado à categoria romântica ativa e consentimento.
129. **/kiss e -kiss: alias geral de beijo leve?**  
   **Resposta:** Sim. Alias geral de beijo leve.
130. **/abracoapertado e -abracoapertado: abraço mais intenso e fofo?**  
   **Resposta:** Sim. Abraço apertado fofo.
131. **/olhar e -olhar: olhar com carinho?**  
   **Resposta:** Sim. Olhar com carinho.
132. **/carinhonorosto e -carinhonorosto: acariciar o rosto?**  
   **Resposta:** Sim. Carinho no rosto, com frase leve.
133. **/flertar e -flertar: flerte leve?**  
   **Resposta:** Sim. Flerte leve, sem teor adulto.
134. **/elogiar e -elogiar: elogiar o alvo?**  
   **Resposta:** Sim. Elogio respeitoso.
135. **/corar e -corar: ficar corado por causa do alvo?**  
   **Resposta:** Sim. Ação de corar.
136. **/maosdadas e -maosdadas: andar de mãos dadas?**  
   **Resposta:** Sim. Mãos dadas.
137. **/encostar e -encostar: encostar no ombro do alvo?**  
   **Resposta:** Sim. Encostar no ombro de forma leve.
138. **/sorrir e -sorrir: sorrir para o alvo?**  
   **Resposta:** Sim. Sorrir para o alvo.
139. **/presente e -presente: dar presente simbólico?**  
   **Resposta:** Sim. Presente simbólico.
140. **/flor e -flor: entregar uma flor?**  
   **Resposta:** Sim. Entregar flor.
141. **/dancar e -dancar: dançar com o alvo?**  
   **Resposta:** Sim. Dançar com o alvo.
142. **/saudade e -saudade: demonstrar saudade?**  
   **Resposta:** Sim. Demonstrar saudade de forma leve.
143. **Quais comandos românticos serão permitidos?**  
   **Resposta:** Permitidos: selinho, kiss leve, abraço apertado, olhar, carinho no rosto, flertar leve, elogiar, corar, mãos dadas, flor, presente, dança e saudade.
144. **Quais comandos serão considerados românticos demais?**  
   **Resposta:** Comandos sexuais, possessivos, explícitos, muito íntimos ou com pressão emocional serão considerados românticos demais e não entrarão.
145. **O servidor poderá desativar a categoria romântica?**  
   **Resposta:** Sim. A categoria romântica poderá ser desativada por servidor.
146. **O bot terá aviso de consentimento para comandos românticos?**  
   **Resposta:** Sim. Romance terá política de consentimento/opt-in configurável.
147. **O usuário poderá bloquear interações românticas recebidas?**  
   **Resposta:** Sim. Usuários poderão bloquear romance recebido.

## 7. Lista de comandos de brincadeira
148. **/morder e -morder: morder de brincadeira?**  
   **Resposta:** Sim. Morder de brincadeira, com texto claramente leve.
149. **/bite e -bite: alias de morder?**  
   **Resposta:** Sim. Alias de morder.
150. **/cutucar e -cutucar: cutucar o alvo?**  
   **Resposta:** Sim. Cutucar o alvo.
151. **/poke e -poke: alias de cutucar?**  
   **Resposta:** Sim. Alias de cutucar.
152. **/bagunçar e -bagunçar: bagunçar cabelo?**  
   **Resposta:** Sim. Bagunçar cabelo.
153. **/baguncar e -baguncar: alias sem acento?**  
   **Resposta:** Sim. Alias sem acento.
154. **/puxarbochecha e -puxarbochecha: puxar bochecha?**  
   **Resposta:** Sim. Puxar bochecha de forma cômica.
155. **/provocar e -provocar: provocar de brincadeira?**  
   **Resposta:** Sim. Provocar de brincadeira.
156. **/zoar e -zoar: zoar levemente?**  
   **Resposta:** Sim. Zoar levemente, sem humilhação.
157. **/tapa e -tapa: tapinha cômico ou será proibido?**  
   **Resposta:** Proibido no padrão do MVP; pode virar `tapinha` leve se o servidor ativar.
158. **/tapinha e -tapinha: versão leve de tapa?**  
   **Resposta:** Sim, mas opcional e sem ponto por padrão.
159. **/beliscar e -beliscar: beliscar de brincadeira?**  
   **Resposta:** Sim. Beliscar de brincadeira com frase leve.
160. **/roubarcoberta e -roubarcoberta: roubar coberta?**  
   **Resposta:** Sim. Roubar coberta como ação cômica.
161. **/jogartravesseiro e -jogartravesseiro: jogar travesseiro?**  
   **Resposta:** Sim. Jogar travesseiro como brincadeira.
162. **/fugir e -fugir: fugir do alvo?**  
   **Resposta:** Sim. Fugir do alvo como ação cômica.
163. **/perseguir e -perseguir: perseguir de brincadeira?**  
   **Resposta:** Sim. Perseguir de brincadeira, com tom cartunesco e bloqueável.
164. **Quais comandos podem parecer agressivos?**  
   **Resposta:** Morder, tapa, tapinha, beliscar, perseguir, provocar e zoar podem parecer agressivos.
165. **Quais comandos devem ser suavizados na frase?**  
   **Resposta:** Todos os comandos de brincadeira devem usar frases leves, claramente cômicas e sem humilhação.
166. **Quais comandos não devem dar pontos de afinidade?**  
   **Resposta:** Tapa, zoar, fugir e perseguir não devem dar pontos no padrão; cutucar/morder/beliscar dão no máximo 1.
167. **O alvo poderá reagir negativamente?**  
   **Resposta:** Sim. O alvo poderá bloquear categoria, usuário ou todas as interações.
168. **O alvo poderá bloquear esse tipo de interação?**  
   **Resposta:** Sim. Brincadeiras serão bloqueáveis.

## 8. Lista de comandos de apoio emocional
169. **/consolar e -consolar: consolar o alvo?**  
   **Resposta:** Sim. Consolar o alvo.
170. **/comfort e -comfort: alias de consolar?**  
   **Resposta:** Sim. Alias de consolar.
171. **/proteger e -proteger: proteger o alvo?**  
   **Resposta:** Sim. Proteger o alvo.
172. **/protect e -protect: alias de proteger?**  
   **Resposta:** Sim. Alias de proteger.
173. **/acalmar e -acalmar: acalmar o alvo?**  
   **Resposta:** Sim. Acalmar o alvo.
174. **/ombro e -ombro: oferecer ombro amigo?**  
   **Resposta:** Sim. Oferecer ombro amigo.
175. **/cuidar e -cuidar: cuidar do alvo?**  
   **Resposta:** Sim. Cuidar do alvo.
176. **/abraçoconforto e -abraçoconforto: abraço de conforto?**  
   **Resposta:** Sim. Abraço de conforto.
177. **/ficarjunto e -ficarjunto: ficar junto do alvo?**  
   **Resposta:** Sim. Ficar junto do alvo.
178. **/apoiar e -apoiar: apoiar emocionalmente?**  
   **Resposta:** Sim. Apoiar emocionalmente.
179. **/escutar e -escutar: ouvir o alvo?**  
   **Resposta:** Sim. Escutar o alvo.
180. **/animar e -animar: tentar animar o alvo?**  
   **Resposta:** Sim. Tentar animar o alvo.
181. **/calma e -calma: passar calma?**  
   **Resposta:** Sim. Passar calma.
182. **/cobertor e -cobertor: cobrir o alvo com cobertor?**  
   **Resposta:** Sim. Cobrir com cobertor de forma fofa.
183. **/chá e -chá: oferecer chá?**  
   **Resposta:** Sim. Oferecer chá.
184. **/cha e -cha: alias sem acento?**  
   **Resposta:** Sim. Alias sem acento de `chá`.
185. **As frases de apoio devem ser leves ou mais emotivas?**  
   **Resposta:** Leves e acolhedoras.
186. **O bot deve evitar frases que pareçam terapia?**  
   **Resposta:** Sim. Não deve parecer terapia nem substituir apoio real.
187. **O bot deve evitar promessas emocionais fortes?**  
   **Resposta:** Sim. Evitar promessas fortes como “nunca vou te deixar”.
188. **O bot deve manter as respostas acolhedoras, mas simples?**  
   **Resposta:** Sim. Acolhedoras, curtas e simples.

## 9. Lista de comandos sociais e utilitários
189. **/afinidade @user: mostra afinidade entre autor e alvo?**  
   **Resposta:** Sim. Mostra afinidade entre autor e alvo.
190. **-afinidade @user: versão prefixo?**  
   **Resposta:** Sim. Versão prefixo de afinidade.
191. **/rankafinidade: mostra ranking geral do servidor?**  
   **Resposta:** Sim. Ranking geral do servidor.
192. **-rankafinidade: versão prefixo?**  
   **Resposta:** Sim. Versão prefixo do ranking.
193. **/topafinidade @user: mostra pessoas com maior afinidade com um usuário?**  
   **Resposta:** Sim. Mostra maiores afinidades de um usuário.
194. **-topafinidade @user: versão prefixo?**  
   **Resposta:** Sim. Versão prefixo.
195. **/perfilrp: mostra perfil de RP do usuário?**  
   **Resposta:** Sim. Mostra perfil RP.
196. **-perfilrp: versão prefixo?**  
   **Resposta:** Sim. Versão prefixo.
197. **/historicoafinidade @user: mostra últimas interações entre dois usuários?**  
   **Resposta:** Sim. Mostra histórico recente entre dois usuários.
198. **-historicoafinidade @user: versão prefixo?**  
   **Resposta:** Sim. Versão prefixo.
199. **/config prefixo: altera prefixo do servidor?**  
   **Resposta:** Sim. Altera prefixo do servidor.
200. **/config afinidade: ativa ou desativa sistema de pontos?**  
   **Resposta:** Sim. Ativa/desativa afinidade.
201. **/config gifs: define se GIFs aparecem?**  
   **Resposta:** Sim. Ativa/desativa GIFs.
202. **/config categoria: ativa ou desativa categorias de comandos?**  
   **Resposta:** Sim. Ativa/desativa categorias.
203. **/config canal: limita o bot a canais específicos?**  
   **Resposta:** Sim. Limita canais permitidos.
204. **/config cooldown: ajusta tempo entre usos?**  
   **Resposta:** Sim. Ajusta cooldown.
205. **/config idioma: define idioma das respostas?**  
   **Resposta:** Sim. Define idioma.
206. **/config mencionar: define se o bot usa menção ou nome?**  
   **Resposta:** Sim. Define menção ou nome sem ping.
207. **/config rank: ativa ou desativa rankings?**  
   **Resposta:** Sim. Ativa/desativa ranking.
208. **/config reset: reseta configurações do servidor?**  
   **Resposta:** Sim. Reseta configurações com confirmação.
209. **/gifadd: adiciona GIF manualmente a uma ação?**  
   **Resposta:** Sim. Adiciona GIF manualmente ao banco com ação, categoria, provider, status e metadados; não deve criar duplicidade por `provider + providerGifId`.
210. **/gifbuscar: busca GIFs na GIPHY e salva no banco?**  
   **Resposta:** Sim. Busca na GIPHY, salva resultados no banco como `pending` ou `uncategorized` e registra `AdminLog`.
211. **/gifaprovar: aprova GIF pendente?**  
   **Resposta:** Sim. Muda status para `approved`, registra quem aprovou e grava `AdminLog`.
212. **/gifbloquear: bloqueia GIF inadequado?**  
   **Resposta:** Sim. Muda status para `blocked`, registra quem bloqueou e grava `AdminLog`.
213. **/gifremove: remove GIF de uma ação?**  
   **Resposta:** Sim. Desativa/remove logicamente sem apagar histórico, registrando `AdminLog`.
214. **/gifmover: corrige ação e/ou categoria de um GIF?**  
   **Resposta:** Sim. Altera `action` e/ou `category`; se um GIF vier como `kiss`, mas for melhor para `beijotesta`, deve poder ser movido.
215. **/giflist: lista GIFs cadastrados para uma ação?**  
   **Resposta:** Sim. Lista GIFs com filtros por ação, categoria, status, provider e ID interno, sem expor IDs técnicos em respostas públicas de RP.
216. **/giftest: testa GIF aleatório de uma ação?**  
   **Resposta:** Sim. Testa o sorteio real respeitando proporção banco/GIPHY, cota de 100 chamadas por hora e bloqueios de status.
217. **/fraseadd: adiciona frase a um comando?**  
   **Resposta:** Sim. Adiciona frase.
218. **/fraseremove: remove frase de um comando?**  
   **Resposta:** Sim. Remove frase.
219. **/fraselist: lista frases de um comando?**  
   **Resposta:** Sim. Lista frases.
220. **/blacklist add: impede um usuário de usar o bot?**  
   **Resposta:** Sim. Bloqueia usuário no bot.
221. **/blacklist remove: remove bloqueio?**  
   **Resposta:** Sim. Remove bloqueio.
222. **/resetafinidade: reseta afinidade entre usuários?**  
   **Resposta:** Sim. Reseta afinidade entre usuários.
223. **/resetusuario: reseta dados de um usuário?**  
   **Resposta:** Sim. Reseta dados de usuário.
224. **/resetservidor: reseta todos os dados do servidor?**  
   **Resposta:** Sim. Reseta dados do servidor com confirmação forte.
225. **/bloquearrp: bloqueia interações recebidas?**  
   **Resposta:** Sim. Bloqueia interações recebidas.
226. **/desbloquearrp: permite interações novamente?**  
   **Resposta:** Sim. Reativa interações.
227. **/bloquearcategoria: bloqueia categoria específica?**  
   **Resposta:** Sim. Bloqueia categoria específica.
228. **/preferencias: mostra preferências pessoais?**  
   **Resposta:** Sim. Mostra preferências pessoais.
229. **/optout: remove o usuário do sistema de afinidade?**  
   **Resposta:** Sim. Remove o usuário do sistema de afinidade/ranking.
230. **/optin: recoloca o usuário no sistema de afinidade?**  
   **Resposta:** Sim. Reativa participação.
231. **/help: mostra lista de comandos?**  
   **Resposta:** Sim. Mostra ajuda geral.
232. **-help: versão prefixo?**  
   **Resposta:** Sim. Versão prefixo.
233. **/help carinho: mostra comandos de carinho?**  
   **Resposta:** Sim. Ajuda de carinho.
234. **/help romance: mostra comandos românticos leves?**  
   **Resposta:** Sim. Ajuda de romance.
235. **/help brincadeira: mostra comandos de brincadeira?**  
   **Resposta:** Sim. Ajuda de brincadeira.
236. **/help apoio: mostra comandos de apoio emocional?**  
   **Resposta:** Sim. Ajuda de apoio.
237. **/help afinidade: explica sistema de pontos?**  
   **Resposta:** Sim. Explica afinidade.
238. **/sobre: mostra informações do bot?**  
   **Resposta:** Sim. Mostra informações do bot.
239. **/ping: testa latência?**  
   **Resposta:** Sim. Testa latência.
240. **/status: mostra status básico do bot?**  
   **Resposta:** Sim. Mostra status básico.

## 10. Sistema de aliases
241. **Cada comando terá aliases em português?**  
   **Resposta:** Sim. Comandos terão aliases em português.
242. **Cada comando terá aliases em inglês?**  
   **Resposta:** Sim. Haverá aliases em inglês para comandos comuns.
243. **Aliases com acento e sem acento serão aceitos?**  
   **Resposta:** Sim. Acento e sem acento serão aceitos no prefixo.
244. **Aliases curtos serão aceitos?**  
   **Resposta:** Sim. Aliases curtos como `bjt`, `bjb` e `pat` serão aceitos.
245. **Aliases poderão ser configurados pelo dono?**  
   **Resposta:** No MVP, não. Depois, aliases customizados poderão ser configurados pelo dono/admin.
246. **Aliases serão fixos no código?**  
   **Resposta:** Sim. Aliases base serão fixos no código ou JSON.
247. **Aliases serão salvos no banco de dados?**  
   **Resposta:** Aliases customizados futuros serão salvos no banco.
248. **Dois comandos poderão compartilhar o mesmo alias?**  
   **Resposta:** Não. Um alias só pode apontar para uma ação.
249. **O bot detectará conflito de aliases?**  
   **Resposta:** Sim. O bot deve detectar conflito ao iniciar ou cadastrar alias.
250. **Slash commands terão aliases ou apenas prefix commands?**  
   **Resposta:** Prefix commands terão aliases completos; slash commands terão nomes únicos e autocomplete.
251. **Como o bot lidará com aliases em slash, já que slash commands precisam de nomes únicos?**  
   **Resposta:** Slash commands precisam de nomes únicos; por isso o bot usará nomes principais e, quando necessário, `/rp ação` com autocomplete.
252. **hug, abraçar, abraço, abraco serão o mesmo comando?**  
   **Resposta:** Sim. Todos apontam para a ação `hug`.
253. **beijotesta, bjt, foreheadkiss serão o mesmo comando?**  
   **Resposta:** Sim. Todos apontam para `beijotesta`.
254. **beijobochecha, bjb, cheekkiss serão o mesmo comando?**  
   **Resposta:** Sim. Todos apontam para `beijobochecha`.
255. **cafune, cafuné, headpat, pat serão o mesmo comando?**  
   **Resposta:** Sim. Todos apontam para `cafune`.
256. **consolar, comfort, apoio serão o mesmo comando?**  
   **Resposta:** Sim. Todos apontam para `consolar`/apoio.
257. **proteger, protect serão o mesmo comando?**  
   **Resposta:** Sim. Ambos apontam para `proteger`.
258. **morder, bite serão o mesmo comando?**  
   **Resposta:** Sim. Ambos apontam para `morder`.
259. **cutucar, poke serão o mesmo comando?**  
   **Resposta:** Sim. Ambos apontam para `cutucar`.

Tabela obrigatória de aliases do MVP:

| Ação canônica | Slash direto do MVP | Prefixos e aliases aceitos | Categoria |
|---|---|---|---|
| `hug` | `/hug` | `-hug`, `-abraçar`, `-abracar`, `-abraço`, `-abraco` | `carinho_fofo` |
| `beijotesta` | `/beijotesta` | `-beijotesta`, `-foreheadkiss`, `-bjt` | `carinho_fofo` |
| `beijobochecha` | `/beijobochecha` | `-beijobochecha`, `-cheekkiss`, `-bjb` | `carinho_fofo` |
| `cafune` | `/cafune` | `-cafune`, `-cafuné`, `-headpat`, `-pat` | `carinho_fofo` |
| `consolar` | `/consolar` | `-consolar`, `-comfort` | `apoio_emocional` |
| `proteger` | `/proteger` | `-proteger`, `-protect` | `apoio_emocional` |
| `morder` | `/morder` | `-morder`, `-bite` | `brincadeira` |
| `cutucar` | `/cutucar` | `-cutucar`, `-poke` | `brincadeira` |

Observações obrigatórias:

- Slash commands diretos do MVP devem existir para as ações principais listadas acima.
- Prefix commands aceitam aliases em português, inglês, com acento e sem acento.
- Slash aliases extras devem ser tratados por `/rp ação` com autocomplete ou nomes localizados, se o Discord permitir sem gerar excesso de comandos.
- Nenhum alias pode apontar para mais de uma ação.
- Nome de usuário não deve ser alias nem forma de resolver alvo; alvo deve ser menção, ID ou opção de usuário do slash.

## 11. Sistema de afinidade
260. **Cada interação entre dois usuários aumenta pontos?**  
   **Resposta:** Sim. Toda interação válida de RP pontuável aumenta afinidade.
261. **Os pontos são salvos por par de usuários?**  
   **Resposta:** Sim. Pontos serão salvos por par de usuários.
262. **A afinidade será bidirecional?**  
   **Resposta:** Sim. Afinidade será bidirecional.
263. **Se Zythenth interage com Maria, Maria também terá afinidade com Zythenth?**  
   **Resposta:** Sim. Zythenth + Maria é o mesmo par que Maria + Zythenth.
264. **A ordem dos usuários importa no banco?**  
   **Resposta:** Não. A ordem será normalizada no banco: `user_a_id` e `user_b_id` devem ser ordenados de forma estável para evitar duplicidade.
265. **O par A + B será sempre igual a B + A?**  
   **Resposta:** Sim. A + B sempre será igual a B + A.
266. **O sistema contará quem iniciou mais interações?**  
   **Resposta:** Sim. O histórico guardará quem iniciou mais interações.
267. **O sistema contará quantas vezes cada pessoa interagiu?**  
   **Resposta:** Sim. Guardará contagem total e contagem por iniciador.
268. **O bot mostrará apenas total ou também estatísticas?**  
   **Resposta:** Mostrará total no uso normal; estatísticas aparecerão em comandos de consulta.
269. **A afinidade será separada por servidor?**  
   **Resposta:** Sim. Afinidade será separada por servidor.
270. **Dois usuários terão pontos diferentes em servidores diferentes?**  
   **Resposta:** Sim. Pontos podem ser diferentes em servidores diferentes.
271. **Quanto cada comando dará de afinidade?**  
   **Resposta:** Depende da categoria: carinho +2, romance +3, apoio +3, brincadeira +1, neutro +0.
272. **Todos os comandos darão a mesma quantidade?**  
   **Resposta:** Não. Pontuação varia por categoria/comando.
273. **Comandos fofos dão mais pontos que brincadeiras?**  
   **Resposta:** Sim. Comandos fofos valem mais que brincadeiras.
274. **Comandos românticos dão mais pontos que comandos comuns?**  
   **Resposta:** Sim. Romance leve vale um pouco mais que carinho comum.
275. **Comandos de apoio emocional dão bônus?**  
   **Resposta:** Sim. Apoio emocional terá bônus e valerá +3.
276. **Comandos repetidos dão menos pontos?**  
   **Resposta:** Sim. Repetidos durante cooldown não dão ponto.
277. **Existe limite diário de pontos por par?**  
   **Resposta:** Sim. Limite diário por par: 25 pontos.
278. **Existe limite diário de pontos por usuário?**  
   **Resposta:** Sim. Limite diário por usuário: 100 pontos pontuáveis.
279. **Existe limite por comando?**  
   **Resposta:** Sim. Cada comando terá cooldown próprio.
280. **O ganho será fixo ou aleatório?**  
   **Resposta:** Fixo por comando/categoria.
281. **O ganho pode ser algo como +1, +2, +3 ou +5?**  
   **Resposta:** Sim. O padrão usa valores como +1, +2 e +3; +5 fica reservado para eventos especiais.
282. **O bot mostrará o ganho na mensagem?**  
   **Resposta:** Sim. Mostrará o ganho quando houver ponto.
283. **O bot mostrará apenas o total final?**  
   **Resposta:** Mostrará ganho e total final; se a configuração simplificada estiver ativa, só mostra total.
284. **Carinho fofo deve dar quantos pontos?**  
   **Resposta:** +2 pontos.
285. **Romance leve deve dar quantos pontos?**  
   **Resposta:** +3 pontos.
286. **Apoio emocional deve dar quantos pontos?**  
   **Resposta:** +3 pontos.
287. **Brincadeiras devem dar quantos pontos?**  
   **Resposta:** +1 ponto.
288. **Comandos neutros devem dar quantos pontos?**  
   **Resposta:** 0 ponto, salvo comando específico configurado.
289. **Comandos administrativos devem dar zero pontos?**  
   **Resposta:** Sim. 0 ponto.
290. **Comandos de consulta devem dar zero pontos?**  
   **Resposta:** Sim. 0 ponto.
291. **A afinidade terá limite máximo?**  
   **Resposta:** Sim. Haverá limite máximo.
292. **O limite será 100 pontos?**  
   **Resposta:** Não. 100 é baixo demais.
293. **O limite será 500 pontos?**  
   **Resposta:** Não como limite final; 500 será marco intermediário.
294. **O limite será 1000 pontos?**  
   **Resposta:** Sim. O limite padrão será 1000 pontos.
295. **O limite será infinito?**  
   **Resposta:** Não. Infinito dificulta balanceamento e ranking.
296. **O rank fica melhor com limite ou sem limite?**  
   **Resposta:** Com limite.
297. **Os marcos ficam melhores com limite ou sem limite?**  
   **Resposta:** Com limite.
298. **Ao atingir o limite, o bot continua contando interações separadamente?**  
   **Resposta:** Sim. Ao chegar no limite, continua contando interações separadamente.
299. **O bot deve mostrar “afinidade máxima”?**  
   **Resposta:** Sim. Mostrará “afinidade máxima” em 1000 pontos.
300. **Haverá prestígio ou reset ao chegar no máximo?**  
   **Resposta:** Não no MVP. Prestígio fica fora da primeira versão.
301. **Afinidade pode diminuir?**  
   **Resposta:** Não no funcionamento normal.
302. **Os pontos caem com o tempo?**  
   **Resposta:** Não. Pontos não caem com o tempo.
303. **Os pontos caem por inatividade?**  
   **Resposta:** Não no MVP.
304. **Os pontos caem se alguém usar comando negativo?**  
   **Resposta:** Não. Não haverá comandos negativos pontuando perda.
305. **Haverá comandos negativos?**  
   **Resposta:** Não no MVP.
306. **O bot deve evitar comandos negativos para manter o clima fofo?**  
   **Resposta:** Sim. Evitar comandos negativos mantém o clima fofo.
307. **Administradores poderão reduzir pontos manualmente?**  
   **Resposta:** Sim, apenas para correção/moderação e com log.
308. **Usuários poderão resetar afinidade entre si?**  
   **Resposta:** Sim, com comando de privacidade; reset entre dois usuários deve exigir permissão adequada.
309. **O usuário pode apagar seus próprios dados?**  
   **Resposta:** Sim. Usuário poderá solicitar apagar os próprios dados.
310. **A afinidade deve ser permanente?**  
   **Resposta:** Sim, salvo reset, opt-out ou política de limpeza.
311. **Haverá cooldown global por usuário?**  
   **Resposta:** Sim. Cooldown global por usuário.
312. **Haverá cooldown por comando?**  
   **Resposta:** Sim. Cooldown por comando.
313. **Haverá cooldown por par de usuários?**  
   **Resposta:** Sim. Cooldown de pontos por par.
314. **Haverá limite de pontos por dia entre o mesmo par?**  
   **Resposta:** Sim. Limite diário por par.
315. **O bot permitirá usar vários comandos seguidos sem ganhar pontos?**  
   **Resposta:** Sim. O RP pode funcionar, mas sem ganhar pontos durante limite/cooldown.
316. **Depois do limite diário, o comando ainda envia RP e GIF?**  
   **Resposta:** Sim. Depois do limite diário, ainda envia frase e GIF, sem pontos.
317. **O bot avisará quando o limite diário de pontos for atingido?**  
   **Resposta:** Sim, de forma curta.
318. **O bot esconderá o aviso para não poluir o chat?**  
   **Resposta:** Sim. O aviso pode ficar discreto no rodapé.
319. **O sistema deve impedir farm com contas alternativas?**  
   **Resposta:** Parcialmente. Bloqueia bots, self-use, cooldown e limites; alt accounts exigem moderação humana.
320. **Interações com bots darão pontos?**  
   **Resposta:** Não.
321. **Interações consigo mesmo darão pontos?**  
   **Resposta:** Não.
322. **Interações repetidas com o mesmo comando terão ganho reduzido?**  
   **Resposta:** Sim. Repetição dentro do intervalo não pontua.
323. **Retribuir pode gerar afinidade?**  
   **Resposta:** Sim. O botão `Retribuir` pode gerar afinidade, desde que respeite cooldown, limite diário, bloqueios, consentimento, opt-out e limite máximo de 1000 pontos.
324. **Quais serão os nomes dos níveis de afinidade?**  
   **Resposta:** Desconhecidos, Conhecidos, Colegas, Amigos, Bons Amigos, Próximos, Laço Fofo, Laço Especial, Inseparáveis e Laço Lendário.
325. **Quantos marcos existirão?**  
   **Resposta:** 10 marcos.
326. **Os marcos serão fixos ou configuráveis?**  
   **Resposta:** Fixos no MVP; configuráveis depois.
327. **Os marcos terão emojis?**  
   **Resposta:** Sim. Emojis por marco serão opcionais.
328. **Os marcos aparecerão na mensagem?**  
   **Resposta:** Sim. Aparecerão quando afinidade estiver ativa.
329. **Os marcos aparecerão no perfil?**  
   **Resposta:** Sim. Aparecerão no perfil RP.
330. **Ao subir de marco, o bot enviará mensagem especial?**  
   **Resposta:** Sim. Ao subir de marco, uma mensagem curta poderá aparecer.
331. **Ao atingir marco alto, desbloqueia comandos?**  
   **Resposta:** Não no MVP.
332. **Ao atingir marco alto, desbloqueia títulos?**  
   **Resposta:** Sim. Desbloqueia títulos, não comandos.
333. **Ao atingir marco alto, desbloqueia frases especiais?**  
   **Resposta:** Sim. Frases especiais por marco podem entrar depois do MVP.
334. **0–9: Desconhecidos?**  
   **Resposta:** Sim. 0–9: Desconhecidos.
335. **10–24: Conhecidos?**  
   **Resposta:** Sim. 10–24: Conhecidos.
336. **25–49: Colegas?**  
   **Resposta:** Sim. 25–49: Colegas.
337. **50–99: Amigos?**  
   **Resposta:** Sim. 50–99: Amigos.
338. **100–199: Bons amigos?**  
   **Resposta:** Sim. 100–199: Bons Amigos.
339. **200–349: Próximos?**  
   **Resposta:** Sim. 200–349: Próximos.
340. **350–499: Laço Fofo?**  
   **Resposta:** Sim. 350–499: Laço Fofo.
341. **500–749: Laço Especial?**  
   **Resposta:** Sim. 500–749: Laço Especial.
342. **750–999: Inseparáveis?**  
   **Resposta:** Sim. 750–999: Inseparáveis.
343. **1000+: Alma gêmea de RP?**  
   **Resposta:** No padrão neutro, 1000+: Laço Lendário; “Alma gêmea de RP” pode ser opção para servidores românticos.
344. **Esses nomes são fofos demais?**  
   **Resposta:** Não para a proposta do bot, mas os nomes serão configuráveis.
345. **Esses nomes são românticos demais?**  
   **Resposta:** Alguns nomes podem ser românticos; por isso o padrão deve ser neutro e configurável.
346. **O servidor poderá trocar os nomes dos marcos?**  
   **Resposta:** Sim. O servidor poderá trocar nomes dos marcos.

## 12. Fórmula de afinidade
347. **O sistema será apenas soma simples de pontos?**  
   **Resposta:** Sim. Soma simples de pontos.
348. **Cada comando adiciona pontos ao total do par?**  
   **Resposta:** Sim. Cada comando adiciona pontos ao par.
349. **O total será exibido como número inteiro?**  
   **Resposta:** Sim. Total inteiro.
350. **Haverá multiplicador por sequência de dias?**  
   **Resposta:** Não no MVP.
351. **Haverá bônus por interação diária?**  
   **Resposta:** Não no MVP; bônus diário pode ser futuro.
352. **Haverá bônus por variedade de comandos?**  
   **Resposta:** Não no MVP; variedade pode virar bônus futuro.
353. **Haverá penalidade por repetir o mesmo comando?**  
   **Resposta:** Sim. Repetição durante cooldown não pontua.
354. **Haverá limite de ganho por período?**  
   **Resposta:** Sim. Limite diário e cooldown.
355. **O bot terá sequência diária entre usuários?**  
   **Resposta:** Não no MVP.
356. **Uma interação por dia mantém a sequência?**  
   **Resposta:** Sim, quando streak for implementado.
357. **Qual o limite para perder sequência?**  
   **Resposta:** Perde a sequência após 48 horas sem interação, quando o sistema existir.
358. **A sequência dá bônus de afinidade?**  
   **Resposta:** Não no MVP; futuro bônus pequeno, como +1 diário.
359. **A sequência aparece no comando /afinidade?**  
   **Resposta:** Sim, em versão futura.
360. **A sequência aparece no ranking?**  
   **Resposta:** Não no MVP; futuro opcional.
361. **A sequência deve ser resetada se ficarem dias sem interagir?**  
   **Resposta:** Sim, se ficar acima do limite de tempo definido.
362. **O bot deve guardar todas as interações?**  
   **Resposta:** Não todas para sempre. Guardará histórico recente e métricas agregadas.
363. **O bot deve guardar apenas o total?**  
   **Resposta:** Guardará total e estatísticas básicas.
364. **O bot deve guardar últimas 10 interações?**  
   **Resposta:** Sim. Últimas 20 interações por par no MVP.
365. **O histórico será usado para anti-farm?**  
   **Resposta:** Sim. Histórico recente ajuda anti-farm.
366. **O histórico será visível para usuários?**  
   **Resposta:** Sim, apenas para usuários envolvidos, com limite.
367. **O histórico será visível só para administradores?**  
   **Resposta:** Administradores verão logs administrativos, não detalhes privados desnecessários.
368. **Por quanto tempo o histórico será mantido?**  
   **Resposta:** Histórico detalhado por 90 dias; totais permanecem enquanto o usuário não apagar dados.

## 13. Rankings
369. **O ranking será por servidor?**  
   **Resposta:** Sim. Ranking por servidor.
370. **O ranking mostrará pares de usuários?**  
   **Resposta:** Sim. Ranking principal mostrará pares de usuários.
371. **O ranking mostrará usuários individuais?**  
   **Resposta:** Não no MVP; ranking individual pode ser futuro.
372. **O ranking terá paginação?**  
   **Resposta:** Sim. Paginação.
373. **Quantos resultados aparecem por página?**  
   **Resposta:** 10 resultados por página.
374. **O ranking mostrará pontos?**  
   **Resposta:** Sim. Mostrará pontos.
375. **O ranking mostrará marco?**  
   **Resposta:** Sim. Mostrará marco.
376. **O ranking mostrará quantidade de interações?**  
   **Resposta:** Sim. Mostrará quantidade de interações.
377. **O ranking poderá ser desativado?**  
   **Resposta:** Sim. Ranking pode ser desativado por servidor.
378. **O usuário poderá ver com quem tem mais afinidade?**  
   **Resposta:** Sim. `/topafinidade @user`.
379. **O usuário poderá esconder seus dados do ranking?**  
   **Resposta:** Sim. Usuário poderá ocultar dados do ranking.
380. **Usuários bloqueados aparecem no ranking?**  
   **Resposta:** Não. Usuários bloqueados/opt-out não aparecem.
381. **Usuários que saíram do servidor aparecem no ranking?**  
   **Resposta:** Por padrão, não aparecem nos rankings públicos.
382. **O bot remove dados de usuários que saíram?**  
   **Resposta:** Pode remover ou ocultar dados após política de limpeza.
383. **O bot mantém dados caso o usuário volte?**  
   **Resposta:** Sim. Dados podem ser mantidos por período configurado caso volte.

## 14. Sistema de GIFs com GIPHY e banco de dados
384. **Os GIFs serão organizados por comando?**  
   **Resposta:** Sim. GIFs serão organizados por ação/comando, como `kiss`, `beijotesta`, `beijobochecha`, `hug` e `cafune`.
385. **Os GIFs serão organizados por categoria?**  
   **Resposta:** Sim. Cada GIF terá categoria, como `carinho_fofo`, `romance_leve`, `apoio_emocional` ou `brincadeira`.
386. **Cada comando terá uma lista própria de GIFs?**  
   **Resposta:** Sim. Cada ação terá catálogo próprio no banco; `kiss` e `beijotesta` não devem compartilhar o mesmo conjunto de busca.
387. **Cada comando terá quantidade mínima de GIFs?**  
   **Resposta:** Sim. Mínimo recomendado: 20 GIFs aprovados por ação no banco; ideal de 50+ para ações muito usadas.
388. **O bot impedirá comando sem GIF?**  
   **Resposta:** Não. Se não houver GIF aprovado, tenta buscar na GIPHY dentro da cota; se não puder, envia texto e aviso discreto.
389. **Se não houver GIF, o bot usará imagem padrão?**  
   **Resposta:** Não por padrão. O fallback principal é buscar GIPHY; se falhar, texto puro.
390. **Se não houver GIF, o bot enviará apenas texto?**  
   **Resposta:** Sim. Enviará apenas texto quando não houver GIF aprovado, não houver resultado seguro ou a cota GIPHY estiver esgotada.
391. **Os GIFs serão escolhidos aleatoriamente?**  
   **Resposta:** Sim. Escolha aleatória ponderada e progressiva por ação/categoria: começa em 65% banco aprovado e 35% GIPHY nova; conforme houver mais GIFs aprovados naquela ação/categoria, aumenta gradualmente até 85% banco aprovado e 15% GIPHY nova. Faixas recomendadas: 0–19 GIFs aprovados = 65% banco / 35% GIPHY; 20–49 = 70% banco / 30% GIPHY; 50–99 = 75% banco / 25% GIPHY; 100–199 = 80% banco / 20% GIPHY; 200+ = 85% banco / 15% GIPHY. Sempre respeitar a cota de 100 chamadas/hora.
392. **O bot evitará repetir o mesmo GIF várias vezes seguidas?**  
   **Resposta:** Sim. A repetição será evitada usando histórico persistente no banco, não cache volátil.
393. **O bot terá cache de GIFs recentes?**  
   **Resposta:** Não como cache volátil. O bot salvará no banco `last_used_at`, `times_used` e histórico recente por ação para evitar repetição mesmo após reiniciar.
394. **Todos os GIFs serão revisados manualmente?**  
   **Resposta:** GIFs aprovados serão revisados. GIFs novos da GIPHY podem aparecer em proporção limitada como `pending`/`uncategorized`, com rating seguro; depois podem ser aprovados, bloqueados ou movidos de categoria.
395. **O bot terá lista de GIFs proibidos?**  
   **Resposta:** Sim. Lista persistente no banco de GIFs bloqueados/desativados, usando `providerGifId` para impedir retorno do mesmo GIF.
396. **O bot terá categorias de segurança?**  
   **Resposta:** Sim. Categorias de ação: `carinho_fofo`, `romance_leve`, `brincadeira` e `apoio_emocional`. Segurança/moderação fica em `status` (`pending`, `approved`, `blocked`, `disabled`, `uncategorized`) e no rating permitido da GIPHY.
397. **O bot impedirá GIFs sugestivos?**  
   **Resposta:** Sim. GIFs sugestivos serão barrados.
398. **O bot impedirá GIFs violentos?**  
   **Resposta:** Sim. GIFs violentos serão barrados.
399. **O bot impedirá GIFs com nudez?**  
   **Resposta:** Sim. Nudez será barrada.
400. **O bot impedirá GIFs com gore?**  
   **Resposta:** Sim. Gore será barrado.
401. **O bot impedirá GIFs com personagens infantis em contexto romântico?**  
   **Resposta:** Sim. Personagens infantis em contexto romântico serão barrados.
402. **O bot terá revisão antes de adicionar GIF novo?**  
   **Resposta:** Não necessariamente. GIF novo da GIPHY pode ser usado em porcentagem limitada como pendente; para entrar no uso prioritário do banco precisa ser aprovado.
403. **Quem poderá adicionar GIFs?**  
   **Resposta:** Dono, administradores ou cargo gerenciador.
404. **Quem poderá remover GIFs?**  
   **Resposta:** Dono, administradores ou cargo gerenciador.
405. **O comando de adicionar GIF validará URL?**  
   **Resposta:** Sim. Valida origem GIPHY/manual, duplicidade por `providerGifId`, categoria, ação e status.
406. **O comando de adicionar GIF testará se o link funciona?**  
   **Resposta:** Sim. Para GIPHY, valida resposta da API; para link manual, testa se o link responde.
407. **O bot aceitará .gif, .webp, .mp4 ou apenas GIF?**  
   **Resposta:** Aceitará as rendições retornadas pela GIPHY, priorizando MP4/WEBP leves quando disponíveis e GIF quando adequado ao Discord.
408. **O bot salvará metadados do GIF?**  
   **Resposta:** Sim. Salvará `provider`, `providerGifId`, `action`, `category`, `status`, `rating`, `searchTerm`, `giphyPageUrl`, `lastUsedAt`, `timesUsed`, `addedBy`, `approvedBy`, `blockedBy`, `notes`, `createdAt` e `updatedAt`. A URL de mídia deve ser obtida/renovada pela API quando necessário, não tratada como permanente.
409. **O bot salvará quem adicionou o GIF?**  
   **Resposta:** Sim. Salvará ID de quem adicionou.
410. **O bot salvará data de cadastro?**  
   **Resposta:** Sim. Salvará data de cadastro.
411. **O bot terá comando para desativar GIF específico sem apagar?**  
   **Resposta:** Sim. GIF poderá ser desativado, bloqueado ou movido de ação/categoria sem apagar o registro.

### Modelo obrigatório da tabela `Gif`

Campos mínimos:

| Campo | Finalidade |
|---|---|
| `id` | ID interno do registro. |
| `guildId` | Servidor dono do registro, quando o catálogo for específico por servidor. |
| `provider` | Origem do GIF, por exemplo `giphy` ou `manual`. |
| `providerGifId` | ID do GIF no provider; obrigatório para GIPHY. |
| `action` | Ação específica usada pelo comando. |
| `category` | Categoria de segurança/pontuação da ação. |
| `status` | Estado de moderação do GIF. |
| `rating` | Rating retornado/validado, como `pg`. |
| `searchTerm` | Termo usado na busca da GIPHY. |
| `giphyPageUrl` | URL da página da GIPHY para revisão administrativa, não exibida ao usuário final. |
| `timesUsed` | Contador de uso. |
| `lastUsedAt` | Último uso. |
| `addedBy` | ID de quem adicionou/importou. |
| `approvedBy` | ID de quem aprovou. |
| `blockedBy` | ID de quem bloqueou. |
| `notes` | Observações internas de moderação. |
| `createdAt` | Data de criação. |
| `updatedAt` | Data de atualização. |

Status possíveis:

- `pending`
- `approved`
- `blocked`
- `disabled`
- `uncategorized`

Regra de persistência: todo GIF importado/usado deve gerar registro no banco. O bot não deve depender de cache que some ao reiniciar, não deve baixar milhares de arquivos para a VPS e não deve tratar URL de mídia da GIPHY como permanente. Quando precisar exibir o GIF, pode renovar/buscar a mídia pela GIPHY usando `providerGifId`.

### Ações e categorias dos GIFs

`action` e `category` não são a mesma coisa.

Ações documentadas:

- `hug`
- `kiss`
- `beijotesta`
- `beijobochecha`
- `cafune`
- `consolar`
- `proteger`
- `morder`
- `cutucar`

Categorias documentadas:

- `carinho_fofo`
- `romance_leve`
- `brincadeira`
- `apoio_emocional`

Separação obrigatória:

- `kiss` = beijo na boca/selinho romântico leve.
- `beijotesta` = beijo na testa.
- `beijobochecha` = beijo na bochecha.
- Essas três ações não devem misturar termos de busca nem GIFs.

O arquivo `data/giphy-search-terms.json` deve existir e conter termos separados por ação. Exemplo:

```json
{
  "kiss": [
    "anime kiss",
    "cute anime kiss",
    "romantic anime kiss"
  ],
  "beijotesta": [
    "forehead kiss anime",
    "anime forehead kiss",
    "cute forehead kiss"
  ],
  "beijobochecha": [
    "cheek kiss anime",
    "anime cheek kiss",
    "cute cheek kiss"
  ],
  "hug": [
    "anime hug",
    "comfort hug anime",
    "cute hug"
  ],
  "cafune": [
    "anime head pat",
    "headpat anime",
    "pat head cute"
  ]
}
```

### Comandos administrativos de GIF

- `/gifbuscar`: busca na GIPHY e salva no banco.
- `/gifadd`: adiciona manualmente.
- `/gifaprovar`: muda status para `approved`.
- `/gifbloquear`: muda status para `blocked`.
- `/gifremove`: desativa/remove logicamente.
- `/gifmover`: altera `action` e/ou `category`.
- `/giflist`: filtra por `action`, `category`, `status` e `provider`.
- `/giftest`: testa o sorteio real respeitando a proporção.

Todo comando administrativo de GIF deve registrar `AdminLog`. Não permitir duplicidade por `provider + providerGifId`. Se um GIF vier como `kiss`, mas for melhor para `beijotesta`, deve poder ser movido com `/gifmover`.

## 15. Sistema de frases
412. **Cada comando terá várias frases possíveis?**  
   **Resposta:** Sim. Várias frases por comando.
413. **As frases terão placeholders como {autor} e {alvo}?**  
   **Resposta:** Sim. Placeholders `{autor}`, `{alvo}`, `{pontos}`, `{total}` e `{marco}`.
414. **As frases serão armazenadas em arquivo JSON?**  
   **Resposta:** Sim. Frases base ficarão em JSON.
415. **As frases serão armazenadas no banco?**  
   **Resposta:** Frases customizadas por servidor ficarão no banco.
416. **Administradores poderão adicionar frases?**  
   **Resposta:** Sim. Administradores autorizados poderão adicionar.
417. **Administradores poderão remover frases?**  
   **Resposta:** Sim. Administradores autorizados poderão remover.
418. **O bot terá frases diferentes por idioma?**  
   **Resposta:** Sim. PT-BR no MVP; inglês pode entrar depois.
419. **O bot terá frases diferentes por marco de afinidade?**  
   **Resposta:** Não no MVP; futuro possível.
420. **O bot terá frases especiais quando o par tiver muitos pontos?**  
   **Resposta:** Sim, como recurso futuro.
421. **O bot terá frases especiais em datas comemorativas?**  
   **Resposta:** Sim, como recurso futuro configurável.
422. **As frases serão sempre em terceira pessoa?**  
   **Resposta:** Sim. Terceira pessoa por padrão.
423. **As frases serão sempre leves?**  
   **Resposta:** Sim. Sempre leves.
424. **O bot evitará frases possessivas?**  
   **Resposta:** Sim. Evitar frases possessivas.
425. **O bot evitará frases muito íntimas?**  
   **Resposta:** Sim. Evitar frases íntimas demais.
426. **O bot evitará frases que pareçam forçar romance?**  
   **Resposta:** Sim. Evitar qualquer frase que force romance.
427. **O bot usará linguagem neutra?**  
   **Resposta:** Sim. Linguagem neutra sempre que possível.
428. **O bot usará emojis nas frases?**  
   **Resposta:** Sim, com moderação.
429. **Os emojis serão configuráveis?**  
   **Resposta:** Sim. Emojis serão configuráveis por servidor/categoria.

## 16. Consentimento e bloqueios
430. **Usuários poderão bloquear todas as interações recebidas?**  
   **Resposta:** Sim. Bloqueio total de interações recebidas.
431. **Usuários poderão bloquear apenas comandos românticos?**  
   **Resposta:** Sim. Bloqueio apenas romântico.
432. **Usuários poderão bloquear apenas brincadeiras?**  
   **Resposta:** Sim. Bloqueio apenas brincadeiras.
433. **Usuários poderão bloquear usuários específicos?**  
   **Resposta:** Sim. Bloqueio de usuários específicos.
434. **Usuários poderão permitir apenas amigos?**  
   **Resposta:** Não no MVP; “permitir apenas amigos” pode ser futuro.
435. **O bot avisará quando alguém tentou interagir com usuário bloqueado?**  
   **Resposta:** Sim, mas sem expor detalhes sensíveis.
436. **O aviso será público ou privado?**  
   **Resposta:** Preferência por aviso privado/efêmero; no prefixo, erro público curto.
437. **O bloqueio afeta apenas pontos ou também mensagens?**  
   **Resposta:** Afeta mensagens e pontos: interação bloqueada não envia RP nem pontua.
438. **Comandos românticos precisam de opt-in?**  
   **Resposta:** Sim. Romance deve ter opt-in ou política explícita do servidor.
439. **Comandos fofos podem ser livres?**  
   **Resposta:** Sim. Comandos fofos podem ser livres, mas bloqueáveis.
440. **Comandos de brincadeira podem ser bloqueáveis?**  
   **Resposta:** Sim. Brincadeiras serão bloqueáveis.
441. **Comandos de apoio emocional podem ser sempre permitidos?**  
   **Resposta:** Podem ser permitidos por padrão, mas bloqueio total do usuário prevalece.
442. **O servidor poderá definir política padrão?**  
   **Resposta:** Sim. O servidor define política padrão.
443. **O usuário poderá sobrescrever a política do servidor?**  
   **Resposta:** Sim. Usuário poderá escolher regra mais restritiva.

### Privacidade aplicada ao botão Retribuir

O botão `Retribuir` deve obedecer exatamente às mesmas regras de privacidade da ação original:

- bloqueio total de interações;
- bloqueio de romance;
- bloqueio de brincadeiras;
- bloqueio de usuários específicos;
- opt-out de afinidade/ranking;
- consentimento/opt-in para ações românticas;
- limites de cooldown e pontuação.

Se o alvo original bloqueou a categoria, bloqueou o autor original, saiu do opt-in romântico ou apagou seus dados antes do clique, a retribuição deve ser recusada com mensagem efêmera curta.

## 17. Configuração por servidor
444. **O servidor poderá ativar ou desativar o bot?**  
   **Resposta:** Sim. Ativar/desativar bot por servidor autorizado.
445. **O servidor poderá escolher canais permitidos?**  
   **Resposta:** Sim. Canais permitidos.
446. **O servidor poderá bloquear canais?**  
   **Resposta:** Sim. Canais bloqueados.
447. **O servidor poderá ativar apenas slash commands?**  
   **Resposta:** Sim. Modo apenas slash.
448. **O servidor poderá ativar apenas prefix commands?**  
   **Resposta:** Sim. Modo apenas prefixo.
449. **O servidor poderá mudar prefixo?**  
   **Resposta:** Sim. Prefixo configurável.
450. **O servidor poderá mudar idioma?**  
   **Resposta:** Sim. Idioma configurável.
451. **O servidor poderá ativar ou desativar GIFs?**  
   **Resposta:** Sim. GIFs podem ser desativados.
452. **O servidor poderá ativar ou desativar afinidade?**  
   **Resposta:** Sim. Afinidade pode ser desativada.
453. **O servidor poderá ativar ou desativar rankings?**  
   **Resposta:** Sim. Rankings podem ser desativados.
454. **O servidor poderá ativar ou desativar comandos românticos?**  
   **Resposta:** Sim. Romance pode ser desativado.
455. **O servidor poderá ativar ou desativar comandos de brincadeira?**  
   **Resposta:** Sim. Brincadeiras podem ser desativadas.
456. **O servidor poderá ativar ou desativar comandos de apoio?**  
   **Resposta:** Sim. Apoio pode ser desativado, embora recomendado ativo.
457. **Quem pode alterar configurações?**  
   **Resposta:** Dono do servidor, administradores ou cargo gerenciador definido.
458. **Apenas dono do servidor?**  
   **Resposta:** Sim, o dono sempre poderá alterar.
459. **Administradores?**  
   **Resposta:** Sim, administradores com permissão adequada.
460. **Cargos específicos?**  
   **Resposta:** Sim, cargos específicos configuráveis.
461. **O bot terá cargo de administrador interno?**  
   **Resposta:** Sim. Cargo gerenciador interno do bot.
462. **Haverá comando para definir cargo gerenciador?**  
   **Resposta:** Sim. Comando para definir cargo gerenciador.
463. **Usuários comuns podem usar todos os comandos de RP?**  
   **Resposta:** Sim, desde que não estejam bloqueados e respeitem as políticas.
464. **Usuários punidos podem ser bloqueados do bot?**  
   **Resposta:** Sim. Usuários punidos podem ser colocados em blacklist.

## 18. Dados salvos
465. **O bot salvará ID do usuário?**  
   **Resposta:** Sim. ID do usuário.
466. **O bot salvará nome de usuário?**  
   **Resposta:** Não como dado principal; nome pode aparecer apenas em cache/log curto.
467. **O bot salvará avatar?**  
   **Resposta:** Não salvará avatar; usará o avatar atual via Discord quando renderizar.
468. **O bot salvará preferências pessoais?**  
   **Resposta:** Sim. Preferências pessoais.
469. **O bot salvará bloqueios pessoais?**  
   **Resposta:** Sim. Bloqueios pessoais.
470. **O bot salvará idioma pessoal?**  
   **Resposta:** Sim. Idioma pessoal quando o recurso existir.
471. **O bot salvará comandos favoritos?**  
   **Resposta:** Não no MVP.
472. **O bot salvará ID do servidor?**  
   **Resposta:** Sim. ID do servidor.
473. **O bot salvará ID dos dois usuários?**  
   **Resposta:** Sim. IDs dos dois usuários.
474. **O bot salvará total de pontos?**  
   **Resposta:** Sim. Total de pontos.
475. **O bot salvará marco atual?**  
   **Resposta:** Sim. Marco atual pode ser calculado e cacheado.
476. **O bot salvará total de interações?**  
   **Resposta:** Sim. Total de interações.
477. **O bot salvará última interação?**  
   **Resposta:** Sim. Última interação.
478. **O bot salvará streak?**  
   **Resposta:** Não no MVP; campo pode existir para futuro.
479. **O bot salvará histórico de comandos usados?**  
   **Resposta:** Sim, histórico recente.
480. **O bot salvará quem iniciou mais interações?**  
   **Resposta:** Sim. Contagem por iniciador.
481. **O bot salvará prefixo?**  
   **Resposta:** Sim. Prefixo por servidor.
482. **O bot salvará idioma?**  
   **Resposta:** Sim. Idioma por servidor.
483. **O bot salvará canais permitidos?**  
   **Resposta:** Sim. Canais permitidos/bloqueados.
484. **O bot salvará categorias ativas?**  
   **Resposta:** Sim. Categorias ativas.
485. **O bot salvará configurações de cooldown?**  
   **Resposta:** Sim. Cooldowns e limites.
486. **O bot salvará configurações de ranking?**  
   **Resposta:** Sim. Configurações de ranking.
487. **O bot salvará permissões de cargos?**  
   **Resposta:** Sim. Permissões de cargos.

## 19. Banco de dados e modelos
488. **Haverá tabela de servidores?**  
   **Resposta:** Sim. Tabela `guilds`.
489. **Haverá tabela de usuários?**  
   **Resposta:** Sim. Tabela `users` ou `user_preferences`.
490. **Haverá tabela de afinidade?**  
   **Resposta:** Sim. Tabela `affinity_pairs`.
491. **Haverá tabela de interações?**  
   **Resposta:** Sim. Tabela `interactions` para histórico recente.
492. **Haverá tabela de GIFs?**  
   **Resposta:** Sim. Tabela `gifs` para catálogo persistente da GIPHY/manual com ação, categoria, status e metadados.
493. **Haverá tabela de frases?**  
   **Resposta:** Sim. Tabela `phrases` para customizações.
494. **Haverá tabela de aliases?**  
   **Resposta:** Sim. Tabela `aliases` para aliases customizados futuros.
495. **Haverá tabela de bloqueios?**  
   **Resposta:** Sim. Tabela `blocks`.
496. **Haverá tabela de configurações?**  
   **Resposta:** Sim. Tabela `settings` ou campos em `guilds`.
497. **Haverá tabela de logs administrativos?**  
   **Resposta:** Sim. Tabela `admin_logs`.
498. **Haverá tabela de estado temporário para botões?**  
   **Resposta:** Sim, se o `customId` não for suficiente. Usar `button_interaction_states` ou `ButtonInteractionState` para dados temporários de botões sem colocar dados sensíveis no `customId`.
499. **A tabela de afinidade terá guild_id?**  
   **Resposta:** Sim. `guild_id`.
500. **A tabela de afinidade terá user_a_id?**  
   **Resposta:** Sim. `user_a_id`, sempre ordenado de forma estável em relação a `user_b_id`.
501. **A tabela de afinidade terá user_b_id?**  
   **Resposta:** Sim. `user_b_id`, sempre ordenado para que A+B e B+A sejam o mesmo par.
502. **A tabela de afinidade terá points?**  
   **Resposta:** Sim. `points`.
503. **A tabela de afinidade terá interaction_count?**  
   **Resposta:** Sim. `interaction_count`.
504. **A tabela de afinidade terá last_interaction_at?**  
   **Resposta:** Sim. `last_interaction_at`.
505. **A tabela de afinidade terá streak_days?**  
   **Resposta:** Campo reservado, mas streak não entra no MVP.
506. **A tabela de afinidade terá created_at?**  
   **Resposta:** Sim. `created_at`.
507. **A tabela de afinidade terá updated_at?**  
   **Resposta:** Sim. `updated_at`.

Índices obrigatórios:

- `affinity_pairs(guild_id, user_a_id, user_b_id)` deve ser único.
- `gifs(provider, providerGifId)` deve ser único quando `providerGifId` existir.
- `admin_logs(guild_id, created_at)` deve permitir auditoria por servidor.
- `button_interaction_states(custom_id_hash)` ou equivalente deve permitir expiração/limpeza segura de estado temporário.

## 20. Experiência do usuário
508. **O usuário digita comando e recebe resposta imediatamente?**  
   **Resposta:** Sim. Resposta imediata.
509. **O bot deve responder em menos de quantos segundos?**  
   **Resposta:** Menos de 3 segundos.
510. **O bot deve apagar comandos inválidos?**  
   **Resposta:** Não. Comandos inválidos não serão apagados por padrão.
511. **O bot deve explicar erro de forma curta?**  
   **Resposta:** Sim. Erro curto e direto.
512. **O bot deve usar mensagens efêmeras em slash commands?**  
   **Resposta:** Sim para erros, configurações e consultas privadas.
513. **Erros devem ser públicos ou privados?**  
   **Resposta:** Erros de slash serão efêmeros; erros de prefixo serão públicos curtos.
514. **O resultado dos comandos de RP deve ser público?**  
   **Resposta:** Sim. Resultado de RP será público no canal.
515. **Consultas de afinidade devem ser públicas ou privadas?**  
   **Resposta:** Por padrão privadas/efêmeras; ranking será público se ativado.
516. **Configurações devem ser privadas?**  
   **Resposta:** Sim. Configurações devem ser privadas/efêmeras.
517. **O que aparece se o usuário não mencionar alvo?**  
   **Resposta:** “Marque um usuário para usar essa ação.”
518. **O que aparece se o usuário mencionar a si mesmo?**  
   **Resposta:** “Você não pode usar essa ação em si mesmo.”
519. **O que aparece se o usuário mencionar bot?**  
   **Resposta:** “Essa ação só funciona com usuários reais.”
520. **O que aparece se o comando estiver em cooldown?**  
   **Resposta:** “Aguarde alguns segundos antes de usar novamente.”
521. **O que aparece se a categoria estiver desativada?**  
   **Resposta:** “Essa categoria está desativada neste servidor.”
522. **O que aparece se o alvo bloqueou interações?**  
   **Resposta:** “Esse usuário não está recebendo esse tipo de interação.”
523. **O que aparece se não houver GIF cadastrado?**  
   **Resposta:** “Não encontrei GIF aprovado agora. Tentando buscar na GIPHY...” ou, se a cota acabar: “Sem GIF disponível no momento; enviando apenas texto.”
524. **O que aparece se o bot não tiver permissão de enviar mensagem?**  
   **Resposta:** Não consegue responder no canal; registra log e, se possível, avisa administrador por outro meio.
525. **O que aparece se o banco de dados falhar?**  
   **Resposta:** “Erro interno ao salvar dados. A ação foi enviada, mas a afinidade pode não ter sido registrada.”

## 21. Segurança e moderação
526. **O bot deve impedir NSFW?**  
   **Resposta:** Sim. Deve impedir NSFW.
527. **O bot deve funcionar em canais NSFW?**  
   **Resposta:** Não por padrão. Em canais NSFW, o bot pode desativar RP romântico e GIFs.
528. **O bot deve bloquear comandos românticos em canais específicos?**  
   **Resposta:** Sim. Romance pode ser bloqueado por canal.
529. **O bot deve bloquear palavras proibidas em frases personalizadas?**  
   **Resposta:** Sim. Frases personalizadas passam por filtro.
530. **O bot deve impedir spam?**  
   **Resposta:** Sim. Anti-spam por cooldown.
531. **O bot deve impedir flood de comandos?**  
   **Resposta:** Sim. Anti-flood por usuário e servidor.
532. **O bot deve impedir uso por usuários silenciados?**  
   **Resposta:** Sim, respeitando permissões e cargos configurados.
533. **O bot deve respeitar permissões do Discord?**  
   **Resposta:** Sim. Sempre respeitará permissões do Discord.
534. **O bot deve registrar abuso?**  
   **Resposta:** Sim. Abusos e bloqueios serão registrados.
535. **O bot terá canal de logs?**  
   **Resposta:** Sim. Canal privado de logs opcional.
536. **Logs mostrarão comandos usados?**  
   **Resposta:** Sim, com comando, autor, alvo e servidor, sem conteúdo sensível desnecessário.
537. **Logs mostrarão mudanças de configuração?**  
   **Resposta:** Sim. Mudanças de configuração serão logadas.
538. **Logs mostrarão reset de pontos?**  
   **Resposta:** Sim. Reset de pontos será logado.
539. **Logs mostrarão adição e remoção de GIFs?**  
   **Resposta:** Sim. Adição/remoção/desativação de GIFs será logada.
540. **Logs mostrarão bloqueios de usuários?**  
   **Resposta:** Sim. Bloqueios relevantes serão logados.
541. **Logs mostrarão erros técnicos?**  
   **Resposta:** Sim. Erros técnicos serão logados.
542. **Quem poderá ver os logs?**  
   **Resposta:** Dono, administradores autorizados e cargo gerenciador.

## 22. Sistema de cooldown
543. **Cada usuário terá cooldown global?**  
   **Resposta:** Sim.
544. **O cooldown global será de quantos segundos?**  
   **Resposta:** 8 segundos por usuário.
545. **O cooldown será diferente por categoria?**  
   **Resposta:** Sim. Romance e apoio podem ter cooldown maior.
546. **O cooldown será diferente para comandos de ranking?**  
   **Resposta:** Sim. Ranking terá cooldown maior, como 30 segundos.
547. **O cooldown será diferente para comandos administrativos?**  
   **Resposta:** Sim. Admin terá cooldown baixo, mas com permissão.
548. **O mesmo par pode ganhar pontos várias vezes seguidas?**  
   **Resposta:** Pode usar comandos, mas não ganhar pontos repetidos sem limite.
549. **Haverá cooldown de pontos entre o mesmo par?**  
   **Resposta:** Sim. 10 minutos para pontuar novamente o mesmo par com o mesmo comando.
550. **O comando ainda funciona durante cooldown, mas sem pontos?**  
   **Resposta:** Sim. Funciona sem pontos durante cooldown.
551. **O bot avisará quando não ganhou pontos por cooldown?**  
   **Resposta:** Sim, em rodapé discreto.
552. **O cooldown será mostrado no /afinidade?**  
   **Resposta:** Sim. `/afinidade` pode mostrar cooldown/limite restante.
553. **Quantos pontos um par pode ganhar por dia?**  
   **Resposta:** 25 pontos por par por dia.
554. **Quantas interações pontuadas um usuário pode fazer por dia?**  
   **Resposta:** 50 interações pontuadas por usuário por dia.
555. **O limite diário reseta em qual horário?**  
   **Resposta:** Meia-noite do fuso configurado do servidor.
556. **O reset usa horário do servidor, UTC ou horário configurado?**  
   **Resposta:** Horário configurado do servidor; padrão America/Sao_Paulo.
557. **Administradores podem alterar limite diário?**  
   **Resposta:** Sim. Administradores podem alterar dentro de limites seguros.

## 23. Balanceamento dos pontos
558. **hug dá quantos pontos?**  
   **Resposta:** +2.
559. **beijotesta dá quantos pontos?**  
   **Resposta:** +2.
560. **beijobochecha dá quantos pontos?**  
   **Resposta:** +2.
561. **cafune dá quantos pontos?**  
   **Resposta:** +2.
562. **colo dá quantos pontos?**  
   **Resposta:** +2.
563. **segurarmao dá quantos pontos?**  
   **Resposta:** +2.
564. **selinho dá quantos pontos?**  
   **Resposta:** +3.
565. **flertar dá quantos pontos?**  
   **Resposta:** +2.
566. **morder dá quantos pontos?**  
   **Resposta:** +1.
567. **cutucar dá quantos pontos?**  
   **Resposta:** +1.
568. **consolar dá quantos pontos?**  
   **Resposta:** +3.
569. **proteger dá quantos pontos?**  
   **Resposta:** +3.
570. **acalmar dá quantos pontos?**  
   **Resposta:** +3.
571. **cuidar dá quantos pontos?**  
   **Resposta:** +3.
572. **Comandos de apoio devem valer mais?**  
   **Resposta:** Sim. Apoio vale mais que brincadeira e carinho comum.
573. **Comandos românticos devem valer mais?**  
   **Resposta:** Sim, mas sem exagerar: romance leve vale +3 no máximo padrão.
574. **Brincadeiras devem valer menos?**  
   **Resposta:** Sim. Brincadeiras valem menos.
575. **Comandos aleatórios devem valer valor médio?**  
   **Resposta:** Sim. Comandos aleatórios usam valor médio da categoria sorteada.
576. **Comandos repetidos devem valer menos?**  
   **Resposta:** Sim. Repetidos durante cooldown não pontuam.
577. **Interações raras devem valer mais?**  
   **Resposta:** Não no MVP. Raridade não altera pontos.

## 24. Progressão e títulos
578. **O bot terá títulos de relação?**  
   **Resposta:** Sim. Títulos de relação.
579. **Os títulos serão baseados no total de pontos?**  
   **Resposta:** Sim. Baseados no total de pontos.
580. **Os títulos serão exibidos nos rankings?**  
   **Resposta:** Sim. Exibidos nos rankings.
581. **Os títulos serão exibidos nas interações?**  
   **Resposta:** Sim. Exibidos nas interações quando afinidade estiver ativa.
582. **Os títulos serão exibidos no perfil?**  
   **Resposta:** Sim. Exibidos no perfil RP.
583. **O bot anunciará novo título?**  
   **Resposta:** Sim. O bot anunciará novo título se a configuração estiver ativa.
584. **O anúncio será no canal atual?**  
   **Resposta:** Sim. Anúncio no canal atual.
585. **O anúncio será privado?**  
   **Resposta:** Não por padrão; privado pode ser configuração futura.
586. **O anúncio poderá ser desativado?**  
   **Resposta:** Sim. Anúncio desativável.
587. **O nível 0 será “Desconhecidos”?**  
   **Resposta:** Sim.
588. **O nível 1 será “Conhecidos”?**  
   **Resposta:** Sim.
589. **O nível 2 será “Colegas”?**  
   **Resposta:** Sim.
590. **O nível 3 será “Amigos”?**  
   **Resposta:** Sim.
591. **O nível 4 será “Bons Amigos”?**  
   **Resposta:** Sim.
592. **O nível 5 será “Próximos”?**  
   **Resposta:** Sim.
593. **O nível 6 será “Laço Fofo”?**  
   **Resposta:** Sim.
594. **O nível 7 será “Laço Especial”?**  
   **Resposta:** Sim.
595. **O nível 8 será “Inseparáveis”?**  
   **Resposta:** Sim.
596. **O nível 9 será “Laço Lendário”?**  
   **Resposta:** Sim. Esse é o padrão neutro. “Alma gêmea de RP” só pode existir como opção configurável para servidores românticos.
597. **O nível máximo terá nome especial?**  
   **Resposta:** Sim. Nome especial padrão: “Laço Lendário”.

## 25. Arquitetura do código
598. **O código terá pasta para comandos slash?**  
   **Resposta:** Sim. Pasta para slash commands, contendo apenas parsing/adaptação e chamada aos serviços.
599. **O código terá pasta para comandos prefix?**  
   **Resposta:** Sim. Pasta para prefix commands ou adaptadores de prefixo, sem regra de negócio.
600. **O código terá handler único para os dois tipos?**  
   **Resposta:** Sim. Slash commands e prefix commands devem compartilhar a mesma lógica de domínio.
601. **O código terá arquivo central de ações?**  
   **Resposta:** Sim. Terá `actionService.ts` como serviço central e genérico de ações de RP.
602. **O código terá arquivo de aliases?**  
   **Resposta:** Sim. Arquivo de aliases.
603. **O código terá arquivo de frases?**  
   **Resposta:** Sim. Arquivo de frases.
604. **O código terá arquivo de GIFs?**  
   **Resposta:** Sim. Arquivo apenas para seed/configuração; o catálogo real de GIFs ficará no banco.
605. **O código terá camada de banco de dados?**  
   **Resposta:** Sim. Camada de banco de dados.
606. **O código terá camada de serviços?**  
   **Resposta:** Sim. Camada de serviços.
607. **O código terá logs separados?**  
   **Resposta:** Sim. Logs separados por técnico, admin e uso.
608. **Todos os comandos de RP usarão uma função genérica?**  
   **Resposta:** Sim. Toda ação de RP deve passar por `actionService.ts`; comandos e botões não duplicam regra de negócio.
609. **Essa função receberá autor, alvo, ação, frases, gifs e pontos?**  
   **Resposta:** Sim. Receberá contexto com autor, alvo, ação, guild, origem (`slash`, `prefix` ou `button`), mensagem personalizada filtrada e opções de resposta.
610. **A função validará bloqueios?**  
   **Resposta:** Sim. Validará bloqueios.
611. **A função validará cooldown?**  
   **Resposta:** Sim. Validará cooldown.
612. **A função calculará pontos?**  
   **Resposta:** Sim. Calculará pontos.
613. **A função escolherá frase?**  
   **Resposta:** Sim. Escolherá frase.
614. **A função escolherá GIF?**  
   **Resposta:** Sim. Escolherá GIF.
615. **A função montará embed?**  
   **Resposta:** Sim. Montará embed/card de RP com GIF grande e componentes criados por `buttonService`.
616. **A função salvará histórico?**  
   **Resposta:** Sim. Salvará histórico.
617. **A função retornará erro amigável?**  
   **Resposta:** Sim. Retornará erro amigável.

### Serviços obrigatórios

O projeto deve conter estes serviços no MVP:

- `actionService.ts`
- `affinityService.ts`
- `gifService.ts`
- `giphyProviderService.ts`
- `gifModerationService.ts`
- `gifRatioService.ts`
- `phraseService.ts`
- `cooldownService.ts`
- `permissionService.ts`
- `blockService.ts`
- `buttonService.ts`
- `retributeService.ts`

Responsabilidades obrigatórias:

- `actionService.ts`: única fonte da lógica de ação de RP.
- `retributeService.ts`: valida o clique em `Retribuir` e chama `actionService` com autor/alvo invertidos.
- `buttonService.ts`: cria botões e `customId` mínimo e seguro.
- `gifService.ts`: decide entre banco aprovado e GIPHY, respeitando proporção e cota.
- `giphyProviderService.ts`: encapsula chamadas à GIPHY API.
- `gifRatioService.ts`: aplica a proporção progressiva por `action/category`.
- `gifModerationService.ts`: aprova, bloqueia, move e lista GIFs.
- `permissionService.ts`, `blockService.ts` e `cooldownService.ts`: validam permissões, bloqueios, consentimento e anti-farm antes de pontuar.

### Componentes de botão

- `interactionHandler.ts` deve lidar com slash commands e button interactions.
- `messageHandler.ts` deve lidar com prefix commands.
- `buttonService.ts` deve criar os botões de ação.
- `retributeService.ts` deve processar o botão `Retribuir`.
- `actionService.ts` continua sendo a única fonte da lógica de ação.
- O botão `Retribuir` não deve duplicar regra de negócio.
- Ao clicar em `Retribuir`, `retributeService` chama `actionService` com autor e alvo invertidos.

## 26. Estrutura de arquivos
618. **Haverá arquivo .env?**  
   **Resposta:** Sim, mas arquivos `.env` reais não devem ser versionados. A pasta `env/` terá apenas exemplos.
619. **Haverá arquivo config.json?**  
   **Resposta:** Não como fonte principal obrigatória. Padrões globais devem ficar em `src/config/defaults.ts` e dados estruturados em `data/*.json`.
620. **Haverá arquivo actions.json?**  
   **Resposta:** Sim. `actions.json`.
621. **Haverá arquivo aliases.json?**  
   **Resposta:** Sim. `aliases.json`.
622. **Haverá arquivo phrases.json?**  
   **Resposta:** Sim. `phrases.json`.
623. **Haverá arquivo gifs.json?**  
   **Resposta:** Não como catálogo principal. O catálogo persistente fica no banco; termos de busca ficam em `data/giphy-search-terms.json`.
624. **Haverá arquivo milestones.json?**  
   **Resposta:** Sim. `milestones.json`.
625. **Haverá arquivo de permissões?**  
   **Resposta:** Permissões dinâmicas ficam no banco; defaults podem ficar em JSON.
626. **Haverá arquivo de comandos desativados?**  
   **Resposta:** Comandos desativados ficam no banco por servidor.
627. **GIFs ficam no banco ou em JSON?**  
   **Resposta:** No banco. JSON pode existir apenas para termos de busca ou seed mínima; GIFs importados/usados pela GIPHY devem gerar registro persistente.
628. **Frases ficam no banco ou em JSON?**  
   **Resposta:** Base em JSON; customizadas no banco.
629. **Aliases ficam no banco ou em JSON?**  
   **Resposta:** Base em JSON; customizados no banco futuramente.
630. **Marcos ficam no banco ou em JSON?**  
   **Resposta:** Base em JSON; customizados no banco futuramente.
631. **Configurações por servidor ficam no banco?**  
   **Resposta:** Sim. Configurações por servidor no banco.
632. **Preferências por usuário ficam no banco?**  
   **Resposta:** Sim. Preferências por usuário no banco.
633. **Pontos sempre ficam no banco?**  
   **Resposta:** Sim. Pontos sempre no banco.

Estrutura recomendada do projeto:

```txt
rp-affection-bot/
├─ package.json
├─ tsconfig.json
├─ README.md
├─ .gitignore
├─ env/
│  ├─ .env.example
│  ├─ .env.development.example
│  ├─ .env.production.example
│  └─ README.md
├─ docs/
│  └─ GDD.md
├─ data/
│  ├─ actions.json
│  ├─ aliases.json
│  ├─ phrases.json
│  ├─ milestones.json
│  └─ giphy-search-terms.json
├─ prisma/
│  └─ schema.prisma
└─ src/
   ├─ index.ts
   ├─ client.ts
   ├─ config/
   │  ├─ env.ts
   │  ├─ defaults.ts
   │  └─ gifRatio.ts
   ├─ commands/
   ├─ handlers/
   ├─ services/
   ├─ database/
   ├─ types/
   └─ utils/
```

Regras estruturais:

- O bot não deve ser um único arquivo gigante.
- A arquitetura deve ser modular.
- Comandos não devem conter regra de negócio.
- Slash commands e prefix commands devem compartilhar a mesma lógica.
- Toda ação de RP deve passar por `actionService.ts`.
- `repositories` podem ficar dentro de `src/database/` ou em `src/repositories/`, desde que a camada de acesso a dados fique separada dos comandos e serviços.

## 27. Permissões do Discord
634. **O bot precisa enviar mensagens?**  
   **Resposta:** Sim. `Send Messages`.
635. **O bot precisa enviar embeds?**  
   **Resposta:** Sim. `Embed Links`.
636. **O bot precisa anexar arquivos?**  
   **Resposta:** Não no MVP. A Aurora usa embeds com mídia da GIPHY; anexos ficam opcionais apenas para fallback futuro aprovado.
637. **O bot precisa usar emojis externos?**  
   **Resposta:** Opcional. O bot não dependerá disso no MVP.
638. **O bot precisa ler histórico de mensagens?**  
   **Resposta:** Opcional. Útil para contexto, mas não obrigatório.
639. **O bot precisa ler conteúdo de mensagens para prefix commands?**  
   **Resposta:** Sim. Para prefix commands.
640. **O bot precisa gerenciar mensagens?**  
   **Resposta:** Não no MVP.
641. **O bot precisa criar comandos slash?**  
   **Resposta:** Sim. Permissão de aplicações/comandos slash no convite.
642. **O bot precisa responder interações?**  
   **Resposta:** Sim. Precisa responder interações.
643. **O que acontece se o bot não puder enviar embed?**  
   **Resposta:** Usa mensagem simples como fallback.
644. **O que acontece se o bot não puder enviar GIF?**  
   **Resposta:** Envia apenas texto.
645. **O que acontece se o bot não puder responder slash command?**  
   **Resposta:** Registra erro; a interação pode falhar se a permissão estiver ausente.
646. **O que acontece se o bot não puder ler mensagens com prefixo?**  
   **Resposta:** Comandos `-` ficam indisponíveis; slash continua funcionando.
647. **O bot deve avisar administradores sobre permissões ausentes?**  
   **Resposta:** Sim. Aviso por comando de diagnóstico ou canal de logs.

## 28. Comandos slash
648. **Os slash commands serão globais ou por servidor?**  
   **Resposta:** Por servidor autorizado no MVP, para atualização rápida.
649. **Como o bot registrará comandos novos?**  
   **Resposta:** Por script de deploy lendo a definição dos comandos.
650. **Como o bot removerá comandos antigos?**  
   **Resposta:** O script compara comandos atuais e remove os obsoletos.
651. **Como o bot atualizará descrições?**  
   **Resposta:** Atualizando a definição e rodando deploy.
652. **Como o bot lidará com limite de comandos slash?**  
   **Resposta:** Usará comandos principais e `/rp ação` com autocomplete para evitar excesso.
653. **Comandos com nomes acentuados serão evitados?**  
   **Resposta:** Sim. Nomes acentuados serão evitados em slash.
654. **Slash commands usarão nomes sem acento?**  
   **Resposta:** Sim. Slash commands sem acento.
655. **Slash commands terão descrições em português?**  
   **Resposta:** Sim. Descrições em português.
656. **Slash commands terão opções obrigatórias?**  
   **Resposta:** Sim. A opção `usuário` será obrigatória para ações.
657. **Slash commands terão autocomplete?**  
   **Resposta:** Sim. Autocomplete para ação em `/rp` e configs.
658. **Cada comando será separado?**  
   **Resposta:** No MVP, comandos principais podem ser separados; arquitetura permitirá agrupamento.
659. **Haverá comando /rp ação usuário em vez de muitos comandos separados?**  
   **Resposta:** Sim. `/rp ação usuário` será o caminho escalável.
660. **Haverá subcomandos por categoria?**  
   **Resposta:** Sim. Subcomandos por categoria em comandos de ajuda/config.
661. **O bot terá muitos slash commands ou poucos comandos agrupados?**  
   **Resposta:** Poucos comandos agrupados, com atalhos diretos para ações principais.
662. **Qual opção é mais confortável para o usuário?**  
   **Resposta:** Para usuário comum: atalhos diretos principais + autocomplete em `/rp`.

## 29. Comandos por prefixo
663. **Como o bot identificará o comando?**  
   **Resposta:** Pelo prefixo configurado e primeiro termo após o prefixo.
664. **Como o bot identificará o alvo?**  
   **Resposta:** Por menção ou ID; slash usa opção de usuário.
665. **O bot aceitará múltiplos espaços?**  
   **Resposta:** Sim. Múltiplos espaços serão normalizados.
666. **O bot aceitará comando com acento?**  
   **Resposta:** Sim. Prefixo aceitará comando com acento.
667. **O bot normalizará acentos?**  
   **Resposta:** Sim. Normalização de acentos.
668. **O bot converterá tudo para minúsculo?**  
   **Resposta:** Sim. Tudo será convertido para minúsculo.
669. **O bot aceitará aliases curtos?**  
   **Resposta:** Sim. Aliases curtos serão aceitos.
670. **O bot responderá se o usuário esquecer o alvo?**  
   **Resposta:** Sim. Retorna erro curto pedindo alvo.
671. **O bot ignorará mensagens comuns?**  
   **Resposta:** Sim. Mensagens comuns serão ignoradas.
672. **O prefixo será fixo em -?**  
   **Resposta:** Padrão fixo inicial: `-`.
673. **O prefixo poderá ser alterado?**  
   **Resposta:** Sim. Poderá ser alterado por servidor.
674. **O bot aceitará menção como prefixo?**  
   **Resposta:** Sim. Menção ao bot poderá funcionar como prefixo auxiliar.
675. **O bot terá comando para descobrir o prefixo?**  
   **Resposta:** Sim. Comando `prefixo`/`help` mostrará prefixo atual.
676. **Como evitar conflito com outros bots?**  
   **Resposta:** Prefixo configurável e slash commands reduzem conflito com outros bots.

## 30. Personalização
677. **O servidor poderá editar frases?**  
   **Resposta:** Sim. Servidor poderá editar frases.
678. **O servidor poderá editar GIFs?**  
   **Resposta:** Sim. Servidor poderá editar GIFs.
679. **O servidor poderá editar pontos por comando?**  
   **Resposta:** Sim. Servidor poderá editar pontos por comando, dentro de limites.
680. **O servidor poderá editar marcos?**  
   **Resposta:** Sim. Marcos editáveis em versão pós-MVP.
681. **O servidor poderá editar nomes das categorias?**  
   **Resposta:** Sim. Nomes de categorias editáveis futuramente.
682. **O servidor poderá desativar aliases?**  
   **Resposta:** Sim. Aliases poderão ser desativados futuramente.
683. **O servidor poderá criar comandos customizados?**  
   **Resposta:** Sim, mas após o MVP.
684. **O servidor poderá criar ações próprias?**  
   **Resposta:** Sim, mas após o MVP.
685. **O servidor poderá mudar cores dos embeds?**  
   **Resposta:** Sim. Cores de embeds configuráveis.
686. **O servidor poderá mudar emoji de cada categoria?**  
   **Resposta:** Sim. Emoji por categoria configurável.
687. **O usuário poderá escolher idioma?**  
   **Resposta:** Sim. Usuário poderá escolher idioma quando houver multi-idioma.
688. **O usuário poderá escolher se aparece no ranking?**  
   **Resposta:** Sim. Usuário poderá ocultar-se do ranking.
689. **O usuário poderá bloquear comandos românticos?**  
   **Resposta:** Sim. Bloqueio de romance.
690. **O usuário poderá bloquear comandos de brincadeira?**  
   **Resposta:** Sim. Bloqueio de brincadeiras.
691. **O usuário poderá ocultar afinidade?**  
   **Resposta:** Sim. Ocultar afinidade/ranking.
692. **O usuário poderá resetar seus dados?**  
   **Resposta:** Sim. Reset/apagar dados próprios.
693. **O usuário poderá ver seus dados salvos?**  
   **Resposta:** Sim. Comando para ver dados salvos.

## 31. Embeds e visual
694. **Qual será a cor padrão do embed?**  
   **Resposta:** Rosa claro/roxo suave, por exemplo `#F7A8C8`.
695. **Cada categoria terá cor própria?**  
   **Resposta:** Sim. Cada categoria terá cor própria.
696. **Cada ação terá emoji próprio?**  
   **Resposta:** Sim. Cada ação terá emoji próprio.
697. **O título do embed terá nome da ação?**  
   **Resposta:** Sim, mas a prioridade visual é a frase principal no topo, por exemplo “@UsuarioA abraçou @UsuarioB!”.
698. **A descrição terá frase de RP?**  
   **Resposta:** Sim. Descrição com frase de RP.
699. **O rodapé terá pontos de afinidade?**  
   **Resposta:** Sim. Rodapé com ganho e total de afinidade.
700. **O rodapé terá marco atual?**  
   **Resposta:** Sim. Rodapé ou campo com marco atual.
701. **O embed terá thumbnail?**  
   **Resposta:** Sim. Thumbnail do alvo ou autor.
702. **O embed terá imagem principal com GIF?**  
   **Resposta:** Sim. GIF grande como imagem principal dentro do embed.
703. **O embed terá timestamp?**  
   **Resposta:** Sim. Timestamp opcional ativado por padrão.
704. **O embed mostrará Fulano abraçou Ciclano com carinho?**  
   **Resposta:** Sim. Exibirá frase como “Fulano abraçou Ciclano com carinho”.
705. **O embed mostrará +2 afinidade?**  
   **Resposta:** Sim. Exibirá `+2 afinidade` quando pontuar.
706. **O embed mostrará Afinidade total: 27?**  
   **Resposta:** Sim. Exibirá total.
707. **O embed mostrará Marco: Amigos?**  
   **Resposta:** Sim. Exibirá marco.
708. **O embed mostrará Limite diário atingido?**  
   **Resposta:** Sim, de forma discreta.
709. **O embed mostrará autor e alvo com menções?**  
   **Resposta:** Sim, conforme configuração de menção.

Regras visuais obrigatórias para respostas públicas de RP:

- Mostrar frase principal no topo.
- Mostrar autor, ação e alvo.
- Mostrar GIF grande dentro do embed.
- Mostrar botão `😊 Retribuir` abaixo do embed.
- Não mostrar botão `Fonte da Imagem`.
- Não mostrar dica de gênero ou configuração de gênero.
- Não mostrar nome de arquivo do GIF.
- Não mostrar URL do GIF.
- Não mostrar `provider_gif_id`, `providerGifId` ou ID interno de GIF.
- Não poluir o embed com dados administrativos; isso fica em comandos como `/giflist` ou logs.

Exemplo de resposta pública limpa:

```txt
@UsuarioA abraçou @UsuarioB!

[GIF grande da ação]

😊 Retribuir
```

## 32. Testes
710. **Como testar comando com alvo válido?**  
   **Resposta:** Usar comando com menção/ID válido e verificar resposta, GIF e pontos.
711. **Como testar comando sem alvo?**  
   **Resposta:** Usar comando sem alvo e confirmar erro curto.
712. **Como testar comando em si mesmo?**  
   **Resposta:** Usar comando em si mesmo e confirmar bloqueio.
713. **Como testar comando com bot?**  
   **Resposta:** Usar alvo bot e confirmar bloqueio.
714. **Como testar cooldown?**  
   **Resposta:** Executar comandos repetidos e confirmar cooldown.
715. **Como testar limite diário?**  
   **Resposta:** Forçar limite diário e confirmar que RP continua sem pontos.
716. **Como testar ganho de pontos?**  
   **Resposta:** Checar banco antes/depois da interação.
717. **Como testar ranking?**  
   **Resposta:** Criar pares com pontuações diferentes e conferir ordenação.
718. **Como testar bloqueios?**  
   **Resposta:** Ativar bloqueio e testar interação impedida.
719. **Como testar GIF inexistente?**  
   **Resposta:** Remover GIFs da ação e confirmar fallback textual.
720. **Como testar permissão ausente?**  
   **Resposta:** Remover permissão em canal de teste e validar fallback/log.
721. **Como testar se afinidade salva corretamente?**  
   **Resposta:** Criar interação e consultar linha no SQLite.
722. **Como testar se o par é bidirecional?**  
   **Resposta:** Consultar A+B e B+A e confirmar mesmo registro.
723. **Como testar se ranking ordena corretamente?**  
   **Resposta:** Inserir dados de teste e validar ordenação descendente.
724. **Como testar reset de pontos?**  
   **Resposta:** Executar reset e confirmar pontos zerados e log criado.
725. **Como testar backup?**  
   **Resposta:** Gerar backup e conferir arquivo restaurável.
726. **Como testar migração de banco?**  
   **Resposta:** Rodar migração em cópia do banco e validar schema.
727. **Como testar corrupção de dados?**  
   **Resposta:** Testar com cópia corrompida e confirmar erro seguro/backup.

## 33. Administração e manutenção
728. **O bot terá apenas comandos administrativos?**  
   **Resposta:** Sim. Apenas comandos administrativos no Discord.
729. **O bot terá painel externo?**  
   **Resposta:** Não no MVP. Sem painel externo.
730. **Como não terá painel externo, tudo será feito por comandos no Discord?**  
   **Resposta:** Sim. Não haverá painel externo no MVP. A exceção é a integração com a GIPHY API, que será usada para buscar GIFs.
731. **Quem poderá cadastrar GIFs?**  
   **Resposta:** Dono, administradores ou cargo gerenciador.
732. **Quem poderá cadastrar frases?**  
   **Resposta:** Dono, administradores ou cargo gerenciador.
733. **Quem poderá alterar pontos?**  
   **Resposta:** Dono, administradores ou cargo gerenciador.
734. **Quem poderá resetar dados?**  
   **Resposta:** Dono, administradores ou cargo gerenciador, com logs.
735. **Quem poderá exportar dados?**  
   **Resposta:** Dono e administradores autorizados.
736. **Quem poderá importar dados?**  
   **Resposta:** Dono e administradores autorizados.
737. **O backup será manual?**  
   **Resposta:** Manual e automático.
738. **O backup será automático?**  
   **Resposta:** Sim. Automático diário.
739. **Onde o backup será salvo?**  
   **Resposta:** Na VPS em pasta protegida; opcionalmente cópia externa privada.
740. **Com que frequência o backup será feito?**  
   **Resposta:** Diariamente e antes de migrações.
741. **Como restaurar backup?**  
   **Resposta:** Parar o bot, substituir banco/arquivos, rodar verificação e religar.
742. **O bot deve pausar durante restauração?**  
   **Resposta:** Sim. Pausar durante restauração.
743. **O backup incluirá GIFs?**  
   **Resposta:** Sim. Inclui registros e metadados de GIFs no banco, como `providerGifId`, status, ação e categoria; não precisa incluir arquivos de mídia da GIPHY.
744. **O backup incluirá frases?**  
   **Resposta:** Sim. Inclui frases.
745. **O backup incluirá afinidade?**  
   **Resposta:** Sim. Inclui afinidade.

## 34. Logs técnicos
746. **O bot registrará erros em arquivo?**  
   **Resposta:** Sim. Erros em arquivo.
747. **O bot registrará erros no console?**  
   **Resposta:** Sim. Erros no console.
748. **O bot enviará erros para canal privado?**  
   **Resposta:** Sim. Erros críticos em canal privado.
749. **O log incluirá stack trace?**  
   **Resposta:** Sim, apenas em log técnico privado.
750. **O log incluirá comando usado?**  
   **Resposta:** Sim. Inclui comando usado.
751. **O log incluirá servidor?**  
   **Resposta:** Sim. Inclui servidor/guild ID.
752. **O log incluirá usuário?**  
   **Resposta:** Sim. Inclui usuário por ID.
753. **O log deve evitar salvar conteúdo sensível?**  
   **Resposta:** Sim. Não salvar mensagens personalizadas sensíveis sem necessidade.
754. **Por quanto tempo logs serão mantidos?**  
   **Resposta:** 30 dias para logs técnicos; logs administrativos podem ficar 180 dias.
755. **Quantos comandos foram usados hoje?**  
   **Resposta:** Métrica exibida em `/status`.
756. **Quais comandos são mais usados?**  
   **Resposta:** Métrica exibida em `/status` ou relatório admin.
757. **Quais categorias são mais usadas?**  
   **Resposta:** Métrica exibida em relatório admin.
758. **Quantos pares de afinidade existem?**  
   **Resposta:** Métrica exibida em relatório admin.
759. **Quantos usuários ativos existem?**  
   **Resposta:** Métrica exibida em relatório admin.
760. **Quantos GIFs existem por comando?**  
   **Resposta:** Métrica exibida em `/giflist`/status admin: aprovados, pendentes, bloqueados, uncategorized, usos e chamadas GIPHY consumidas.
761. **Quantas frases existem por comando?**  
   **Resposta:** Métrica exibida em `/fraselist`/status admin.

## 35. Privacidade
762. **O bot salvará apenas IDs do Discord?**  
   **Resposta:** Sim. Apenas IDs como dado principal.
763. **O bot evitará salvar nomes mutáveis?**  
   **Resposta:** Sim. Nomes mutáveis não serão base de dados.
764. **O bot permitirá apagar dados de um usuário?**  
   **Resposta:** Sim. Comando de apagar dados.
765. **O bot permitirá exportar dados de um usuário?**  
   **Resposta:** Sim. Exportação dos próprios dados.
766. **O bot terá comando para ver dados salvos?**  
   **Resposta:** Sim. Comando para ver dados salvos.
767. **O bot apagará dados de usuários que saíram?**  
   **Resposta:** Pode apagar ou ocultar após política configurada.
768. **O bot apagará dados após inatividade longa?**  
   **Resposta:** Sim. Limpeza após 12 meses de inatividade, se ativada.
769. **Quem pode acessar dados de afinidade?**  
   **Resposta:** Usuários envolvidos e administradores autorizados, conforme tipo de dado.
770. **Ranking público pode expor interações indesejadas?**  
   **Resposta:** Sim. Por isso ranking poderá ser desativado e usuários podem ocultar dados.
771. **Usuários podem ocultar relações do ranking?**  
   **Resposta:** Sim. Opt-out/ocultação de relações no ranking.

## 36. MVP
772. **Quais comandos entram na primeira versão?**  
   **Resposta:** MVP: hug, beijotesta, beijobochecha, cafune, consolar, proteger, morder, cutucar, afinidade, rankafinidade, help e comandos básicos de admin.
773. **O MVP terá apenas hug, beijotesta, beijobochecha, cafune, consolar, proteger, morder e cutucar?**  
   **Resposta:** Sim. Esses oito comandos entram no MVP.
774. **O MVP terá slash commands?**  
   **Resposta:** Sim. MVP terá slash commands.
775. **O MVP terá prefix commands?**  
   **Resposta:** Sim. MVP terá prefix commands.
776. **O MVP terá aliases?**  
   **Resposta:** Sim. MVP terá aliases principais.
777. **O MVP terá banco SQLite?**  
   **Resposta:** Sim. MVP usará SQLite.
778. **O MVP terá sistema de afinidade?**  
   **Resposta:** Sim. MVP terá afinidade.
779. **O MVP terá ranking?**  
   **Resposta:** Sim. MVP terá ranking simples.
780. **O MVP terá GIFs locais?**  
   **Resposta:** Não como regra principal. MVP terá GIPHY API + banco persistente de GIFs aprovados/pendentes/uncategorized, sem depender de cache volátil e sem baixar milhares de arquivos para a VPS.
781. **O MVP terá configurações por servidor?**  
   **Resposta:** Sim. Configurações básicas por servidor entram no MVP.
782. **O MVP terá bloqueio pessoal?**  
   **Resposta:** Sim. Bloqueio pessoal entra no MVP.
783. **O MVP terá comandos administrativos de GIF?**  
   **Resposta:** Sim. `/gifadd`, `/gifbuscar`, `/gifaprovar`, `/gifbloquear`, `/gifremove`, `/gifmover`, `/giflist` e `/giftest` entram no MVP de administração de GIFs.
784. **O MVP terá comandos administrativos de frases?**  
   **Resposta:** Sim, mas pode começar limitado a dono/admin; frases base ficam em JSON.
785. **Quais comandos ficam para depois?**  
   **Resposta:** Ficam para depois: colo, segurarmao, bomdia, boanoite, presente, flor, dança, saudade, cobertor, chá e ações customizadas.
786. **Quais sistemas ficam para depois?**  
   **Resposta:** Ficam para depois: streak, painel externo, customização avançada, comandos customizados, multi-idioma completo e histórico detalhado.
787. **Streak entra na primeira versão ou depois?**  
   **Resposta:** Depois do MVP.
788. **Marcos entram na primeira versão ou depois?**  
   **Resposta:** Na primeira versão, porque marcos são simples e importantes para afinidade.
789. **Customização por servidor entra na primeira versão ou depois?**  
   **Resposta:** Depois do MVP, exceto configurações básicas.
790. **Histórico detalhado entra na primeira versão ou depois?**  
   **Resposta:** Depois do MVP.
791. **Sistema de opt-out entra na primeira versão ou depois?**  
   **Resposta:** Na primeira versão, por privacidade.

## 37. Decisões obrigatórias antes de programar
1. **Qual linguagem será usada?**  
   **Resposta:** TypeScript.
2. **Qual biblioteca do Discord será usada?**  
   **Resposta:** discord.js.
3. **O bot usará SQLite?**  
   **Resposta:** Sim. SQLite no MVP.
4. **O bot terá slash e prefix desde a primeira versão?**  
   **Resposta:** Sim. Slash e prefix desde a primeira versão.
5. **O prefixo será fixo ou configurável?**  
   **Resposta:** Configurável por servidor, com padrão `-`.
6. **O sistema de afinidade será bidirecional?**  
   **Resposta:** Sim. Bidirecional.
7. **A afinidade será separada por servidor?**  
   **Resposta:** Sim. Separada por servidor.
8. **Qual será o limite máximo de pontos?**  
   **Resposta:** 1000 pontos.
9. **Haverá perda de pontos?**  
   **Resposta:** Não. Sem perda automática.
10. **Haverá limite diário de ganho?**  
   **Resposta:** Sim. Limite diário por par e por usuário.
11. **Quais serão os marcos de afinidade?**  
   **Resposta:** Desconhecidos, Conhecidos, Colegas, Amigos, Bons Amigos, Próximos, Laço Fofo, Laço Especial, Inseparáveis e Laço Lendário.
12. **Quais comandos entram no MVP?**  
   **Resposta:** hug, beijotesta, beijobochecha, cafune, consolar, proteger, morder, cutucar, afinidade, rankafinidade, help e admin básico.
13. **Quais comandos darão pontos?**  
   **Resposta:** Ações de RP fofas, românticas leves, apoio e brincadeiras leves; consultas e admin dão 0.
14. **Quantos pontos cada categoria dará?**  
   **Resposta:** Carinho +2, romance +3, apoio +3, brincadeira +1, neutro/admin/consulta +0.
15. **Os GIFs serão todos locais/aprovados?**  
   **Resposta:** Não. O bot usará GIPHY API com banco persistente: GIFs aprovados têm prioridade, GIFs novos podem ser usados em proporção limitada e salvos como pendentes.
16. **Como GIFs serão cadastrados?**  
   **Resposta:** Por `/gifbuscar`, `/gifadd`, `/gifaprovar`, `/gifbloquear`, `/gifremove`, `/gifmover`, `/giflist` e `/giftest`, sempre salvando no banco e registrando log administrativo.
17. **Como frases serão cadastradas?**  
   **Resposta:** Base em JSON; customizadas por `/fraseadd` no banco.
18. **Usuários poderão bloquear interações?**  
   **Resposta:** Sim. Bloqueio total, por categoria e por usuário.
19. **Rankings serão públicos?**  
   **Resposta:** Sim, mas configuráveis e com opt-out/ocultação pessoal.
20. **Quais comandos serão apenas para administradores?**  
   **Resposta:** Configuração, GIFs (`gifbuscar`, `gifaprovar`, `gifbloquear`, `gifmover`, `gifremove`), frases, blacklist, resets, importação/exportação e alterações de pontuação.
21. **O MVP terá botão Retribuir?**  
   **Resposta:** Sim. Toda ação de RP terá botão `😊 Retribuir`, processado por `retributeService` e executado via `actionService`.
22. **O bot exibirá fonte, URL, arquivo, ID do GIF ou dica de gênero no embed público?**  
   **Resposta:** Não. A resposta pública deve ser limpa, com frase, GIF grande e botão `Retribuir`.
23. **Onde ficam as variáveis de ambiente de exemplo?**  
   **Resposta:** Na pasta `env/`, com `.env.example`, `.env.development.example`, `.env.production.example` e `README.md`; tokens reais nunca entram no repositório.
