
import { useEffect, useRef, useState } from "react";
import {
  Viewer,
  Cartesian3,
  Cartesian2,
  Color,
  Math as CesiumMath,
  OpenStreetMapImageryProvider,
  ImageryLayer,
  Ion,
  IonImageryProvider,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  HeightReference,
  LabelStyle,
  defined,
} from "cesium";

import "cesium/Build/Cesium/Widgets/widgets.css";
import type { Region } from "../types/region";

interface Props {
  regions: Region[];
  selectedRegion: Region | null;
  onSelectRegion: (region: Region) => void;
}

export default function EarthGlobe({
  regions,
  selectedRegion,
  onSelectRegion,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const callbackRef = useRef(onSelectRegion);
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    callbackRef.current = onSelectRegion;
  }, [onSelectRegion]);

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
    });

    viewerRef.current = viewer;

    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        -35, 35, 22000000
      ),
    });

    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.showGroundAtmosphere = true;

    let cancelled = false;

    async function loadImagery() {
      try {
        const provider = token
          ? await IonImageryProvider.fromAssetId(2)
          : new OpenStreetMapImageryProvider({
              url: "https://tile.openstreetmap.org/",
            });

        if (!cancelled && !viewer.isDestroyed()) {
          viewer.imageryLayers.add(
            new ImageryLayer(provider)
          );
        }
      } catch (error) {
        console.error("Imagery failed to load:", error);
      }
    }

    void loadImagery();

    const handler = new ScreenSpaceEventHandler(
      viewer.scene.canvas
    );

    handler.setInputAction((event: any) => {
      const picked = viewer.scene.pick(event.position);

      if (defined(picked) && picked.id?.id) {
        const region = regionsRef.current.find(
          (r) => r.id === picked.id.id
        );

        if (region) callbackRef.current(region);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    setViewerReady(true);

    return () => {
      cancelled = true;
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  const regionsRef = useRef(regions);

  useEffect(() => {
    regionsRef.current = regions;
  }, [regions]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewerReady || !viewer) return;

    viewer.entities.removeAll();

    for (const region of regions) {
      viewer.entities.add({
        id: region.id,
        name: region.name,
        position: Cartesian3.fromDegrees(
          region.longitude,
          region.latitude
        ),
        point: {
          pixelSize: 12,
          color: Color.CYAN,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Infinity,
        },
        label: {
          text: region.name,
          font: "14px sans-serif",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cartesian2(0, -24),
          verticalOrigin: VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Infinity,
        },
      });
    }
  }, [regions, viewerReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewerReady || !viewer || !selectedRegion) return;

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        selectedRegion.longitude,
        selectedRegion.latitude,
        selectedRegion.altitude
      ),
      orientation: {
        heading: 0,
        pitch: CesiumMath.toRadians(-90),
        roll: 0,
      },
      duration: 2.5,
    });
  }, [selectedRegion, viewerReady]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
    />
  );
}
