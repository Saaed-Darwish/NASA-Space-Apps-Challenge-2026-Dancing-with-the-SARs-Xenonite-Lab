import { memo, useEffect, useRef, useState } from "react";
import {
  searchRegionArticles,
  type DiscoveredArticle,
  type ArticleSearchArea,
} from "../data/articleSearch";

interface Props {
  region: ArticleSearchArea | null;
  markers: DiscoveredArticle[];
  onAdd: (article: DiscoveredArticle) => void;
  onRemove: (id: string) => void;
  onFocus: (article: DiscoveredArticle) => void;
}

export default memo(function ArticleSearch({
  region,
  markers,
  onAdd,
  onRemove,
  onFocus,
}: Props) {
  const [topic, setTopic] = useState("");
  const [results, setResults] = useState<DiscoveredArticle[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setResults([]);
    setStatus("idle");
  }, [region?.id]);

  async function search() {
    if (!region) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    setResults([]);
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const articles = await searchRegionArticles(
        region,
        topic,
        controller.signal,
      );
      if (request.current === controller) {
        setResults(articles);
        setStatus("done");
      }
    } catch {
      if (request.current === controller) setStatus("error");
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return (
    <section className="article-search panel" aria-label="Discover articles">
      <div className="eyebrow">DISCOVER MORE</div>
      <h3>What happened here?</h3>
      <p className="muted small">
        {region
          ? `Search Wikipedia references for ${region.name}.${region.radiusKm ? ` Within ${region.radiusKm} km of the map center; pan or zoom to change the area.` : ""} These are live results, separate from our curated stories.`
          : "Move the globe so land is visible at the map center to discover nearby references."}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <label htmlFor="article-topic">Topic</label>
        <select
          id="article-topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        >
          <option value="">Regional context</option>
          <option value="flood">Flooding &amp; water</option>
          <option value="wildfire">Wildfire</option>
          <option value="development">Urban development</option>
        </select>
        <button type="submit" disabled={!region || status === "loading"}>
          {status === "loading" ? "Searching…" : "Search articles in this area"}
        </button>
      </form>
      {region && (
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={`https://www.google.com/search?tbm=nws&q=${encodeURIComponent(`${region.name} ${region.country} ${topic}`)}`}
        >
          Search news on the web ↗
        </a>
      )}
      <p className="muted small">
        Article coordinates locate the subject, not an event boundary.
        Discovered pins appear in every year; results are not filtered by the
        timeline.
      </p>
      <div role="status" aria-live="polite">
        {status === "error" && (
          <p>
            Couldn’t reach Wikipedia. Try again or use the news search above.
          </p>
        )}
        {status === "done" && (
          <p className="small">
            {results.length
              ? `${results.length} reference articles found`
              : "No matches. Try regional context or another topic."}
          </p>
        )}
      </div>
      {results.map((article) => (
        <article className="discovered-article" key={article.id}>
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            <strong>{article.title} ↗</strong>
          </a>
          <p className="small muted">{article.summary}</p>
          {article.latitude !== undefined && article.longitude !== undefined ? (
            <button
              onClick={() => onAdd(article)}
              disabled={markers.some((marker) => marker.id === article.id)}
            >
              {markers.some((marker) => marker.id === article.id)
                ? "Added to map"
                : "Add article marker"}
            </button>
          ) : (
            <small>No nearby published coordinates · article only</small>
          )}
        </article>
      ))}
      {markers.length > 0 && (
        <div className="discovered-article">
          <strong>Blue pins · discovered references</strong>
          {markers.map((article) => (
            <div key={article.id}>
              <div className="article-marker-row">
                <button onClick={() => onFocus(article)}>
                  {article.title} ↗
                </button>
                <button
                  aria-label={`Remove ${article.title}`}
                  onClick={() => onRemove(article.id)}
                >
                  ×
                </button>
              </div>
              <a
                className="small"
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Read article ↗
              </a>
            </div>
          ))}
        </div>
      )}
      <small className="muted">
        Wikipedia extracts · CC BY-SA · Markers saved for this session.
      </small>
    </section>
  );
});
