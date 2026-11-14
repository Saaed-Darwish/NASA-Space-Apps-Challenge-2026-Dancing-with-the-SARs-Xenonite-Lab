import {
  indicators,
  readings,
  type Indicator,
  type RegionalReading,
} from "../data/demo";
import { readingAtYear } from "../data/history";
import type { RegionStory, StorySource } from "../data/stories";
import type { Region } from "../types/region";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: StorySource[];
  observationYear?: number;
  model?: string;
  error?: boolean;
}

export interface AssistantContext {
  region: Region | null;
  story: RegionStory | null;
  startYear: number;
  endYear: number;
  year: number;
  indicator: Indicator;
  reading: RegionalReading | null;
}

/** Frontend-only guided responses. Replace this adapter when a model endpoint is ready. */
export function answerDemoQuestion(
  question: string,
  context: AssistantContext,
): Omit<AssistantMessage, "id" | "role"> {
  const { region, story, startYear, endYear, year, indicator, reading } =
    context;
  if (!region)
    return {
      text: "Choose a curated region first. I can then explain its story, compare the selected years, and distinguish the real satellite imagery from the mock indicators.",
    };
  const subject = `${region.name} · ${startYear}–${endYear}`;
  const normalized = question.toLowerCase();
  const sources = story?.sources ?? [];
  const timelineContext =
    story && year < story.firstYear
      ? `The map is showing ${year}, before this story begins in ${story.firstYear}. The following account is retrospective context.`
      : `The selected map year is ${year}; linked events are historical context, not live incident reports.`;
  if (
    /forecast|predict|tomorrow|2030|2050|future|will happen/.test(normalized)
  ) {
    return {
      text: `${subject}\nThis frontend demo does not predict future conditions. The globe contains annual imagery through 2025. A forecast would require an appropriate model, inputs, and validation; the mock readings cannot support one.`,
      sources,
    };
  }
  if (
    /source|evidence|real|reliable|confidence|accurate|mock/.test(normalized)
  ) {
    const retrospective = sources.some(
      (source) => source.publishedYear && source.publishedYear > year,
    );
    return {
      text: `${subject}\n${timelineContext}\n${story?.summary ?? ""}\nThe EOX annual satellite imagery is real. The illustrative water layer, numerical snapshots, and trend charts are simulated. Story markers link to published accounts; their positions are approximate locators, not measured boundaries.\n${story ? story.limitation : "No measured change classification is connected yet."}${retrospective ? " A linked source was published after the selected map year and provides retrospective context." : ""}\nNo calibrated confidence score is available in this demo.`,
      sources,
    };
  }
  if (region.floodDataStatus === "processing") {
    return {
      text: `${subject}\nThe selected map year is ${year}. ${region.description}\nThe EOX annual imagery is available for landscape context. Flood footprints, event dates, and area statistics are awaiting the backend connection, so I cannot report measured water change yet. Annual mosaics may miss peak flooding.`,
      sources,
    };
  }
  if (
    /measure|how much|area|km|displacement|number|metric|subsiden/.test(
      normalized,
    )
  ) {
    if (!region.waterMonitoring)
      return {
        text: `${subject}\nThis curated view provides satellite comparisons and sourced stories. Water monitoring is not configured here, and no measured change statistics are available. ${story?.summary ?? "Select a story for the published context."}`,
        sources,
      };
    const metricIndicator = "water";
    const metricReading = readings[region.id]?.[metricIndicator] ?? reading;
    if (!metricReading)
      return {
        text: `${subject}\nFlood data for this region is being processed. No measured extent or statistics have been connected yet.`,
        sources,
      };
    const before = readingAtYear(metricReading, metricIndicator, startYear);
    const after = readingAtYear(metricReading, metricIndicator, endYear);
    return {
      text: `${subject}\nThe ${indicators[metricIndicator].name.toLowerCase()} mock snapshot changes from ${before.value} ${before.unit} in ${startYear} to ${after.value} ${after.unit} in ${endYear}. These are interface fixtures, not measurements of this event or region.\nActual area estimates need classified spatial data. Ground displacement needs a processed radar product; it cannot be calculated from the RGB basemap.`,
      sources,
    };
  }
  if (/fire|burn/.test(normalized)) {
    if (story?.category === "fire")
      return {
        text: `${subject}\n${timelineContext}\n${story.summary}\n${story.lookFor}\n${story.limitation} A thermal hotspot, a burned-area boundary, and a burn-severity measurement describe different things.`,
        sources,
      };
    return {
      text: `${subject}\nThe selected story is not a verified wildfire incident. This explorer supports water overlays only; no wildfire layer is available. ${story?.summary ?? "Choose a documented fire story to inspect its sources."}`,
      sources,
    };
  }
  if (
    /change|compare|explain|happen|why|growth|city|water|coast|look|summary|construction/.test(
      normalized,
    )
  ) {
    return {
      text: `${subject}\n${timelineContext}\n${story?.summary ?? "This region is available for annual satellite comparisons."}\nWhat to look for: ${story?.lookFor ?? "Compare persistent changes in structures, vegetation, or water boundaries across the selected years."}\n${story?.limitation ?? "Image appearance alone does not establish the cause or amount of a change."}\nPress Play to watch the story from the earliest bookmarked year, or use Analyze's Before and After buttons to compare the selected years.`,
      sources,
    };
  }
  return {
    text: `${subject}\nThis is a guided frontend demo, so I don't have an open-ended language model connected. I can explain the selected story, identify its sources and limitations, or describe the mock readings. Try “What changed here?” or “Which evidence is real?”`,
    sources,
  };
}
