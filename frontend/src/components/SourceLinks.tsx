import type { RegionStory, StorySource } from "../data/stories";

interface SourceLinksProps {
  sources: StorySource[];
  observationYear: number;
}

export default function SourceLinks({
  sources,
  observationYear,
}: SourceLinksProps) {
  return (
    <div className="source-links">
      {sources.map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>
            {source.publisher}{" "}
            {source.publishedYear && `· ${source.publishedYear}`}
          </span>
          <strong>{source.title} ↗</strong>
          {source.publishedYear && source.publishedYear > observationYear && (
            <small>
              Retrospective source: published after the selected map year
            </small>
          )}
        </a>
      ))}
    </div>
  );
}

export function StoryTiming({
  story,
  year,
}: {
  story: RegionStory;
  year: number;
}) {
  return (
    <span className="story-timing">
      {year < story.firstYear
        ? `Upcoming in this timeline · ${story.firstYear}`
        : year === story.firstYear
          ? "Event / development year"
          : "Historical context · not a live incident"}
    </span>
  );
}
