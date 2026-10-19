/** Responses API loop: model picks tools, the Worker runs them deterministically, model writes the answer. */
import { runTool } from "./queries";
import { buildInstructions, uiContextNote, type UiContext } from "./prompt";
import { buildTools } from "./tools";
import type { AtlasIndex } from "./types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  apiKey: string;
  model: string;
  reasoningEffort: string;
  messages: ChatMessage[];
  ui?: UiContext;
  index: AtlasIndex;
  fetchImpl?: typeof fetch;
  instructions?: string;
  maxRounds?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface ChatResult {
  reply: string;
  toolCalls: Array<{ name: string; ok: boolean }>;
  usage: { inputTokens: number; outputTokens: number };
}

const RESPONSES_URL = "https://api.openai.com/v1/responses";

interface OutputItem {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: Array<{ type: string; text?: string }>;
}

function outputText(output: OutputItem[]): string {
  return output
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("")
    .trim();
}

export async function runChat(opts: ChatOptions): Promise<ChatResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const tools = buildTools(opts.index);
  const instructions = opts.instructions ?? buildInstructions();
  const note = uiContextNote(opts.index, opts.ui);
  const input: unknown[] = [
    ...(note ? [{ role: "developer", content: note }] : []),
    ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  const maxRounds = opts.maxRounds ?? 3;
  const toolCalls: ChatResult["toolCalls"] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };

  for (let round = 0; round < maxRounds; round++) {
    const lastRound = round === maxRounds - 1;
    const res = await doFetch(RESPONSES_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
      body: JSON.stringify({
        model: opts.model,
        instructions,
        input,
        tools,
        tool_choice: lastRound ? "none" : "auto",
        reasoning: { effort: opts.reasoningEffort },
        max_output_tokens: opts.maxOutputTokens ?? 900,
        store: false,
      }),
    });
    if (!res.ok) {
      // Log status only: the body can echo request content and must never include credentials.
      throw new Error(`OpenAI request failed with status ${res.status}`);
    }
    const data = (await res.json()) as {
      output?: OutputItem[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    usage.inputTokens += data.usage?.input_tokens ?? 0;
    usage.outputTokens += data.usage?.output_tokens ?? 0;
    const output = data.output ?? [];
    const calls = output.filter((o) => o.type === "function_call");
    if (calls.length === 0) {
      const reply = outputText(output);
      if (!reply) throw new Error("OpenAI returned no text");
      return { reply, toolCalls, usage };
    }
    input.push(...output);
    for (const call of calls) {
      let result;
      try {
        result = runTool(opts.index, call.name ?? "", JSON.parse(call.arguments || "{}"));
      } catch {
        result = { error: "bad_arguments", message: "Tool arguments were not valid JSON." };
      }
      toolCalls.push({ name: call.name ?? "?", ok: !("error" in result) });
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
    }
  }
  throw new Error("Tool loop did not finish");
}
