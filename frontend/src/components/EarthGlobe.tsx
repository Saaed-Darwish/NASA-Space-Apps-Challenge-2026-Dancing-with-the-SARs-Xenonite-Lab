import { useEffect, useRef, useState } from "react";
import {
  Entity,
  Cartesian3,
  Cartesian2,
  Cartographic,
  Math as CesiumMath,
  Color,
  ConstantProperty,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  type Entity as CesiumEntity,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { indicators, type Indicator, type OverlaySettings } from "../data/demo";
import { LAST_IMAGERY_YEAR } from "../data/imagery";
import {
  addRegionMarkers,
  focusCamera,
  setInitialCameraView,
  trackMarkerVisibility,
} from "../globe/scene";
import { regionForView } from "../globe/focus";
import {
  addHistoricalImagery,
  type HistoricalImagery,
} from "../globe/historicalImagery";
import {
  createOverlayCollection,
  type OverlayCollection,
} from "../globe/overlays";
import type { Region } from "../types/region";

import { stories, type RegionStory } from "../data/stories";
import { addStoryMarkers, isStoryVisible } from "../globe/storyMarkers";
import { storyMarkerOpacity } from "../data/storyTimeline";
import { PIN_LABEL_BACKGROUND, PIN_LABEL_TEXT } from "../globe/markerStyle";
import {
  viewportSearchArea,
  type ArticleSearchArea,
  type DiscoveredArticle,
} from "../data/articleSearch";

interface EarthGlobeProps {
  articles: DiscoveredArticle[];
  selectedArticle: DiscoveredArticle | null;
  onSelectArticle: (article: DiscoveredArticle) => void;
  selectedStory: RegionStory | null;
  showStoryMarkers: boolean;
  onSelectStory: (story: RegionStory) => void;
  time: number;
  isPlaying: boolean;
  focusRequest: number;
  indicator: Indicator;
  overlaySettings: OverlaySettings;
  regions: Region[];
  selectedRegion: Region | null;
  onSelectRegion: (region: Region) => void;
  onViewportFocus: (region: Region | null) => void;
  onSearchAreaChange: (area: ArticleSearchArea | null) => void;
}

export default function EarthGlobe({
  articles,
  selectedArticle,
  onSelectArticle,
  selectedStory,
  showStoryMarkers,
  onSelectStory,
  time,
  isPlaying,
  focusRequest,
  indicator,
  overlaySettings,
  regions,
  selectedRegion,
  onSelectRegion,
  onViewportFocus,
  onSearchAreaChange,
}: EarthGlobeProps) {
  const searchAreaRef = useRef(onSearchAreaChange);
  useEffect(() => {
    searchAreaRef.current = onSearchAreaChange;
  }, [onSearchAreaChange]);
  const viewFocusRef = useRef(onViewportFocus);
  const focusedRegionRef = useRef(selectedRegion);
  const handledFocusRequest = useRef<number | null>(null);
  const cameraFlight = useRef(false);
  const storyFocusRef = useRef(selectedStory);
  useEffect(() => {
    storyFocusRef.current = selectedStory;
  }, [selectedStory]);
  useEffect(() => {
    viewFocusRef.current = onViewportFocus;
    focusedRegionRef.current = selectedRegion;
  }, [onViewportFocus, selectedRegion]);
  const storyMarkersRef = useRef<Map<string, CesiumEntity>>(new Map());
  const storyAlphaRef = useRef(new WeakMap<CesiumEntity, number>());
  const articlesRef = useRef(articles);
  const onSelectArticleRef = useRef(onSelectArticle);
  useEffect(() => {
    articlesRef.current = articles;
    onSelectArticleRef.current = onSelectArticle;
  }, [articles, onSelectArticle]);
  const onSelectStoryRef = useRef(onSelectStory);
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
    onSelectStoryRef.current = onSelectStory;
    onSelectRegionRef.current = onSelectRegion;
    regionsRef.current = regions;
  }, [onSelectRegion, onSelectStory, regions]);

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
    const removeVisibilityListener = trackMarkerVisibility(viewer);
    const updateViewport = () => {
      const canvas = viewer.scene.canvas;
      const center = viewer.camera.pickEllipsoid(
        new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
        viewer.scene.globe.ellipsoid,
      );
      const location = center ? Cartographic.fromCartesian(center) : null;
      searchAreaRef.current(
        location
          ? viewportSearchArea(
              CesiumMath.toDegrees(location.latitude),
              CesiumMath.toDegrees(location.longitude),
              viewer.camera.positionCartographic.height,
            )
          : null,
      );
      if (cameraFlight.current) return;
      const story = storyFocusRef.current;
      // A story may lie outside its region's camera center. Keep its context while
      // inspecting the story, then let normal zoom-out/pan focus rules take over.
      if (
        center &&
        story &&
        focusedRegionRef.current?.id === story.regionId &&
        viewer.camera.positionCartographic.height <=
          Math.max(80_000, story.cameraAltitude * 3) &&
        Cartesian3.distance(
          center,
          Cartesian3.fromDegrees(story.longitude, story.latitude),
        ) <= Math.max(20_000, viewer.camera.positionCartographic.height)
      )
        return;
      const next = location
        ? regionForView(
            regionsRef.current,
            focusedRegionRef.current,
            CesiumMath.toDegrees(location.latitude),
            CesiumMath.toDegrees(location.longitude),
            viewer.camera.positionCartographic.height,
          )
        : null;
      if (next?.id !== focusedRegionRef.current?.id) {
        focusedRegionRef.current = next;
        viewFocusRef.current(next);
      }
    };
    updateViewport();
    const removeCameraListener =
      viewer.camera.moveEnd.addEventListener(updateViewport);
    const removeTileListener =
      viewer.scene.globe.tileLoadProgressEvent.addEventListener(
        (pendingTiles: number) => setIsLoadingTiles(pendingTiles > 0),
      );

    const clickHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction((event: { position: Cartesian2 }) => {
      const pickedEntity: unknown = viewer.scene.pick(event.position)?.id;
      if (!(pickedEntity instanceof Entity)) return;
      if (pickedEntity.id.startsWith("article/")) {
        const article = articlesRef.current.find(
          (item) => `article/${item.id}` === pickedEntity.id,
        );
        if (article) onSelectArticleRef.current(article);
        return;
      }
      if (pickedEntity.id.startsWith("story/")) {
        const story = stories.find(
          (candidate) => `story/${candidate.id}` === pickedEntity.id,
        );
        if (story) onSelectStoryRef.current(story);
        return;
      }
      const region = regionsRef.current.find(
        (candidate) => candidate.id === pickedEntity.id,
      );
      if (region) onSelectRegionRef.current(region);
    }, ScreenSpaceEventType.LEFT_CLICK);
    setIsViewerReady(true);

    return () => {
      removeVisibilityListener();
      removeCameraListener();
      handledFocusRequest.current = null;
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
    addRegionMarkers(viewer, regions, "water");
    storyMarkersRef.current = addStoryMarkers(viewer);
  }, [regions, isViewerReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!isViewerReady || !viewer) return;
    const entities: CesiumEntity[] = [];
    for (const article of articles) {
      if (
        (selectedRegion && article.regionId !== selectedRegion.id) ||
        article.latitude === undefined ||
        article.longitude === undefined
      )
        continue;
      entities.push(
        viewer.entities.add({
          id: `article/${article.id}`,
          name: article.title,
          position: Cartesian3.fromDegrees(article.longitude, article.latitude),
          point: {
            pixelSize: 13,
            color: Color.fromCssColorString("#79aaff"),
            outlineColor: Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Infinity,
          },
        }),
      );
    }
    viewer.scene.requestRender();
    return () => {
      if (!viewer.isDestroyed()) {
        entities.forEach((entity) => viewer.entities.remove(entity));
        viewer.scene.requestRender();
      }
    };
  }, [articles, selectedRegion, isViewerReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (
      !isViewerReady ||
      !viewer ||
      !selectedRegion ||
      !selectedRegion.waterMonitoring ||
      selectedRegion.floodDataStatus === "processing"
    )
      return;
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
        isSelected ? `${region.name} · ${frameYear}` : region.name,
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
    if (isViewerReady && viewer) {
      // Viewport selection updates context only; explicit clicks/refocus move the camera.
      if (handledFocusRequest.current === focusRequest) return;
      handledFocusRequest.current = focusRequest;
      const target = selectedArticle
        ? {
            id: selectedArticle.id,
            name: selectedArticle.title,
            country: "",
            description: selectedArticle.summary,
            zoom_level: "city",
            latitude: selectedArticle.latitude!,
            longitude: selectedArticle.longitude!,
            altitude: 45000,
          }
        : selectedStory && selectedRegion
          ? {
              ...selectedRegion,
              latitude: selectedStory.latitude,
              longitude: selectedStory.longitude,
              altitude: selectedStory.cameraAltitude,
            }
          : selectedRegion;
      focusCamera(viewer, target, (moving) => {
        cameraFlight.current = moving;
      });
    }
  }, [
    selectedRegion,
    selectedStory,
    selectedArticle,
    isViewerReady,
    focusRequest,
  ]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!isViewerReady || !viewer) return;
    for (const story of stories) {
      const marker = storyMarkersRef.current.get(story.id);
      if (!marker) continue;
      marker.show = isStoryVisible(
        story,
        selectedRegion?.id,
        time,
        showStoryMarkers,
      );
      if (!marker.show) continue;
      const alpha = storyMarkerOpacity(story, time);
      if (storyAlphaRef.current.get(marker) === alpha) continue;
      storyAlphaRef.current.set(marker, alpha);
      if (marker.billboard)
        marker.billboard.color = new ConstantProperty(
          Color.WHITE.withAlpha(alpha),
        );
      if (marker.label) {
        marker.label.fillColor = new ConstantProperty(
          PIN_LABEL_TEXT.withAlpha(alpha),
        );
        marker.label.outlineColor = new ConstantProperty(
          Color.BLACK.withAlpha(alpha),
        );
        marker.label.backgroundColor = new ConstantProperty(
          PIN_LABEL_BACKGROUND.withAlpha(alpha * PIN_LABEL_BACKGROUND.alpha),
        );
      }
    }
    viewer.scene.requestRender();
  }, [
    regions,
    isViewerReady,
    selectedRegion,
    selectedStory,
    time,
    showStoryMarkers,
  ]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      <div className="imagery-status" role="status">
        <span className="status-dot" />
        <span>
          {imageryError ??
            (isLoadingTiles
              ? "Loading satellite imagery…"
              : `${frameYear} annual satellite mosaic`)}
        </span>
        <small
          title={`EOX Sentinel-2 · 10 m · Archive through ${LAST_IMAGERY_YEAR}`}
        >
          EOX Sentinel-2 · 10 m
        </small>
      </div>
    </>
  );
}
