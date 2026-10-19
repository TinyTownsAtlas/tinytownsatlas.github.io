# Ask Tiny Towns Atlas: Cloudflare Worker

A small public Worker behind the "Ask the Atlas" chat. It answers questions with deterministic queries over the public `assistant_index.json`, and uses an OpenAI model only to choose the query and phrase the answer.

```
browser chat -> POST /chat (Worker) -> OpenAI Responses API (picks a tool)
                     |                         ^
                     v                         |
        deterministic query over the cached public Atlas index -> compact exact result
```

- `src/queries.ts`: the eight tools (find_town, get_town_profile, compare_towns, rank_towns, filter_towns, summarize_indicator, explain_indicator, get_hospital_context).
- `src/tools.ts`: strict function schemas, built from the index so measure names are enums.
- `src/openai.ts`: Responses API loop (at most 3 rounds, `store: false`, 900 output tokens, 25 s timeout).
- `src/guard.ts`: "healthiest town" style questions get the fixed no-composite reply without a model call.
- `src/index.ts`, `src/request.ts`: CORS, origin check, size and shape limits, rate limit binding.
- `../assistant/ASSISTANT_CONTEXT.md`: version-controlled instructions. After editing it run `npm run embed` (dev, deploy and typecheck do this automatically); a test fails if `src/context.generated.ts` is stale.
- `../public/data/assistant_index.json`: built by `scripts/build_assistant_index.py` (called from `build_data.py`, checked by `validate.py`). The Worker fetches it from the live site and caches it (10 min in memory, 1 h at the edge).

## One-time setup

OpenAI (platform.openai.com):
1. Create a dedicated project, for example "Tiny Towns Atlas".
2. Project settings, Limits: allow only `gpt-5.6-luna` if the project offers a model allow-list.
3. Set a small monthly budget and an email alert.
4. Create a project API key for this project only.

Cloudflare (from this folder):
```bash
npm install
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```
`wrangler secret put` prompts for the key; it is stored only in Cloudflare. Deploy prints the Worker URL (`https://tiny-towns-atlas-assistant.<subdomain>.workers.dev`). Then put `VITE_ASSISTANT_URL=<that URL>/chat` in `../.env.production`, commit it, and the GitHub Pages build shows the chat button. Without that variable the button stays hidden.

The Worker name is `tiny-towns-atlas-assistant`; it does not touch other Workers on the account.

## Local development

Copy `.dev.vars.example` to `.dev.vars` (git-ignored) and put a key in it. Serve the built site with `npm run build && npm run preview` in the repo root (port 4173), then `npm run dev` here (port 8787) and `npm run dev` in the root (port 5173; it calls `http://localhost:8787/chat` by default).

## Tests

`npm test` in the repo root runs the Worker tests (queries, guard, request validation, handler, mocked OpenAI loop, index contents). No test calls OpenAI.

## Safeguards

Origin allow-list (Atlas site and localhost), 16 kB body cap, 600 characters per user message, 8 messages of history, 900 output tokens, 15 requests per minute per IP (Workers rate limiting binding, `wrangler.toml`), no web access, no code execution, no client-defined tools, and only public data. The OpenAI spend limit is the final backstop.
