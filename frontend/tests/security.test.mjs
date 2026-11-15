import assert from "node:assert/strict";
import test from "node:test";
import { safeExternalUrl } from "../src/data/validation.ts";
import { parseEarthAIResponse } from "../src/data/earthAI.ts";
import {
  searchRegionArticles,
  viewportSearchArea,
} from "../src/data/articleSearch.ts";

test("external links require HTTPS and reject embedded credentials", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "//evil.test",
    "http://evil.test",
    "https://user:password@example.com",
    null,
  ]) {
    assert.equal(safeExternalUrl(url), null);
  }
  assert.equal(
    safeExternalUrl("https://science.nasa.gov/earth/"),
    "https://science.nasa.gov/earth/",
  );
});

test("AI responses cannot override message roles or inject unsafe source links", () => {
  const result = parseEarthAIResponse({
    text: "Evidence [S1]",
    id: "override",
    role: "user",
    error: true,
    sources: [
      null,
      { url: "javascript:alert(1)", title: "Unsafe", publisher: "External" },
      {
        url: "https://science.nasa.gov/",
        title: "Evidence",
        publisher: "NASA",
        id: "S1",
      },
    ],
  });
  assert.equal(result.id, undefined);
  assert.equal(result.role, undefined);
  assert.equal(result.error, undefined);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].id, "S1");
  for (const value of [
    null,
    [],
    {},
    { text: " " },
    { text: "x".repeat(12001) },
  ]) {
    assert.throws(() => parseEarthAIResponse(value), /invalid response/);
  }
});

test("discovery discards malformed pages and off-provider links without losing valid articles", async (t) => {
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({
      query: {
        pages: {
          1: null,
          2: { pageid: 2, title: "Unsafe", fullurl: "javascript:alert(1)" },
          3: {
            pageid: 3,
            title: "Spoofed",
            fullurl: "https://en.wikipedia.org.evil.test/wiki/Flood",
          },
          4: {
            pageid: 4,
            title: "Good",
            fullurl: "https://en.wikipedia.org/wiki/Flood",
            coordinates: [null, { lat: "0", lon: 0, globe: "earth" }],
          },
        },
      },
    }),
  }));
  const result = await searchRegionArticles(
    viewportSearchArea(0, 0, 10000),
    "",
    new AbortController().signal,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Good");
  assert.equal(result[0].latitude, undefined);
});
