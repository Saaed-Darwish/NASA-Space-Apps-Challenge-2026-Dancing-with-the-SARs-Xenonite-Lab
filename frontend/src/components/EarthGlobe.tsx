import { useEffect, useRef, useState } from "react";
import {
  Entity,
  Color,
  ConstantProperty,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  type Cartesian2,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { indicators, type Indicator, type OverlaySettings } from "../data/demo";
import { LAST_IMAGERY_YEAR } from "../data/imagery";
import {
  addRegionMarkers,
  focusCamera,
  setInitialCameraView,
} from "../globe/scene";
import {
  addHistoricalImagery,
  type HistoricalImagery,
} from "../globe/historicalImagery";
import {
  createOverlayCollection,
  type OverlayCollection,
} from "../globe/overlays";
import type { Region } from "../types/region";

interface EarthGlobeProps {
  time: number;
  isPlaying: boolean;
  focusRequest: number;
  indicator: Indicator;
  overlaySettings: OverlaySettings;
  regions: Region[];
  selectedRegion: Region | null;
  onSelectRegion: (region: Region) => void;
}

export default function EarthGlobe({
  time,
  isPlaying,
  focusRequest,
  indicator,
  overlaySettings,
  regions,
  selectedRegion,
  onSelectRegion,
}: EarthGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const imageryRef = useRef<HistoricalImagery | null>(null);
  const overlaysRef = useRef<OverlayCollection | null>(null);
  const onSelectRegionRef = useRef(onSelectRegion);
  const regionsRef = useRef(regions);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [isLoadingTiles, setIsLoadingTiles] = useState(true);
  const [imageryError, setImageryError] = useState<string | null>(null);
  const frameYear = Math.floor(time);

  useEffect(() => {
    onSelectRegionRef.current = onSelectRegion;
    regionsRef.current = regions;
  }, [onSelectRegion, regions]);

  useEffect(() => {
    if (!containerRef.current) return;
    const viewer = new Viewer(containerRef.current, {
      baseLayer: false,
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
    });
    viewerRef.current = viewer;
    viewer.scene.globe.baseColor = Color.fromCssColorString("#101c28");
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = true;
    setInitialCameraView(viewer);
    imageryRef.current = addHistoricalImagery(viewer, setImageryError);
    const removeTileListener =
      viewer.scene.globe.tileLoadProgressEvent.addEventListener(
        (pendingTiles: number) => setIsLoadingTiles(pendingTiles > 0),
      );

    const clickHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction((event: { position: Cartesian2 }) => {
      const pickedEntity: unknown = viewer.scene.pick(event.position)?.id;
      if (!(pickedEntity instanceof Entity)) return;
      const region = regionsRef.current.find(
        (candidate) => candidate.id === pickedEntity.id,
      );
      if (region) onSelectRegionRef.current(region);
    }, ScreenSpaceEventType.LEFT_CLICK);
    setIsViewerReady(true);

    return () => {
      removeTileListener();
      clickHandler.destroy();
      overlaysRef.current?.destroy();
      overlaysRef.current = null;
      imageryRef.current?.destroy();
      imageryRef.current = null;
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!isViewerReady || !viewer) return;
    viewer.entities.removeAll();
    addRegionMarkers(viewer, regions, "land");
  }, [regions, isViewerReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!isViewerReady || !viewer || !selectedRegion) return;
    const collection = createOverlayCollection(
      viewer,
      selectedRegion,
      setImageryError,
    );
    overlaysRef.current = collection;
    return () => {
      collection.destroy();
      if (overlaysRef.current === collection) overlaysRef.current = null;
    };
  }, [isViewerReady, selectedRegion]);

  useEffect(() => {
    if (!isViewerReady) return;
    imageryRef.current?.update(time);
    overlaysRef.current?.update(time, overlaySettings);
  }, [isViewerReady, time, overlaySettings, selectedRegion]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!isViewerReady || !viewer) return;
    // Continuous frames during animation allow queued tile uploads to finish immediately.
    // Return to on-demand rendering when paused to keep idle GPU use low.
    viewer.scene.requestRenderMode = !isPlaying;
    viewer.scene.requestRender();
  }, [isViewerReady, isPlaying]);

  useEffect(() => {
    setImageryError(null);
  }, [frameYear, selectedRegion]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!isViewerReady || !viewer) return;
    for (const region of regions) {
      const marker = viewer.entities.getById(region.id);
      if (!marker?.label || !marker.point) continue;
      const isSelected = region.id === selectedRegion?.id;
      marker.label.text = new ConstantProperty(
        isSelected
          ? `${region.name} · ${frameYear} satellite mosaic`
          : region.name,
      );
      marker.point.color = new ConstantProperty(
        Color.fromCssColorString(
          isSelected ? indicators[indicator].color : "#a8e7c9",
        ),
      );
    }
    viewer.scene.requestRender();
  }, [regions, selectedRegion, frameYear, indicator, isViewerReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (isViewerReady && viewer) focusCamera(viewer, selectedRegion);
  }, [selectedRegion, isViewerReady, focusRequest]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      <div className="imagery-status" role="status">
        <span className="status-dot" />
        {imageryError ??
          (isLoadingTiles
            ? "Loading satellite imagery…"
            : `${frameYear} annual satellite mosaic`)}
        <small>
          EOX Sentinel-2 · 10 m · Archive through {LAST_IMAGERY_YEAR}
        </small>
      </div>
    </>
  );
}
