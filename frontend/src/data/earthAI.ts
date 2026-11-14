import type { AssistantMessage } from "./assistant";

export interface EarthAIRequest {
  question: string;
  region_id: string;
  story_id?: string;
  year: number;
  start_year: number;
  end_year: number;
  history: { role: "user" | "assistant"; content: string }[];
}

export async function askEarthAI(
  request: EarthAIRequest,
): Promise<Omit<AssistantMessage, "id" | "role">> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(130_000),
    });
  } catch {
    throw new Error(
      "Earth AI could not be reached. Check that the backend and local model are running, then try again.",
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof result?.detail === "string"
        ? result.detail
        : "Earth AI is unavailable. Check the backend connection and try again.",
    );
  }
  if (typeof result?.text !== "string")
    throw new Error("Earth AI returned an invalid response. Please try again.");
  return result;
}
