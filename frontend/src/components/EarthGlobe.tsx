import { useEffect, useRef, useState } from "react";
import {
  Entity,
  ImageryLayer,
  Ion,
  IonImageryProvider,
  OpenStreetMapImageryProvider,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  type Cartesian2,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { Indicator } from "../data/demo";
import {
  addDemoOverlay,
  addRegionMarkers,
  focusCamera,
  setInitialCameraView,
} from "../globe/scene";
import type { Region } from "../types/region";

interface EarthGlobeProps {
  focusRequest: number;
  indicator: Indicator;
  showOverlay: boolean;
  opacity: number;
  regions: Region[];
  selectedRegion: Region | null;
  onSelectRegion: (region: Region) => void;
}

async function loadBaseImagery(viewer: Viewer, token: string | undefined) {
  try {
    const provider = token
      ? await IonImageryProvider.fromAssetId(2)
      : new OpenStreetMapImageryProvider({
          url: "https://tile.openstreetmap.org/",
        });

    // Imagery may finish loading after React has unmounted the globe.
    if (!viewer.isDestroyed()) {
      viewer.imageryLayers.add(new ImageryLayer(provider));
    }
  } catch (error) {
    console.error("Imagery failed to load:", error);
  }
}

export default function EarthGlobe({
  focusRequest,
  indicator,
  showOverlay,
  opacity,
  regions,
  selectedRegion,
  onSelectRegion,
}: EarthGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const onSelectRegionRef = useRef(onSelectRegion);
  const regionsRef = useRef(regions);
  const [isViewerReady, setIsViewerReady] = useState(false);

  // The Cesium click handler is installed once and reads the latest React props.
  useEffect(() => {
    onSelectRegionRef.current = onSelectRegion;
    regionsRef.current = regions;
  }, [onSelectRegion, regions]);

  useEffect(() => {
    if (!containerRef.current) return;

    const token = import.meta.env.VITE_CESIUM_ION_TOKEN;
    if (token) Ion.defaultAccessToken = token;

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
    setInitialCameraView(viewer);
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = true;
    void loadBaseImagery(viewer, token);

    const clickHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction((event: { position: Cartesian2 }) => {
      const pickedObject = viewer.scene.pick(event.position);
      const pickedEntity: unknown = pickedObject?.id;
      if (!(pickedEntity instanceof Entity)) return;

      const region = regionsRef.current.find(
        (candidate) => candidate.id === pickedEntity.id,
      );
      if (region) onSelectRegionRef.current(region);
    }, ScreenSpaceEventType.LEFT_CLICK);

    setIsViewerReady(true);
    return () => {
      clickHandler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!isViewerReady || !viewer) return;

    viewer.entities.removeAll();
    addRegionMarkers(viewer, regions, indicator);
    if (selectedRegion && showOverlay) {
      addDemoOverlay(viewer, selectedRegion, indicator, opacity);
    }
  }, [regions, isViewerReady, selectedRegion, indicator, showOverlay, opacity]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!isViewerReady || !viewer) return;
    focusCamera(viewer, selectedRegion);
  }, [selectedRegion, isViewerReady, focusRequest]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
