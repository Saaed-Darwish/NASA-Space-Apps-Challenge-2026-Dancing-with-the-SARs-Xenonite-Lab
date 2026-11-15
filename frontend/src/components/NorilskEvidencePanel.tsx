import { memo, useState } from "react";
import {
  norilskOverlays,
  norilskCredit,
  type GroundMotionSelection,
} from "../data/norilsk";

const figures = [
  ["fig_tank_series.png", "Tank movement and comparable targets"],
  ["fig_tank_checks.png", "Winter movement, snow and processing checks"],
  ["fig_local.png", "Local seasonal motion: 2020 and 2025"],
  ["fig_robustness.png", "Wetland movement and accumulated thaw"],
  ["fig_gnss_nril.png", "NRIL bedrock reference station"],
  ["fig_disp_vs_sqrt_tdd.png", "Seasonal movement by analysis zone"],
];

function EvidenceImage({ file, caption }: { file: string; caption: string }) {
  const url = `/norilsk/images/${file}`;
  return (
    <figure>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open full-size: ${caption}`}
      >
        <img src={url} alt={caption} loading="lazy" decoding="async" />
      </a>
      <figcaption>{caption} · Open image for detail</figcaption>
    </figure>
  );
}

export default memo(function NorilskEvidencePanel({
  selection,
  onChange,
}: {
  selection: GroundMotionSelection | null;
  onChange: (selection: GroundMotionSelection | null) => void;
}) {
  const [overlayId, setOverlayId] = useState(
    selection?.overlay.id ?? "local_persistent",
  );
  const [opacity, setOpacity] = useState(selection?.opacity ?? 0.75);
  const overlay = norilskOverlays.find((item) => item.id === overlayId)!;
  const horizontal = overlay.id.endsWith("_east");
  return (
    <section
      className="norilsk-evidence"
      aria-label="Norilsk research evidence"
    >
      <div className="section-heading">TANK COLLAPSE · 29 MAY 2020</div>
      <h3>A local movement signal before the collapse</h3>
      <p className="small">
        The team's Sentinel-1 analysis measures approximately 14.4 mm of
        downward movement at tank 5 between 6 December 2019 and 4 April 2020,
        relative to nearby stable targets. It is evidence of movement, not proof
        of its cause.
      </p>
      <p className="small sar-caveat">
        Snow accumulation can mimic settlement. One radar track and 20 m pixels
        cannot resolve tilt within the tank. Independently rebased winter and
        summer segments cannot establish a continuous annual trend.
      </p>
      <h3>Ground-motion maps</h3>
      <label className="sar-field">
        Research layer
        <select
          value={overlayId}
          onChange={(event) => {
            setOverlayId(event.target.value);
            if (selection)
              onChange({
                overlay: norilskOverlays.find(
                  (item) => item.id === event.target.value,
                )!,
                opacity,
              });
          }}
        >
          {norilskOverlays.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <label className="sar-quality">
        <input
          type="checkbox"
          checked={selection !== null}
          onChange={(event) =>
            onChange(event.target.checked ? { overlay, opacity } : null)
          }
        />{" "}
        Show ground-motion overlay
      </label>
      {selection && (
        <label className="sar-field">
          Overlay opacity · {Math.round(opacity * 100)}%
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(event) => {
              const value = Number(event.target.value);
              setOpacity(value);
              onChange({ overlay, opacity: value });
            }}
          />
        </label>
      )}
      <div className="motion-scale" aria-label="Ground-motion legend">
        <span>
          {horizontal ? "West" : "Down"} −{overlay.limit} mm
        </span>
        <span>0</span>
        <span>
          {horizontal ? "East" : "Up"} +{overlay.limit} mm
        </span>
      </div>
      <p className="small">
        {overlay.period
          ? `Acquisition interval: ${overlay.period}. `
          : overlay.id.startsWith("nisar")
            ? "2026 research cross-check; exact pair dates were not supplied in the manifest. "
            : "Derived seasonal product; see layer description. "}
        {overlay.description}
      </p>
      <p className="small muted">
        Transparent pixels are near zero or excluded. This is ground
        displacement, not an oil-spill or water-extent map. Layer dates are
        independent of the 2020–2025 optical basemap. No Sentinel-1 observations
        are supplied for 2022–2024; the 2026 seasonal result is preliminary.
      </p>
      <details className="sar-details">
        <summary>Dated satellite images</summary>
        <h4>Tank farm before and after the collapse</h4>
        <div className="norilsk-image-pair">
          <EvidenceImage
            file="s2_tank_before.png"
            caption="Before · 2 September 2019"
          />
          <EvidenceImage
            file="s2_tank_after.png"
            caption="After · 20 July 2020"
          />
        </div>
        <p className="small muted">
          Sentinel-2 true colour, 10 m. Context only: too coarse to assess the
          tank's structural condition.
        </p>
        <h4>River corridor after the spill</h4>
        <div className="norilsk-image-pair">
          <EvidenceImage
            file="s2_spill_20200531.png"
            caption="31 May 2020 · after the spill"
          />
          <EvidenceImage
            file="s2_spill_20200608.png"
            caption="8 June 2020 · after the spill"
          />
        </div>
        <p className="small muted">
          Both views follow the collapse. These supplied pictures are not
          georeferenced and are shown as images, not quantitative spill
          footprints.
        </p>
      </details>
      <details className="sar-details">
        <summary>Research figures and source tables</summary>
        {figures.map(([file, caption]) => (
          <EvidenceImage key={file} file={file} caption={caption} />
        ))}
        <p className="small">
          The NRIL station samples bedrock at one location; it does not rule out
          local tank movement. Large-scale radar patterns include atmospheric
          effects. The team's interpretation should be read alongside the
          published study and investigation linked in the stories.
        </p>
        <p className="small">
          <a href="/norilsk/tables/tank_points_series.csv" download>
            Download point readings (CSV)
          </a>{" "}
          ·{" "}
          <a href="/norilsk/tables/tank_winters.csv" download>
            Winter comparisons (CSV)
          </a>{" "}
          ·{" "}
          <a href="/norilsk/tables/wetland_by_summer.csv" download>
            Wetland summers (CSV)
          </a>
        </p>
        <p className="small">
          <a
            href="/norilsk/README.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Package methods and file guide
          </a>{" "}
          ·{" "}
          <a href="/norilsk/manifest.json" download>
            Original manifest
          </a>
        </p>
        <p className="small muted">{norilskCredit}</p>
      </details>
      <p className="small muted">
        Contains modified Copernicus Sentinel data; ASF HyP3, NASA/ISRO NISAR,
        ERA5 and NGL NRIL. Research results supplied by the Norilsk team.
      </p>
    </section>
  );
});
