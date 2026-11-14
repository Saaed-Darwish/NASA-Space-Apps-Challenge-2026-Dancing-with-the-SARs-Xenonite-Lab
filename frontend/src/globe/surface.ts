import { Color } from "cesium";
import { indicators, type Indicator } from "../data/demo";
import type { Region } from "../types/region";

const TEXTURE_SIZE = 384;
const BASELINE_YEAR = 2020;
const textureCache = new Map<string, HTMLCanvasElement>();
const MAX_CACHED_TEXTURES = 24;

function gaussian(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
) {
  return Math.exp(
    -(((x - centerX) / width) ** 2 + ((y - centerY) / height) ** 2) * 2,
  );
}

/** Continuous synthetic fields: no rectangular cells or measured feature boundaries. */
function surfaceSignal(
  x: number,
  y: number,
  indicator: Indicator,
  year: number,
  seed: number,
) {
  const age = year - BASELINE_YEAR;
  const warpX = x + 0.1 * Math.sin(y * 13 + seed);
  const warpY = y + 0.08 * Math.sin(x * 11 - seed);
  const river = 0.2 * Math.sin(y * 6 + seed) + 0.08 * Math.sin(y * 15);
  const distance = Math.abs(warpX - river);
  const originalChannel = Math.exp(-((distance / 0.075) ** 2));
  const seasonalChannel = Math.exp(-((distance / (0.075 + age * 0.014)) ** 2));
  const wetland = gaussian(warpX, warpY, 0.22, -0.42, 0.45 + age * 0.025, 0.25);
  const drying = gaussian(warpX, warpY, -0.38, 0.42, 0.25, 0.3);
  return (
    (seasonalChannel - originalChannel) * 0.8 +
    wetland * age * 0.075 -
    drying * age * 0.09
  );
}

// Build each ramp once instead of allocating a Cesium Color for every pixel.
const COLOR_STEPS = 1024;
const colorRamps = new Map<Indicator, Uint8ClampedArray>();
function colorRamp(indicator: Indicator) {
  const cached = colorRamps.get(indicator);
  if (cached) return cached;
  const palette = indicators[indicator].colors.map((color) =>
    Color.fromCssColorString(color),
  );
  const ramp = new Uint8ClampedArray(COLOR_STEPS * 3);
  const color = new Color();
  for (let step = 0; step < COLOR_STEPS; step++) {
    const position = (step / (COLOR_STEPS - 1)) * (palette.length - 1);
    const index = Math.min(Math.floor(position), palette.length - 2);
    Color.lerp(palette[index], palette[index + 1], position - index, color);
    ramp[step * 3] = Math.round(color.red * 255);
    ramp[step * 3 + 1] = Math.round(color.green * 255);
    ramp[step * 3 + 2] = Math.round(color.blue * 255);
  }
  colorRamps.set(indicator, ramp);
  return ramp;
}

export function createSurfaceTexture(
  region: Region,
  indicator: Indicator,
  year: number,
): HTMLCanvasElement {
  const cacheKey = `${region.id}/${indicator}/${year}`;
  const cachedTexture = textureCache.get(cacheKey);
  if (cachedTexture) return cachedTexture;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Surface overlay needs a 2D canvas context.");
  const pixels = context.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const ramp = colorRamp(indicator);
  const seed = region.longitude * 0.13 + region.latitude * 0.07;

  for (let row = 0; row < TEXTURE_SIZE; row++) {
    for (let column = 0; column < TEXTURE_SIZE; column++) {
      const x = (column / (TEXTURE_SIZE - 1)) * 2 - 1;
      const y = 1 - (row / (TEXTURE_SIZE - 1)) * 2;
      const signal = surfaceSignal(x, y, indicator, year, seed);
      const magnitude = Math.abs(signal);
      const edgeFade = Math.max(
        0,
        Math.min(1, (1 - Math.max(Math.abs(x), Math.abs(y))) / 0.22),
      );
      const visibility = Math.min(1, Math.max(0, (magnitude - 0.035) * 3.5));
      const palettePosition = 0.5 + signal * 0.5;
      const colorOffset =
        Math.round(
          Math.max(0, Math.min(1, palettePosition)) * (COLOR_STEPS - 1),
        ) * 3;
      const offset = (row * TEXTURE_SIZE + column) * 4;
      pixels.data[offset] = ramp[colorOffset];
      pixels.data[offset + 1] = ramp[colorOffset + 1];
      pixels.data[offset + 2] = ramp[colorOffset + 2];
      pixels.data[offset + 3] = Math.round(255 * visibility * edgeFade);
    }
  }
  context.putImageData(pixels, 0, 0);
  if (textureCache.size >= MAX_CACHED_TEXTURES) {
    const oldestKey = textureCache.keys().next().value;
    if (oldestKey) textureCache.delete(oldestKey);
  }
  textureCache.set(cacheKey, canvas);
  return canvas;
}
