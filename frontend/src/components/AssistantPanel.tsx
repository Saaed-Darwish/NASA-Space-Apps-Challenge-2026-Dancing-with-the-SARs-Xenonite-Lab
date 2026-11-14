import type { Region } from "../types/region";
import type { AssistantMessage } from "../data/assistant";
import SourceLinks from "./SourceLinks";
import { useEffect, useRef, useState, type FormEvent } from "react";

interface AssistantPanelProps {
  region: Region | null;
  year: number;
  startYear: number;
  endYear: number;
  messages: AssistantMessage[];
  onAsk: (question: string) => void;
}

const SUGGESTIONS = [
  "What changed here?",
  "Which evidence is real?",
  "How much changed?",
  "Explain the wildfire",
];

export default function AssistantPanel({
  region,
  year,
  startYear,
  endYear,
  messages,
  onAsk,
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
    if (!text) return;
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
        <span className="mock-pill">GUIDED DEMO</span>
      </div>
      <div className="context-strip">
        {region?.name ?? "Choose a region"}
        <span>
          {startYear}–{endYear}
        </span>
      </div>
      <p className="demo-explanation">
        Frontend demo · responses use curated stories and mock readings. No live
        AI model is connected.
      </p>
      <div
        className="assistant-conversation"
        ref={conversationRef}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="assistant-welcome">
            <span>✦</span>
            <h3>Make sense of the change.</h3>
            <p>
              Ask about this region, follow the evidence, or explore what the
              mock indicators mean.
            </p>
          </div>
        )}
        {messages.map((message) => (
          <article key={message.id} className={`chat-message ${message.role}`}>
            <span className="chat-role">
              {message.role === "user" ? "YOU" : "EARTH AI · DEMO"}
            </span>
            {message.text.split("\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            {message.sources && message.sources.length > 0 && (
              <SourceLinks
                sources={message.sources}
                observationYear={message.observationYear ?? year}
              />
            )}
          </article>
        ))}
      </div>
      <div className="suggested-questions">
        {SUGGESTIONS.map((question) => (
          <button
            key={question}
            onClick={() => onAsk(question)}
            disabled={!region}
          >
            {question} ↗
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="assistant-form">
        <label className="sr-only" htmlFor="earth-question">
          Ask about this region
        </label>
        <textarea
          id="earth-question"
          placeholder="Ask about this region…"
          value={question}
          maxLength={1000}
          onChange={(event) => setQuestion(event.target.value)}
          rows={2}
          disabled={!region}
        />
        <button
          type="submit"
          disabled={!question.trim() || !region}
          aria-label="Send question"
        >
          ↑
        </button>
      </form>
      <p className="small muted assistant-note">
        Sources and mock values stay visible. Your team's datasets can replace
        the demo adapters.
      </p>
    </section>
  );
}
