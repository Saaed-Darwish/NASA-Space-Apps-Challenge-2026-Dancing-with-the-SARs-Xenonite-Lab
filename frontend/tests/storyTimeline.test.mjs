import assert from "node:assert/strict";
import test from "node:test";
import {
  storyMarkerOpacity,
  storyTimelineLabel,
  storyMarkerVisible,
} from "../src/data/storyTimeline.ts";

const flood = { firstYear: 2022, mapEndYear: 2023 };
const development = { firstYear: 2022 };

test("whole-earth overview hides even active story markers", () => {
  assert.equal(
    storyMarkerVisible(
      { ...flood, regionId: "manchar" },
      undefined,
      2022,
      true,
    ),
    false,
  );
});
test("only stories belonging to the focused region are visible", () => {
  const story = { ...flood, regionId: "manchar" };
  assert.equal(storyMarkerVisible(story, "manchar", 2022, true), true);
  assert.equal(storyMarkerVisible(story, "nusantara", 2022, true), false);
});
test("region focus respects the timeline window and marker switch", () => {
  const story = { ...flood, regionId: "manchar" };
  assert.equal(storyMarkerVisible(story, "manchar", 2023, true), false);
  assert.equal(storyMarkerVisible(story, "manchar", 2022, false), false);
});

test("a flood is hidden before its annual map window", () => {
  assert.equal(storyMarkerOpacity(flood, 2021), 0);
  assert.equal(storyMarkerOpacity(flood, 2021.8), 0);
});
test("the flood fades in as the timeline approaches 2022", () => {
  const alpha = storyMarkerOpacity(flood, 2021.9);
  assert.ok(alpha > 0.49 && alpha < 0.51);
  assert.equal(storyMarkerOpacity(flood, 2022), 1);
});
test("the 2022 flood fades out approaching 2023", () => {
  assert.equal(storyMarkerOpacity(flood, 2022.5), 1);
  assert.ok(
    storyMarkerOpacity(flood, 2022.8) < storyMarkerOpacity(flood, 2022.7),
  );
  assert.ok(storyMarkerOpacity(flood, 2022.99) > 0);
  assert.equal(storyMarkerOpacity(flood, 2023), 0);
  assert.equal(storyMarkerOpacity(flood, 2025), 0);
});
test("scrubbing backwards restores the same story opacity", () => {
  const forward = [2021, 2021.9, 2022, 2022.8, 2023].map((t) =>
    storyMarkerOpacity(flood, t),
  );
  const backward = [2023, 2022.8, 2022, 2021.9, 2021].map((t) =>
    storyMarkerOpacity(flood, t),
  );
  assert.deepEqual(forward, backward.reverse());
});
test("permanent development remains visible after its start", () => {
  assert.equal(storyMarkerOpacity(development, 2021), 0);
  assert.equal(storyMarkerOpacity(development, 2022), 1);
  assert.equal(storyMarkerOpacity(development, 2025), 1);
});
test("outside-window labels preserve access to historical sources", () => {
  assert.match(
    storyTimelineLabel(flood, 2023),
    /Outside map window.*source still available/,
  );
  assert.match(storyTimelineLabel(flood, 2022), /On map/);
  assert.match(storyTimelineLabel(flood, 2021), /Upcoming/);
});
test("invalid timeline input hides the marker", () => {
  assert.equal(storyMarkerOpacity(flood, NaN), 0);
  assert.equal(storyMarkerOpacity(flood, Infinity), 0);
});
