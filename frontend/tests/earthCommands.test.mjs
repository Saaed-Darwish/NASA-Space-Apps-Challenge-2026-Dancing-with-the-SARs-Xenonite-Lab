import assert from "node:assert/strict";
import test from "node:test";
import { placeQuery, searchPlaces } from "../src/data/earthCommands.ts";

test("only explicit user search commands trigger location lookup", () => {
  for (const command of [
    "search Calgary, Alberta",
    "Please zoom to Calgary, Alberta",
    "find Calgary, Alberta",
    "locate Calgary, Alberta",
    "go to Calgary, Alberta",
  ])
    assert.equal(placeQuery(command), "Calgary, Alberta");
  for (const text of [
    "What changed here?",
    "Tell me about Calgary",
    "search",
    "search " + "x".repeat(201),
  ])
    assert.equal(placeQuery(text), null);
});

test("place lookup uses fixed provider and validates Earth coordinates and source URLs", async () => {
  const original = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      json: async () => ({
        query: {
          pages: {
            1: {
              pageid: 1,
              index: 1,
              title: "Calgary",
              fullurl: "https://en.wikipedia.org/wiki/Calgary",
              coordinates: [{ lat: 51.05, lon: -114.07, globe: "earth" }],
            },
            2: {
              pageid: 2,
              index: 2,
              title: "Mars",
              fullurl: "https://en.wikipedia.org/wiki/Mars",
              coordinates: [{ lat: 0, lon: 0, globe: "mars" }],
            },
            3: {
              pageid: 3,
              index: 3,
              title: "Bad",
              fullurl: "https://evil.example/place",
              coordinates: [{ lat: 51, lon: 0, globe: "earth" }],
            },
            4: {
              pageid: 4,
              index: 4,
              title: "Invalid",
              fullurl: "https://en.wikipedia.org/wiki/Bad",
              coordinates: [{ lat: 95, lon: 0, globe: "earth" }],
            },
          },
        },
      }),
    };
  };
  try {
    const signal = new AbortController().signal;
    const results = await searchPlaces("Calgary, Alberta", signal);
    assert.equal(results.length, 1);
    assert.equal(results[0].latitude, 51.05);
    assert.equal(results[0].regionId, "earth-search");
    const url = new URL(captured.url);
    assert.equal(url.hostname, "en.wikipedia.org");
    assert.equal(url.searchParams.get("gsrsearch"), "Calgary, Alberta");
    assert.equal(captured.options.signal, signal);
  } finally {
    global.fetch = original;
  }
});

test("no mapped results stay empty and provider failures remain actionable", async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ query: { pages: {} } }),
    });
    assert.deepEqual(
      await searchPlaces("not a place", new AbortController().signal),
      [],
    );
    global.fetch = async () => ({ ok: false });
    await assert.rejects(
      searchPlaces("Calgary", new AbortController().signal),
      /try again/i,
    );
  } finally {
    global.fetch = original;
  }
});
