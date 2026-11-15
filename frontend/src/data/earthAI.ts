import type { AssistantMessage } from "./assistant";
import type { StorySource } from "./stories";
import { isRecord, safeExternalUrl } from "./validation.ts";

export interface EarthAIRequest {
  question: string;
  region_id: string;
  story_id?: string;
  dataset_id?: string;
  observation_id?: string;
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
  return parseEarthAIResponse(result);
}

export function parseEarthAIResponse(
  result: unknown,
): Omit<AssistantMessage, "id" | "role"> {
  if (
    !isRecord(result) ||
    typeof result.text !== "string" ||
    !result.text.trim() ||
    result.text.length > 12000
  )
    throw new Error("Earth AI returned an invalid response. Please try again.");
  const sources: StorySource[] = (
    Array.isArray(result.sources) ? result.sources : []
  )
    .slice(0, 20)
    .flatMap((source): StorySource[] => {
      if (!isRecord(source)) return [];
      const url = safeExternalUrl(source.url);
      if (
        !url ||
        typeof source.title !== "string" ||
        typeof source.publisher !== "string"
      )
        return [];
      return [
        {
          url,
          title: source.title.slice(0, 300),
          publisher: source.publisher.slice(0, 200),
          id:
            typeof source.id === "string" ? source.id.slice(0, 100) : undefined,
          publishedYear:
            typeof source.publishedYear === "number" &&
            Number.isInteger(source.publishedYear)
              ? source.publishedYear
              : undefined,
        },
      ];
    });
  return {
    text: result.text,
    sources,
    model:
      typeof result.model === "string" ? result.model.slice(0, 200) : undefined,
    observationYear:
      typeof result.observationYear === "number" &&
      Number.isInteger(result.observationYear)
        ? result.observationYear
        : undefined,
  };
}
