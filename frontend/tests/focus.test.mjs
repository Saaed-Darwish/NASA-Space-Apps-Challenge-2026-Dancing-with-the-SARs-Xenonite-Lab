import assert from "node:assert/strict";
import test from "node:test";
import { regionForView } from "../src/globe/focus.ts";
import { regions, indicators, readings } from "../src/data/demo.ts";
import { additionalStories as stories } from "../src/data/additionalStories.ts";
const city = regions.find((region) => region.id === "can-tho");
// A synthetic enclosing region keeps the generic city/region focus checks.
const state = { ...city, id: "enclosing-region", altitude: 360000 };
const nestedRegions = [...regions, state];

test("global zoom has no focused region", () => {
  assert.equal(
    regionForView(regions, city, city.latitude, city.longitude, 10_000_000),
    null,
  );
});
test("zooming into a city focuses it without a click", () => {
  assert.equal(
    regionForView(regions, null, city.latitude, city.longitude, 100_000)?.id,
    city.id,
  );
});
test("focus persists between entry and exit zoom thresholds", () => {
  assert.equal(
    regionForView(regions, city, city.latitude, city.longitude, 180_000)?.id,
    city.id,
  );
});
test("zooming out releases city focus and picks the wider state", () => {
  assert.equal(
    regionForView(nestedRegions, city, city.latitude, city.longitude, 480_000)?.id,
    state.id,
  );
});
test("zooming back in replaces state focus with city focus", () => {
  assert.equal(
    regionForView(nestedRegions, state, city.latitude, city.longitude, 100_000)?.id,
    city.id,
  );
});
test("panning away releases focus", () => {
  assert.equal(regionForView(regions, city, 0, 0, 100_000), null);
});
test("Can Tho remains available without a Mekong Delta region pin", () => {
  const canTho = regions.find((region) => region.id === "can-tho");
  assert.equal(
    regionForView(regions, null, canTho.latitude, canTho.longitude, 65_000)?.id,
    "can-tho",
  );
  assert.equal(
    regionForView(regions, canTho, canTho.latitude, canTho.longitude, 360_000)
      ?.id,
    undefined,
  );
  assert.equal(regions.some((r) => r.id === "mekong-delta"), false);
});
test("invalid camera coordinates clear focus", () => {
  assert.equal(
    regionForView(regions, city, NaN, city.longitude, 100_000),
    null,
  );
});
test("only water is supported and story-only regions have no fabricated readings", () => {
  assert.deepEqual(Object.keys(indicators), ["water"]);
  for (const id of ["rio-grande-do-sul"]) {
    assert.equal(
      regions.find((region) => region.id === id)?.floodDataStatus,
      undefined,
    );
    assert.equal(readings[id], undefined);
  }
});

test("water monitoring covers only the configured water regions", () => {
  assert.deepEqual(
    regions
      .filter((region) => region.waterMonitoring)
      .map((region) => region.id),
    ["porto-velho", "can-tho"],
  );
});

test("Rio Grande do Sul retains its stories without promising SAR observations", () => {
  const region = regions.find((r) => r.id === "rio-grande-do-sul");
  assert.equal(region.floodDataStatus, undefined);
  assert.equal(region.waterMonitoring, undefined);
  assert.equal(region.datasetIds, undefined);
  assert.equal(readings[region.id], undefined);
  assert.equal(stories.filter((s) => s.regionId === region.id).length, 4);
});

test("Mekong Delta stories are grouped under Can Tho with regional locations intact", () => {
  assert.equal(stories.filter((s) => s.regionId === "mekong-delta").length, 0);
  for (const id of ["mekong-adaptive-farming", "mekong-water-efficient-rice"]) {
    const story = stories.find((s) => s.id === id);
    assert.equal(story.regionId, "can-tho");
    assert.ok(story.sources.length);
  }
});
