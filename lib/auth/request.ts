import { InputError } from "../workspaces/validation";

// Enforce a byte limit while reading, even with chunked transfer or a forged
// Content-Length. Never buffer an unbounded credential-bearing request.
export async function readBody(request: Request, limit: number, mediaType: string) {
  const type = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (type !== mediaType) throw new InputError("Unsupported request format.", 415);
  const size = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(size) || size < 0 || size > limit)
    throw new InputError("Request too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("Invalid request body.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new InputError("Request too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new InputError("Invalid request body.");
  }
}

export async function readJsonBody(request: Request, limit: number) {
  const text = await readBody(request, limit, "application/json");
  try {
    const result: unknown = JSON.parse(text);
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new Error();
    assertSafeStructure(result);
    return result as Record<string, unknown>;
  } catch {
    throw new InputError("Invalid request body.");
  }
}

// Reject ambiguous object keys and excessive nesting before downstream code
// merges or traverses user input. Field validators still enforce each schema.
function assertSafeStructure(value: unknown, depth = 0) {
  if (depth > 20) throw new InputError("Request is too deeply nested.");
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key))
      throw new InputError("Invalid request field.");
    assertSafeStructure(item, depth + 1);
  }
}

export async function readAuthFormBody(request: Request, limit: number) {
  const text = await readBody(request, limit, "application/x-www-form-urlencoded");
  const fields = new URLSearchParams(text);
  const input: Record<string, string | boolean> = Object.create(null);
  for (const [name, value] of fields) {
    if (["__proto__", "prototype", "constructor"].includes(name))
      throw new InputError("Invalid form field.");
    if (Object.hasOwn(input, name)) throw new InputError("Duplicate form field.");
    input[name] = value;
  }
  input.terms = fields.get("terms") === "on";
  return input;
}
