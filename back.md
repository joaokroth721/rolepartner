# Pontos que precisam de backend

Varredura de `app/page.js`, `app/scenarios.js`, `app/texts.js`, `app/api/chat/route.js`, `app/api/translate/route.js`, `app/api/feedback/route.js` e `.env`.
Revisado 4x (ver notas no fim).

Legenda de necessidade: **[BD]** banco de dados, **[Auth]** contas/login, **[Integração]** serviço externo, **[Infra]** chave/segredo/proteção.

## Lista

1. **Respostas do role-play (`/api/chat`)** — JÁ EXISTE como backend.
   `app/api/chat/route.js` chama a OpenAI (`gpt-5-nano`) via AI SDK.
   Necessário: **[Integração]** provedor de IA (OpenAI direto ou AI Gateway da Vercel) + **[Infra]** `OPENAI_API_KEY` em `.env.local`. Inconsistência: o `.env.example` cita `AI_GATEWAY_API_KEY`, mas os routes usam `openai(...)` que lê `OPENAI_API_KEY`. Alinhar (trocar o `.env.example`, ou trocar o model dos routes pro gateway).

2. **Feedback de fim de conversa (`/api/feedback`)** — JÁ EXISTE como backend.
   `app/api/feedback/route.js` gera a avaliação estruturada (score, correções com `tag`, dica) via `generateObject` + enum de tags.
   Necessário: **[Integração]** mesmo provedor de IA + **[Infra]** mesma chave do item 1.

3. **Tradução sob demanda do leitor (`/api/translate`)** — JÁ EXISTE como backend. *(novo, não estava nas revisões anteriores)*
   `app/api/translate/route.js` traduz DE→EN uma palavra (LEMMA | POS | ENGLISH) ou uma frase inteira, sob demanda, quando o usuário toca no texto do leitor (`pickWord`/`pickSentence` em `page.js`). Palavras do glossário são resolvidas no cliente (`texts.js`); só o que falta no glossário e as frases batem no servidor.
   Necessário: **[Integração]** mesmo provedor de IA + **[Infra]** mesma chave do item 1.

4. **Sem proteção nas rotas de IA (custo/abuso).**
   `/api/chat`, `/api/feedback` e `/api/translate` são públicas, sem rate limit nem autenticação. Qualquer um pode chamar e gastar créditos. O `/api/translate` dispara a cada toque em palavra fora do glossário, então é o mais fácil de abusar.
   Necessário: **[Infra]** rate limiting (ex.: Upstash Redis / Vercel Firewall) e, idealmente, **[Auth]** para amarrar uso a um usuário.

5. **Chave viva versionada.** *(novo)*
   `.env.local` contém uma `OPENAI_API_KEY` real (`sk-proj-…`) em texto puro, dentro de uma pasta OneDrive sincronizada. Vaza pelo backup/sync mesmo sem git.
   Necessário: **[Infra]** revogar/rotacionar essa chave e nunca commitar a real (só `.env.example` com o campo vazio). Garantir `.env.local` no `.gitignore` se virar repositório.

6. **Repositório "Learn more" / "Review" (favoritos + tags + mastered).** — FEATURE JÁ CONSTRUÍDA no cliente, falta backend.
   A tela de revisão (tab "Review") existe. O que faz e onde salva:
   - `toggleFav()` (`app/page.js`) e `saveFavs()` gravam em `localStorage` (`"favorites"`). Favoritos são **tipados**, agora **cinco** tipos: `correction | vocab | phrase | message | keyword`. Shape:
     ```js
     // correção
     { type:"correction", wrong, right, note, tag, scenario, date, ts, reviews }
     // vocab / phrase (do briefing do cenário)
     { type:"vocab"|"phrase", de, en, scenario, date, ts, reviews }
     // keyword (palavra salva no leitor de textos)
     { type:"keyword", de, en, pos, level, scenario, date, ts, reviews }
     // mensagem do parceiro (bolha do chat)
     { type:"message", text, scenario, date, ts, reviews }
     ```
     `date` é string de exibição (`toLocaleString("pt-BR")`), `ts` é `Date.now()`, `reviews` é o contador do botão "Got it". `favKey()` gera chave única por tipo (`c|`, `v|`, `p|`, `k|`, `m|`).
   - **Tags** por tipo de erro (`Genus/Artikel`, `Verbzeit`, `Wortstellung`, `Falscher Freund`, `Wortwahl`, `Präposition`, `Sonstiges`) vêm do servidor: o LLM em `feedback/route.js` classifica cada correção via enum. Alimentam os chips e o destaque "Du sammelst oft Korrekturen zu X".
   - **Struggle highlight:** `topStruggle` é a tag de correção mais coletada entre os favoritos ativos. Calculado no cliente **a partir dos favoritos**, não do histórico de feedbacks.
   - **Mastered pile:** `markReviewed()` incrementa `reviews`; em `MASTER_AT = 3` o card vai pra seção "Gemeistert". 100% no cliente.
   Necessário: **[BD]** tabela `favorites` por usuário (`fav_key` único, `type`, `payload` jsonb, `tag`, `reviews`) + **[Auth]**. Endpoints: `GET/POST /api/favorites`, `DELETE /api/favorites/:favKey`, `PATCH .../review` (o "Got it"). **O enum de tags está duplicado** (schema em `feedback/route.js` + UI em `page.js`): extrair pra um módulo único (`app/tags.js`) importado pelos dois, pra não divergir do que o LLM emite / da coluna do BD.
   Obs.: há um seed de demonstração (`DEMO_SEED`/`SEED_FAVORITES`, no topo de `page.js` + o seed no `useEffect`) só pra visualizar a tela. **Remover ao ligar o backend.**

7. **Histórico de sessões (persistência) — pronto, a tela Verlauf lê o que é gravado.**
   `saveFeedback()` grava cada sessão em `localStorage` (`"feedbacks"`: `{ id, scenarioId, title, date, transcript, score, grammar, vocab, summary, strengths, corrections, tip }`). Mas **nada lê esse histórico pra exibir**: `loadFeedbacks()` só é chamado dentro do próprio `saveFeedback()` pra prepend. É write-only (o `ponytail:` em `page.js:500` diz exatamente isso).
   **FEITO.** A tabela `sessions` (D1) guarda transcript + evaluation + score, e `GET /api/sessions` agora lê isso de volta: sub-aba **Verlauf** dentro de Review, com lista paginada, agregado por cenário e a tela de detalhe (`openSession`). Ver `plan_session_history.md`. Não há delete: `sessions` é também a fonte do leaderboard e do streak.

8. **Contas de usuário / avatar.** — LOGIN JÁ CONSTRUÍDO (Auth.js v5, sessão JWT, sem BD).
   O topo agora mostra "Anmelden" (login Google) ou o avatar do Google + logout (`AuthButton` em `page.js`). Config em `app/auth.js`, rota `app/api/auth/[...nextauth]/route.js`, `SessionProvider` em `app/providers.js`.
   Necessário: **[Infra]** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` no `.env.local` (redirect URI `…/api/auth/callback/google`). Ainda **[Auth→BD]**: a sessão existe mas nada por-usuário é persistido; continua pré-requisito de 6, 7, 9, 14 (falta ligar `session.user` às tabelas). `streak`/`avatar` do topo ainda são estáticos (ver item 9); só o avatar do login virou real.
   **Tabela `users` (do diagrama "store email / datetime?"):** sim, precisa. `id`, `email` (do Google), `name`/`avatar_url` (cache do perfil), `created_at` (primeiro login) e `last_seen_at` (atualizado a cada acesso). É a raiz das FKs de 6, 7, 9 e 14 (`user_id`). Com Auth.js JWT sem BD, dá pra fazer um "upsert por email" no callback de sessão pra criar/atualizar a linha sem adotar o adapter de BD do Auth.js.

9. **Streak ("7 Tage") — hoje é falso, em dois lugares.**
   Valor `7` fixo no código: no topbar (`streak`) e no card de stats do "Learn more" (`<span className="lstat-num">7</span> Tage Serie`). Não reflete uso real.
   Necessário: **[BD]** tabela `daily_activity` (dias de prática por usuário) + **[Auth]** para calcular a sequência.

10. **Cenários bloqueados ("Gesperrt").**
    `scenarios.js` marca `locked: true` em `restaurant` e `arzt`; `page.js` impede abrir.
    Se o desbloqueio for por progresso, nível ou pagamento, vira backend. Se for fixo/estático, não precisa.
    Necessário (só se dinâmico): **[BD]** estado de desbloqueio por usuário + **[Auth]** (+ **[Integração]** de pagamento, caso seja pago).

11. **Voz (fala e escuta) — hoje 100% no browser.**
    STT/TTS usam a Web Speech API nativa (`speak()`/`listen()` no chat, e `playFrom`/`speakWord` no leitor). Funciona, mas só é confiável no Chrome e a voz é robótica (ver `ponytail` no topo do arquivo).
    Necessário (opcional/melhoria): **[Integração]** API de voz no servidor (ex.: OpenAI Realtime/TTS). Não é obrigatório.

12. **PostHog (analytics de produto) — A FAZER, não construído.**
    Objetivo: saber o que os usuários fazem (quais cenários abrem, onde largam a conversa, quantos chegam na avaliação, uso do leitor). Nada disso é medido hoje.
    Necessário: **[Integração]** conta PostHog (cloud) + **[Infra]** `NEXT_PUBLIC_POSTHOG_KEY` e `NEXT_PUBLIC_POSTHOG_HOST` no `.env.local`.
    Plano lazy (client-only, sem backend):
    - `npm i posthog-js`.
    - Inicializar dentro do `app/providers.js` (já é o wrapper `"use client"` do app): `posthog.init(key, { api_host: host, capture_pageview: true })` num `useEffect`, e envolver os filhos com `<PostHogProvider client={posthog}>`. Autocapture já pega cliques/pageviews sem instrumentar nada.
    - Eventos manuais só nos momentos que importam (poucas linhas, `posthog.capture(...)`): abrir cenário (`scenario_start`, com `scenarioId`), terminar conversa/ver avaliação (`feedback_shown`, com `score`), favoritar (`favorite_added`, com `type`), abrir texto (`text_open`).
    - Quando o login (item 8) estiver com usuários reais: `posthog.identify(session.user.id)` no `AuthButton`/effect pra amarrar sessão à pessoa.
    Observação de privacidade: `NEXT_PUBLIC_*` expõe a chave no client (é o esperado do PostHog); ligar mascaramento de inputs se o autocapture pegar texto digitado.

13. **Deploy no Cloudflare (free tier) — A FAZER, decisão de infra.**
    Objetivo do usuário: hospedar de graça no Cloudflare free tier.
    Caminho: **[Infra]** Cloudflare Workers via adapter **OpenNext** (`@opennextjs/cloudflare`) — é o jeito atual de rodar Next.js no Cloudflare (não o `next start` em Node). Config `wrangler` + flag `nodejs_compat`.
    Pontos de atenção (honestos, não é 1 clique):
    - **Runtime é workerd, não Node.** As 4 rotas (`/api/chat`, `/api/feedback`, `/api/translate`, `/api/auth/...`) rodam em Workers. AI SDK e Auth.js chamam via `fetch`, então devem funcionar, mas exigem teste. Segredos viram env vars/secrets do Worker (`OPENAI_API_KEY`, `GOOGLE_CLIENT_*`, `AUTH_SECRET`), não `.env.local`.
    - **Auth.js:** trocar redirect URI do Google pro domínio de produção (`https://<app>.pages.dev/api/auth/callback/google`) e setar `AUTH_URL`. Sessão JWT continua sem BD, então combina bem com o free tier.
    - **Limites do free tier:** 100k requisições/dia e teto de CPU por request; bundle do Worker limitado (~3 MB gzip no free). Cada toque em palavra fora do glossário = 1 request em `/api/translate` (ver item 4), então o rate limit vira também questão de cota, não só de custo.
    - **Alternativa mais barata de esforço:** se o free tier do Cloudflare atritar com Next 16, a Vercel roda esse app sem adapter (Hobby/free). Decisão do usuário; ele pediu Cloudflare, fica registrado aqui.

14. **Leaderboard (Score + Top 10) — A FAZER, não construído.** *(novo)*
    Fluxo (do diagrama de 16.09, confirmado pelo usuário): aparece **depois da conversa**, entre a Conversation e a Evaluation. A conversa gera um score, o Leaderboard mostra esse score e o ranking Top 10, e só então cai na avaliação detalhada. Hoje não existe: sobrou só CSS em `globals.css`, sem componente em `page.js` (ver notas das revisões 2 e 4).
    O que mostra: **Score** da sessão que acabou de terminar + **Top 10** usuários por score. É o único dado de leitura **entre todos os usuários** (ranking global), não escopável por usuário, então escala com o número de gente.
    Necessário: **[BD]** tabela `scores` (`user_id` FK, `scenario_id`, `score`, `created_at`) + **[Auth]** pra amarrar cada score a uma pessoa. Query do Top 10: agregado por usuário (melhor score ou média), `ORDER BY score DESC LIMIT 10`. Endpoints: `GET /api/leaderboard` (Top 10) e o `POST` do score no fim da conversa (mesmo momento em que hoje se gera o feedback do item 2, dá pra escrever os dois juntos).
    **Nova tela/stage:** encaixar um `stage=leaderboard` entre `stage=chat` e `stage=feedback`, atualizando a lista de telas do `CLAUDE.md` (hoje o fluxo é chat → feedback direto).

## Resumo do que é necessário

- **Banco de dados [BD]:** itens 6, 7, 9, 10 (se dinâmico) e 14. Uma base relacional (ex.: Neon Postgres do Marketplace): `users` (`email`, `created_at`, `last_seen_at`), `favorites` (`fav_key` único, `type`, `payload` jsonb, `tag`, `reviews`), `scores` (`user_id`, `scenario_id`, `score`, `created_at` — pro Leaderboard/Top 10), `daily_activity` (streak), e `sessions` só se o histórico voltar a ser lido.
- **Autenticação [Auth]:** item 8 — login Google já construído (Auth.js JWT); falta só ligar `session.user` ao BD pros itens 6, 7, 9, 10.
- **Integração externa [Integração]:** itens 1, 2 e 3 (IA, já existem), item 11 (voz, opcional) e item 12 (PostHog, a fazer). Alinhar a variável da chave.
- **Infra/segurança [Infra]:** item 4 (rate limit nas 3 rotas), item 5 (rotacionar a chave versionada) e item 13 (deploy no Cloudflare free tier via OpenNext).

## O que NÃO precisa de backend

- Menu, filtros de categoria/nível, briefing e tradução PT/EN/DE dos cenários: estático em `scenarios.js` e no cliente.
- Catálogo de textos e o glossário do leitor: estático em `texts.js`, resolvido no cliente. Só palavra fora do glossário / frase batem no `/api/translate`.
- Botão "Vorschau (Demo)" (`demo()`): dados de exemplo no cliente, de propósito.
- Seed de demonstração do "Learn more" (`DEMO_SEED`): idem, remover ao ligar o BD (ver item 6).

## Prioridade sugerida

1. Alinhar a chave de IA (item 1) + revogar a chave versionada (item 5) — barato e urgente (segredo vazando).
2. Rate limit nas 3 rotas de IA (item 4) — protege custo antes de expor publicamente. `/api/translate` é o mais exposto.
3. Auth (item 8) + BD dos favoritos (item 6) — o salto de "app local" para "produto". O "Review" já está pronto no cliente, maior retorno visível assim que persistir. Streak (9) entra junto.
4. Extrair o enum de tags pra um módulo único (item 6) — barato, evita divergência schema/UI/BD.
5. Histórico de sessões (7), desbloqueio dinâmico (10), voz melhor (11) — só quando houver demanda.

## Notas das revisões

- **Revisão 1:** chat e feedback JÁ são backend (dependem de chave/proteção, não são "faltantes").
- **Revisão 2:** achados de config: `Leaderboard` usado mas não definido; `.env.example` (`AI_GATEWAY_API_KEY`) vs. route (`OPENAI_API_KEY`).
- **Revisão 3 (após "Learn more"):** reescreveu o item de favoritos com o shape real (tipados, tags, `reviews`/mastered).
- **Revisão 4 (após leitor de textos):**
  - **Novo item 3:** existe uma terceira rota de IA, `/api/translate`, do leitor de textos. Entrou na lista e no item de proteção (agora 3 rotas).
  - **Novo item 5:** a `OPENAI_API_KEY` real está commitada no `.env.local` dentro do OneDrive. Segredo vazando.
  - **Favoritos ganharam 5º tipo `keyword`** (palavra salva no leitor). Adicionado ao shape do item 6.
  - **"Fehler-Trend" removido:** revisões anteriores descreviam um trend mês-a-mês (`monthKey`, `:453`) que **não existe** no código (`grep` não acha nada). O que existe é o `topStruggle`, e ele lê os **favoritos**, não os feedbacks.
  - **Histórico de feedbacks (antigo item 4) reclassificado (item 7):** é write-only — `loadFeedbacks()` só é usado dentro de `saveFeedback()`. Nada exibe. Baixa prioridade até uma tela consumir.
  - **Streak** também está hardcoded no card de stats do "Learn more", não só no topbar (item 9).
  - **`Leaderboard` segue inexistente** no `page.js` atual (só sobrou CSS). Removido da lista.
  - Âncoras: mantidas por nome de função, não por linha (linhas deslizam a cada edição).
- **Revisão 5 (diagrama de fluxos, 16.09):**
  - **`users` ganhou forma (item 8):** guarda `email` + timestamps (`created_at`/`last_seen_at`), respondendo ao "store email / datetime?" do diagrama. Raiz das FKs de 6, 7, 9 e 14.
  - **Leaderboard reincluído (item 14):** removido nas revisões 2 e 4 por não existir no código, mas o diagrama o coloca como tela **depois da conversa** (Conversation → Leaderboard → Evaluation), com Score + Top 10. Volta como item A FAZER (planejado), não como código existente. Precisa de `scores` + nova stage `leaderboard` entre `chat` e `feedback`.
