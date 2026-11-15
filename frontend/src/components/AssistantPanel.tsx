import type { DiscoveredArticle } from "../data/articleSearch";
import type { Region } from "../types/region";
import type { AssistantMessage } from "../data/assistant";
import SourceLinks from "./SourceLinks";
import { memo, useEffect, useRef, useState, type FormEvent } from "react";

interface AssistantPanelProps {
  region: Region | null;
  year: number;
  startYear: number;
  endYear: number;
  messages: AssistantMessage[];
  isAsking: boolean;
  onAsk: (question: string) => void;
  onFocusPlace: (place: DiscoveredArticle) => void;
}

const SUGGESTIONS = [
  "What changed here?",
  "Which evidence is real?",
  "How much changed?",
  "Search Calgary, Alberta",
];

export default memo(function AssistantPanel({
  region,
  year,
  startYear,
  endYear,
  messages,
  isAsking,
  onAsk,
  onFocusPlace,
}: AssistantPanelProps) {
  const [question, setQuestion] = useState("");
  const conversationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = conversationRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text || isAsking) return;
    onAsk(text);
    setQuestion("");
  }

  return (
    <section
      className="workspace-panel assistant-panel panel"
      aria-label="Earth AI assistant"
    >
      <div className="workspace-title">
        <div>
          <span className="eyebrow">YOUR EARTH OBSERVATION COMPANION</span>
          <h2>
            Earth AI <span>✦</span>
          </h2>
        </div>
        <span className="mock-pill">CHAT + SEARCH</span>
      </div>
      <div className="context-strip">
        {region?.name ?? "Explore any location"}
        <span>
          {startYear}–{endYear}
        </span>
      </div>
      <p className="demo-explanation">
        Answers use curated stories and available region data.{" "}
        {region?.datasetIds?.length
          ? "Source-traceable SAR observations are available; classifications remain exploratory."
          : region?.waterMonitoring
            ? "Water measurements are still processing."
            : "Water monitoring is not configured for this view."}{" "}
        Check linked evidence before drawing conclusions.
      </p>
      <div
        className="assistant-conversation"
        ref={conversationRef}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        aria-busy={isAsking}
      >
        {messages.length === 0 && (
          <div className="assistant-welcome">
            <span>✦</span>
            <h3>Make sense of the change.</h3>
            <p>
              Type "search Calgary, Alberta" to zoom and pin a place, or select
              a curated region to ask about its data.
            </p>
          </div>
        )}
        {messages.map((message) => (
          <article key={message.id} className={`chat-message ${message.role}`}>
            <span className="chat-role">
              {message.role === "user"
                ? "YOU"
                : message.error
                  ? "CONNECTION ISSUE"
                  : message.mode === "guided"
                    ? "EARTH AI / GUIDED"
                    : message.mode === "search"
                      ? "PLACE SEARCH"
                      : "EARTH AI"}
            </span>
            {message.text.split("\n").map((paragraph, index) => (
              <p key={index}>
                {paragraph
                  .split(/(\*\*[^*]+\*\*)/g)
                  .map((part, partIndex) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <strong key={partIndex}>{part.slice(2, -2)}</strong>
                    ) : (
                      part
                    ),
                  )}
              </p>
            ))}
            {message.places && message.places.length > 0 && (
              <div
                className="place-search-results"
                aria-label="Place search results"
              >
                {message.places.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => onFocusPlace(place)}
                    disabled={isAsking}
                  >
                    Zoom to {place.title}
                  </button>
                ))}
              </div>
            )}
            {message.sources && message.sources.length > 0 && (
              <SourceLinks
                sources={message.sources}
                observationYear={message.observationYear ?? year}
              />
            )}
          </article>
        ))}
        {isAsking && <p role="status">Working on your request…</p>}
      </div>
      <div className="suggested-questions">
        {SUGGESTIONS.map((question) => (
          <button
            key={question}
            onClick={() => onAsk(question)}
            disabled={isAsking}
          >
            {question} ↗
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="assistant-form">
        <label className="sr-only" htmlFor="earth-question">
          Ask a question or search for a place
        </label>
        <textarea
          id="earth-question"
          placeholder="Search Calgary, Alberta, or ask about this region"
          value={question}
          maxLength={1000}
          onChange={(event) => setQuestion(event.target.value)}
          rows={2}
          disabled={isAsking}
        />
        <button
          type="submit"
          disabled={!question.trim() || isAsking}
          aria-label="Send question"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path
              d="m6 11 6-6 6 6M12 5v14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
      <p className="small muted assistant-note">
        Guided answers work without a model. Place search needs internet access
        and uses Wikipedia coordinates. Pins are reference locations; annual
        imagery may miss short events.
      </p>
    </section>
  );
});
