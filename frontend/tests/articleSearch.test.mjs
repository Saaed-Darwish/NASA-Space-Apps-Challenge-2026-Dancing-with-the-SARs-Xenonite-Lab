import assert from "node:assert/strict";
import test from "node:test";
import {
  searchRegionArticles,
  viewportSearchArea,
} from "../src/data/articleSearch.ts";

test("viewport searches scale with zoom and reject invalid camera positions", () => {
  assert.equal(viewportSearchArea(48.85, 2.35, 1000).radiusKm, 5);
  assert.equal(viewportSearchArea(48.85, 2.35, 100000).radiusKm, 50);
  assert.equal(viewportSearchArea(48.85, 2.35, 22000000).radiusKm, 250);
  for (const args of [
    [NaN, 0, 1],
    [91, 0, 1],
    [0, 181, 1],
    [0, 0, -1],
  ]) {
    assert.equal(viewportSearchArea(...args), null);
  }
});

test("search outside curated regions uses map coordinates and preserves topic and cancellation", async (t) => {
  const area = viewportSearchArea(48.85, 2.35, 100000);
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const query = new URL(url).searchParams;
    assert.equal(query.get("gsrsearch"), "nearcoord:50km,48.85,2.35 flood");
    assert.equal(options.signal, controller.signal);
    return {
      ok: true,
      json: async () => ({
        query: {
          pages: {
            1: {
              pageid: 1,
              index: 1,
              title: "Nearby flood",
              fullurl: "https://example.com/article",
              coordinates: [{ lat: 48.86, lon: 2.36, globe: "earth" }],
            },
          },
        },
      }),
    };
  });
  const articles = await searchRegionArticles(area, "flood", controller.signal);
  assert.equal(articles[0].regionId, area.id);
  assert.equal(articles[0].latitude, 48.86);
  assert.equal(articles[0].longitude, 2.36);
});

test("curated searches retain named-region queries", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(
      new URL(url).searchParams.get("gsrsearch"),
      "Norilsk wildfire",
    );
    return { ok: true, json: async () => ({}) };
  });
  assert.deepEqual(
    await searchRegionArticles(
      {
        id: "norilsk",
        name: "Norilsk",
        country: "Russia",
        latitude: 69.4,
        longitude: 87.95,
      },
      "wildfire",
      new AbortController().signal,
    ),
    [],
  );
});
