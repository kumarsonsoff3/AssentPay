import type { AgAiEvent, AgAiOutputItem, AgLlmAdapter } from "ag-studio";

type ProviderReasoning = { id: string; type: "reasoning"; summary: []; encrypted_content: string };

type ProviderItem = {
  id: string;
  type: "function_call" | "message";
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: { type: string; text?: string; refusal?: string }[];
};

export function studioAdapter(workspaceId: string): AgLlmAdapter {
  const reasoningByCall = new Map<string, ProviderReasoning[]>();
  return {
    executeTurn(request, options) {
      const complete = (async () => {
        const includedReasoning = new Set<string>();
        const input = request.input.flatMap<Record<string, unknown>>(item => {
          switch (item.type) {
            case "reasoning": return [];
            case "function_call": {
              const prior = (reasoningByCall.get(item.callId) || []).filter(reasoning => {
                if (includedReasoning.has(reasoning.id)) return false;
                includedReasoning.add(reasoning.id);
                return true;
              });
              return [...prior, { type: item.type, call_id: item.callId, name: item.name, arguments: item.arguments }];
            }
            case "function_call_output":
              return [{ type: item.type, call_id: item.callId, output: item.output }];
            case "message":
              if (item.kind === "input" && item.content.some(part => part.type !== "text"))
                throw new Error("Studio chat accepts text only.");
              return [{ role: item.role, content: item.content.map(part => part.type === "text" ? part.text : "").join("\n") }];
          }
        });
        const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/analytics/studio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: options?.signal,
          body: JSON.stringify({
            input, instructions: request.instructions, toolChoice: request.toolChoice,
            tools: (request.tools || []).filter(tool => !tool.kind || tool.kind === "client")
              .map(({ name, description, parameters }) => ({ name, description, parameters })),
            format: request.responseFormat.type === "json" ? {
              name: request.responseFormat.name, description: request.responseFormat.description, schema: request.responseFormat.schema,
            } : undefined,
          }),
        });
        const result = await response.json();
        if (!response.ok || result.status !== "completed") throw new Error(result.error || "Studio response incomplete.");
        if (!Array.isArray(result.output)) throw new Error("Studio response was missing its output.");
        const reasoning: ProviderReasoning[] = [];
        const output = (result.output as (ProviderItem | ProviderReasoning)[]).flatMap<AgAiOutputItem>(item => {
          if (item.type === "reasoning") {
            if (item.encrypted_content) reasoning.push(item);
            return [];
          }
          if (item.type === "function_call" && item.call_id && item.name && typeof item.arguments === "string") {
            if (reasoning.length) reasoningByCall.set(item.call_id, [...reasoning]);
            if (reasoningByCall.size > 128) reasoningByCall.delete(reasoningByCall.keys().next().value!);
            return [{ kind: "output", type: "function_call", id: item.id, callId: item.call_id, name: item.name, arguments: item.arguments, status: "completed" }];
          }
          if (item.type !== "message") return [];
          return [{
            kind: "output", type: "message", id: item.id, role: "assistant", status: "completed",
            content: (item.content || []).map(part => part.type === "refusal"
              ? { type: "refusal", refusal: part.refusal || "" }
              : { type: "text", text: part.text || "", annotations: [] }),
          }];
        });
        return { id: result.id, createdAt: result.created_at * 1000, status: "completed" as const, output };
      })();
      return {
        complete,
        stream: {
          async *[Symbol.asyncIterator](): AsyncGenerator<AgAiEvent> {
            for (const item of (await complete).output) {
              if (item.type === "message") {
                yield { type: "TEXT_MESSAGE_START", messageId: item.id, role: "assistant" };
                for (const part of item.content) {
                  yield { type: "TEXT_MESSAGE_CONTENT", messageId: item.id, delta: part.type === "text" ? part.text : part.refusal };
                }
                yield { type: "TEXT_MESSAGE_END", messageId: item.id };
              } else if (item.type === "function_call") {
                yield { type: "TOOL_CALL_START", toolCallId: item.callId, toolCallName: item.name };
                yield { type: "TOOL_CALL_ARGS", toolCallId: item.callId, delta: item.arguments };
                yield { type: "TOOL_CALL_END", toolCallId: item.callId };
              }
            }
          },
        },
      };
    },
  };
}

