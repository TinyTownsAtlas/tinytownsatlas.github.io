import { loadIndex } from "./data";
import { compositeGuard } from "./guard";
import { runChat } from "./openai";
import { allowedOrigins, MAX_BODY_BYTES, parseChatRequest } from "./request";
import type { Env } from "./types";

const DEFAULT_MODEL = "gpt-5.6-luna";

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export async function handleRequest(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins(env);
  const originOk = origin ? allowed.includes(origin) : env.ALLOW_NO_ORIGIN === "1";
  const cors: Record<string, string> = origin && originOk
    ? { "access-control-allow-origin": origin, vary: "Origin" }
    : { vary: "Origin" };

  if (url.pathname === "/health" && request.method === "GET") return json({ ok: true }, 200, cors);

  if (url.pathname !== "/chat") return json({ error: "Not found" }, 404, cors);

  if (request.method === "OPTIONS") {
    if (!originOk) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
      },
    });
  }
  if (request.method !== "POST") return json({ error: "Use POST." }, 405, cors);
  if (!originOk) return json({ error: "Origin not allowed." }, 403);

  if (env.RATE_LIMITER) {
    const key = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env.RATE_LIMITER.limit({ key });
    if (!success) return json({ error: "Too many questions just now. Please wait a minute and try again." }, 429, cors);
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "Request too large." }, 413, cors);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: "Request too large." }, 413, cors);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Request must be JSON." }, 400, cors);
  }
  const parsed = parseChatRequest(body);
  if (!parsed.ok) return json({ error: parsed.message }, 400, cors);
  const { messages, ui } = parsed.request;

  // An overall "healthiest town" question has a fixed answer; no model call is needed.
  const fixed = compositeGuard(messages[messages.length - 1].content);
  if (fixed) return json({ reply: fixed, toolCalls: [] }, 200, cors);

  if (!env.OPENAI_API_KEY) return json({ error: "The assistant is not configured yet." }, 503, cors);

  try {
    const index = await loadIndex(env, fetchImpl);
    const result = await runChat({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || DEFAULT_MODEL,
      reasoningEffort: env.OPENAI_REASONING_EFFORT || "low",
      messages,
      ui,
      index,
      fetchImpl,
    });
    // Token counts only (no content), to watch cost and cache hits in `wrangler tail`.
    console.log("usage", JSON.stringify({ ...result.usage, tools: result.toolCalls.length }));
    return json({ reply: result.reply, toolCalls: result.toolCalls.map((t) => t.name) }, 200, cors);
  } catch (err) {
    console.error("chat failed:", err instanceof Error ? err.message : "unknown error");
    return json({ error: "The assistant could not answer just now. Please try again." }, 502, cors);
  }
}

export default {
  fetch: (request: Request, env: Env) => handleRequest(request, env),
};
