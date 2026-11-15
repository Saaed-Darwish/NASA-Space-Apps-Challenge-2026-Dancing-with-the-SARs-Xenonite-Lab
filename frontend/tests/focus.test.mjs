import assert from "node:assert/strict";
import test from "node:test";
import { regionForView } from "../src/globe/focus.ts";
import { regions, indicators, readings } from "../src/data/demo.ts";
const city = regions.find((region) => region.id === "porto-alegre");
const state = regions.find((region) => region.id === "rio-grande-do-sul");

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
    regionForView(regions, city, city.latitude, city.longitude, 210_000)?.id,
    city.id,
  );
});
test("zooming out releases city focus and picks the wider state", () => {
  assert.equal(
<<<<<<< HEAD
    regionForView(regions, city, city.latitude, city.longitude, 480_000)?.id,
=======
    regionForView(nestedRegions, city, city.latitude, city.longitude, 480_000)
      ?.id,
>>>>>>> integrating-backend-data
    state.id,
  );
});
test("zooming back in replaces state focus with city focus", () => {
  assert.equal(
<<<<<<< HEAD
    regionForView(regions, state, city.latitude, city.longitude, 100_000)?.id,
=======
    regionForView(nestedRegions, state, city.latitude, city.longitude, 100_000)
      ?.id,
>>>>>>> integrating-backend-data
    city.id,
  );
});
test("panning away releases focus", () => {
  assert.equal(regionForView(regions, city, 0, 0, 100_000), null);
});
test("Vietnam city and delta focus at their respective scales", () => {
  const canTho = regions.find((region) => region.id === "can-tho");
  assert.equal(
    regionForView(regions, null, canTho.latitude, canTho.longitude, 65_000)?.id,
    "can-tho",
  );
  assert.equal(
    regionForView(regions, canTho, canTho.latitude, canTho.longitude, 360_000)
      ?.id,
    "mekong-delta",
  );
<<<<<<< HEAD
=======
  assert.equal(
    regions.some((r) => r.id === "mekong-delta"),
    false,
  );
>>>>>>> integrating-backend-data
});
test("invalid camera coordinates clear focus", () => {
  assert.equal(
    regionForView(regions, city, NaN, city.longitude, 100_000),
    null,
  );
});
test("only water is supported and processing regions have no fabricated readings", () => {
  assert.deepEqual(Object.keys(indicators), ["water"]);
  for (const id of [
    "porto-alegre",
    "rio-grande-do-sul",
    "can-tho",
    "mekong-delta",
  ]) {
    assert.equal(
      regions.find((region) => region.id === id)?.floodDataStatus,
      "processing",
    );
    assert.equal(readings[id], undefined);
  }
});

test("water controls are limited to the four backend flood-data regions", () => {
  assert.deepEqual(
    regions
      .filter((region) => region.waterMonitoring)
      .map((region) => region.id),
<<<<<<< HEAD
    ["porto-alegre", "rio-grande-do-sul", "can-tho", "mekong-delta"],
=======
    ["porto-velho", "can-tho", "venice", "london"],
>>>>>>> integrating-backend-data
  );
});
