import { requestErrorMessage } from "@/lib/request-feedback";
export async function post(path: string, body: unknown = {}) {
  try {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (
    result.code === "APP_ORIGIN_MISMATCH" &&
    result.redirect &&
    typeof window !== "undefined"
  ) {
    window.location.assign(result.redirect);
  }
  if (!response.ok)
    throw new Error(result.error || "This request could not be completed.");
  return result as {
    redirect?: string;
    message?: string;
    workspace?: { id: string };
  };
  } catch (error) { throw new Error(requestErrorMessage(error)); }
}
