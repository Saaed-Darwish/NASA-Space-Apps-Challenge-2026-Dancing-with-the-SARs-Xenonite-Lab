import {
  ImageryLayer,
  Rectangle,
  SingleTileImageryProvider,
  type Viewer,
} from "cesium";
import type { Indicator, OverlaySettings } from "../data/demo";
import { LAST_IMAGERY_YEAR } from "../data/imagery";
import type { Region } from "../types/region";
import { createSurfaceTexture } from "./surface";

const INDICATOR_ORDER: Indicator[] = ["land", "water", "fire"];

/** Static, decoded raster layers avoid material re-uploads and coplanar entity flashes. */
export function createOverlayCollection(
  viewer: Viewer,
  region: Region,
  onError: (message: string) => void,
) {
  const scale = region.altitude / 380_000;
  const rectangle = Rectangle.fromDegrees(
    region.longitude - 1.12 * scale,
    region.latitude - 0.76 * scale,
    region.longitude + 1.12 * scale,
    region.latitude + 0.76 * scale,
  );
  const layers = new Map<string, ImageryLayer>();
  const pending = new Set<string>();
  let isDestroyed = false;
  let currentTime = LAST_IMAGERY_YEAR;
  let currentSettings: OverlaySettings | null = null;

  function applyOpacity() {
    if (isDestroyed || !currentSettings) return;
    const previousYear = Math.floor(currentTime);
    const nextYear = Math.min(previousYear + 1, LAST_IMAGERY_YEAR);
    const blend = currentTime - previousYear;
    for (const indicator of INDICATOR_ORDER) {
      for (const [key, layer] of layers) {
        if (!key.startsWith(`${indicator}/`)) continue;
        const year = Number(key.split("/")[1]);
        const weight =
          year === previousYear ? 1 - blend : year === nextYear ? blend : 0;
        const settings = currentSettings[indicator];
        layer.show = settings.enabled && weight > 0;
        layer.alpha = settings.enabled ? (settings.opacity / 100) * weight : 0;
      }
    }
    viewer.scene.requestRender();
  }

  async function ensureFrame(indicator: Indicator, year: number) {
    const key = `${indicator}/${year}`;
    if (layers.has(key) || pending.has(key)) return;
    pending.add(key);
    try {
      const canvas = createSurfaceTexture(region, indicator, year);
      // Decode once before exposing a layer to Cesium. Playback only changes alpha.
      const provider = await SingleTileImageryProvider.fromUrl(
        canvas.toDataURL("image/png"),
        { rectangle },
      );
      if (isDestroyed || viewer.isDestroyed()) return;
      const layer = new ImageryLayer(provider, { alpha: 0 });
      viewer.imageryLayers.add(layer);
      layers.set(key, layer);
      // Preserve the same compositing order regardless of image decode completion.
      for (const orderedIndicator of INDICATOR_ORDER) {
        [...layers.entries()]
          .filter(([name]) => name.startsWith(`${orderedIndicator}/`))
          .sort(([first], [second]) => first.localeCompare(second))
          .forEach(([, existing]) => viewer.imageryLayers.raiseToTop(existing));
      }
      applyOpacity();
    } catch (error) {
      if (!isDestroyed) {
        console.error("Surface overlay could not load", error);
        onError(
          "A simulated overlay could not load. Toggle it off and on to retry.",
        );
      }
    } finally {
      pending.delete(key);
    }
  }

  return {
    update(time: number, settings: OverlaySettings) {
      currentTime = time;
      currentSettings = settings;
      const previousYear = Math.floor(time);
      for (const indicator of INDICATOR_ORDER) {
        if (!settings[indicator].enabled) continue;
        void ensureFrame(indicator, previousYear);
        void ensureFrame(
          indicator,
          Math.min(previousYear + 1, LAST_IMAGERY_YEAR),
        );
      }
      applyOpacity();
    },
    destroy() {
      isDestroyed = true;
      if (!viewer.isDestroyed()) {
        layers.forEach((layer) => viewer.imageryLayers.remove(layer, true));
        viewer.scene.requestRender();
      }
      layers.clear();
    },
  };
}

export type OverlayCollection = ReturnType<typeof createOverlayCollection>;
