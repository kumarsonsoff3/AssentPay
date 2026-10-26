import { InputError } from "../workspaces/validation";

export type AnalysisContent =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename: string; file_data: string };
type AnalysisConfiguration = { provider: "openai" | "openrouter"; key: string; model: string; documentVision: boolean; outputMode: "json_schema" | "prompt_json" };

export function analysisConfiguration(env: Record<string, string | undefined> = process.env): AnalysisConfiguration {
  const provider = env.AI_PROVIDER?.trim() || "openai";
  if (provider !== "openai" && provider !== "openrouter")
    throw new InputError("Choose a supported AI provider.", 503, "AI_NOT_CONFIGURED");
  const key = (provider === "openrouter" ? env.OPENROUTER_API_KEY : env.OPENAI_API_KEY)?.trim();
  const model = (provider === "openrouter" ? env.OPENROUTER_MODEL : env.OPENAI_MODEL)?.trim();
  if (!key || !model)
    throw new InputError("Configure the AI provider key and model in the worker.", 503, "AI_NOT_CONFIGURED");
  const outputMode = provider === "openrouter" ? env.OPENROUTER_OUTPUT_MODE?.trim() || "json_schema" : "json_schema";
  if (outputMode !== "json_schema" && outputMode !== "prompt_json")
    throw new InputError("Choose a supported AI output mode.", 503, "AI_NOT_CONFIGURED");
  return { provider, key, model, outputMode, documentVision: provider === "openai" && env.AI_DOCUMENT_VISION_ENABLED === "true" };
}

function analysisUrl(provider: "openai" | "openrouter") {
  // Simulation overrides never apply to production or hosted Functions, and
  // cannot send credentials to arbitrary hosts. Fixtures use fictional keys.
  if (process.env.ASSENTPAY_SIMULATION === "true" && process.env.NODE_ENV !== "production" && !process.env.APPWRITE_FUNCTION_ID) {
    const url = new URL(process.env.SIMULATION_AI_URL || "http://127.0.0.1:4916/ai");
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password || url.search || url.hash)
      throw new InputError("Invalid AI simulation URL.", 503, "AI_NOT_CONFIGURED");
    return `${url.href.replace(/\/$/, "")}/${provider === "openrouter" ? "chat/completions" : "responses"}`;
  }
  return provider === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/responses";
}

export async function requestAnalysis(instructions: string, content: AnalysisContent[], schema: Record<string, unknown>, config = analysisConfiguration(), execution: { syntheticDataCollection?: boolean } = {}) {
  // Only the committed fictional-corpus evaluator may explicitly opt in.
  // Ordinary inbox analysis always requests providers that deny collection.
  if (execution.syntheticDataCollection && (process.env.ASSENTPAY_SYNTHETIC_EVALUATION !== "true" || process.env.NODE_ENV === "production" || process.env.APPWRITE_FUNCTION_ID || config.provider !== "openrouter"))
    throw new InputError("Data collection opt-in is restricted to fictional local evaluation.", 503, "AI_SYNTHETIC_ONLY");
  if (config.provider === "openrouter" && content.some((part) => part.type === "input_file"))
    throw new InputError("Scanned PDFs need manual review with this provider.", 503, "AI_DOCUMENT_UNSUPPORTED");
  const format = { name: "financial_extraction", strict: true, schema };
  const body = config.provider === "openrouter" ? {
    model: config.model, stream: false, max_tokens: 4000,
    messages: [{ role: "system", content: config.outputMode === "prompt_json" ? `${instructions}\nReturn exactly one JSON object matching this JSON Schema. No markdown or additional text. The application rejects any result that fails validation.\n${JSON.stringify(schema)}` : instructions }, { role: "user", content: content.map((part) => part.type === "input_text" ? part.text : "").join("\n") }],
    ...(config.outputMode === "json_schema" ? { response_format: { type: "json_schema", json_schema: format } } : {}),
    provider: { require_parameters: true, data_collection: execution.syntheticDataCollection ? "allow" : "deny" },
  } : {
    model: config.model, store: false, max_output_tokens: 4000, instructions,
    input: [{ role: "user", content }], text: { format: { type: "json_schema", ...format } },
  };
  let response: Response;
  try {
    response = await fetch(analysisUrl(config.provider), {
      method: "POST", headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(60000), redirect: "error",
    });
  } catch {
    throw new InputError("Financial analysis provider unavailable.", 503, "AI_PROVIDER_UNAVAILABLE");
  }
  if (!response.ok) {
    let code = [401, 403].includes(response.status) ? "AI_ACCESS_DENIED" : response.status === 402 ? "AI_CREDITS_REQUIRED" : response.status === 429 ? "AI_RATE_LIMITED" : response.status === 404 ? "AI_MODEL_UNAVAILABLE" : "AI_PROVIDER_UNAVAILABLE";
    let evaluationReason: string | undefined;
    try {
      const failure = await response.json();
      if (response.status === 404 && typeof failure.error?.message === "string" && /data policy/i.test(failure.error.message)) code = "AI_DATA_POLICY_BLOCKED";
      if (execution.syntheticDataCollection && typeof failure.error?.message === "string") evaluationReason = failure.error.message.slice(0, 400);
    } catch { /* No workspace provider body is logged or stored. */ }
    const error = new InputError("Financial analysis provider unavailable.", 503, code);
    Object.assign(error, { providerStatus: response.status, ...(evaluationReason ? { evaluationReason } : {}) });
    throw error;
  }
  try {
    const result = await response.json();
    if (result.error) throw new Error();
    let output: string;
    if (config.provider === "openrouter") {
      const choice = result.choices?.[0];
      if (result.choices?.length !== 1 || choice?.finish_reason !== "stop" || choice.message?.refusal || choice.message?.tool_calls?.length || typeof choice.message?.content !== "string") throw new Error();
      output = choice.message.content;
    } else {
      if (result.status !== "completed" || !Array.isArray(result.output)) throw new Error();
      const parts = result.output.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || []);
      if (parts.some((part: { type: string }) => part.type === "refusal")) throw new Error();
      output = parts.filter((part: { type: string }) => part.type === "output_text").map((part: { text?: string }) => part.text || "").join("");
    }
    return JSON.parse(output) as unknown;
  } catch {
    throw new InputError("Financial analysis returned incomplete or invalid output.", 502, "AI_INVALID_OUTPUT");
  }
}
