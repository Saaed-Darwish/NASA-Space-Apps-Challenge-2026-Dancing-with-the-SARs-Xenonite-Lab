import {
  Credit,
  ImageryLayer,
  UrlTemplateImageryProvider,
  WebMercatorTilingScheme,
  type Viewer,
} from "cesium";
import { LAST_IMAGERY_YEAR, YEARS } from "../data/imagery";

export interface HistoricalImagery {
  update: (time: number) => void;
  destroy: () => void;
}

/** Keep dated providers alive; a year change adjusts opacity, never the tile URL in place. */
export function addHistoricalImagery(
  viewer: Viewer,
  onError: (message: string) => void,
): HistoricalImagery {
  const layers = YEARS.map((year) => {
    const credit = new Credit(
      `<a href="https://cloudless.eox.at">EOxCloudless</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data ${year}) · <a href="https://cloudless.eox.at/license-non-commercial">CC BY-NC-SA 4.0</a>`,
      true,
    );
    const provider = new UrlTemplateImageryProvider({
      url: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`,
      tilingScheme: new WebMercatorTilingScheme(),
      maximumLevel: 14,
      credit,
    });
    const removeErrorListener = provider.errorEvent.addEventListener(
      (error) => {
        if (error.timesRetried < 2) error.retry = true;
        else
          onError(
            `${year} imagery could not load. Check your connection or try another year.`,
          );
      },
    );
    const layer = new ImageryLayer(provider, { alpha: 0, show: false });
    viewer.imageryLayers.add(layer);
    return { year, layer, removeErrorListener };
  });

  return {
    update(time) {
      const previousYear = Math.floor(time);
      const nextYear = Math.min(previousYear + 1, LAST_IMAGERY_YEAR);
      const blend = time - previousYear;
      for (const { year, layer } of layers) {
        layer.show = year === previousYear || year === nextYear;
        // The older image stays opaque beneath the new image: no fade to the globe.
        // A nearly invisible next layer warms its tiles before the transition starts.
        layer.alpha =
          year === previousYear
            ? 1
            : year === nextYear
              ? Math.max(blend, 0.00001)
              : 0;
      }
      viewer.scene.requestRender();
    },
    destroy() {
      for (const { layer, removeErrorListener } of layers) {
        removeErrorListener();
        if (!viewer.isDestroyed()) viewer.imageryLayers.remove(layer, true);
      }
    },
  };
}
