import { InputError } from "../workspaces/validation";

export type AnalysisContent =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename: string; file_data: string };
export function analysisConfiguration(env: Record<string, string | undefined> = process.env) {
  const key = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODEL?.trim();
  if (!key || !model)
    throw new InputError("Configure the OpenAI key and model in the worker.", 503, "AI_NOT_CONFIGURED");
  return { key, model, documentVision: env.AI_DOCUMENT_VISION_ENABLED === "true" };
}

function analysisUrl() {
  // Simulation overrides never apply to production or hosted Functions, and
  // cannot send credentials to arbitrary hosts. Fixtures use fictional keys.
  if (process.env.ASSENTPAY_SIMULATION === "true" && process.env.NODE_ENV !== "production" && !process.env.APPWRITE_FUNCTION_ID) {
    const url = new URL(process.env.SIMULATION_AI_URL || "http://127.0.0.1:4916/ai");
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password || url.search || url.hash)
      throw new InputError("Invalid AI simulation URL.", 503, "AI_NOT_CONFIGURED");
    return `${url.href.replace(/\/$/, "")}/responses`;
  }
  return "https://api.openai.com/v1/responses";
}

export async function requestAnalysis(instructions: string, content: AnalysisContent[], schema: Record<string, unknown>, config = analysisConfiguration()) {
  const body = {
    model: config.model, store: false, max_output_tokens: 4000, instructions,
    input: [{ role: "user", content }], text: { format: { type: "json_schema", name: "financial_extraction", strict: true, schema } },
  };
  let response: Response;
  try {
    response = await fetch(analysisUrl(), {
      method: "POST", headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(60000), redirect: "error",
    });
  } catch {
    throw new InputError("Financial analysis provider unavailable.", 503, "AI_PROVIDER_UNAVAILABLE");
  }
  if (!response.ok) {
    const code = [401, 403].includes(response.status) ? "AI_ACCESS_DENIED"
      : response.status === 402 ? "AI_CREDITS_REQUIRED"
      : response.status === 429 ? "AI_RATE_LIMITED"
      : response.status === 404 ? "AI_MODEL_UNAVAILABLE"
      : "AI_PROVIDER_UNAVAILABLE";
    const error = new InputError("Financial analysis provider unavailable.", 503, code);
    Object.assign(error, { providerStatus: response.status });
    throw error;
  }
  try {
    const result = await response.json();
    if (result.error || result.status !== "completed" || !Array.isArray(result.output)) throw new Error();
    const parts = result.output.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || []);
    if (parts.some((part: { type: string }) => part.type === "refusal")) throw new Error();
    const output = parts.filter((part: { type: string }) => part.type === "output_text").map((part: { text?: string }) => part.text || "").join("");
    return JSON.parse(output) as unknown;
  } catch {
    throw new InputError("Financial analysis returned incomplete or invalid output.", 502, "AI_INVALID_OUTPUT");
  }
}
