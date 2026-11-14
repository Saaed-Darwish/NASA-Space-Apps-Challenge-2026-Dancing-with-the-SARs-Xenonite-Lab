
import type { Region } from "../types/region";

interface Props {
  regions: Region[];
  selectedRegion: Region | null;
  onSelectRegion: (region: Region | null) => void;
}

export default function RegionSidebar({
  regions,
  selectedRegion,
  onSelectRegion,
}: Props) {
  return (
    <aside className="absolute left-5 top-20 z-20 w-80 rounded-2xl border border-white/10 bg-slate-950/90 p-5 text-white shadow-2xl backdrop-blur-xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
          Earth Explorer
        </p>
        <h2 className="mt-2 text-2xl font-semibold">
          Explore our planet
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Select a region to explore Earth's surface.
        </p>
      </div>

      <div className="space-y-3">
        {regions.map((region) => (
          <button
            key={region.id}
            onClick={() => onSelectRegion(region)}
            className={`w-full rounded-xl border p-4 text-left transition hover:border-sky-400 ${
              selectedRegion?.id === region.id
                ? "border-sky-500 bg-sky-500/15"
                : "border-white/10 bg-white/5"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sky-400">●</span>
              <span className="font-medium">
                {region.name}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-400">
              {region.country}
            </p>
          </button>
        ))}
      </div>

      {selectedRegion && (
        <div className="mt-6 border-t border-white/10 pt-5">
          <h3 className="font-semibold">
            {selectedRegion.name}
          </h3>

          <p className="mt-2 text-sm text-slate-400">
            {selectedRegion.description}
          </p>

          <div className="mt-4 rounded-lg bg-white/5 p-3 text-xs text-slate-300">
            <p>
              Latitude: {selectedRegion.latitude.toFixed(4)}°
            </p>
            <p>
              Longitude: {selectedRegion.longitude.toFixed(4)}°
            </p>
          </div>

          <p className="mt-4 text-xs text-sky-400">
            NASA observation layers coming soon
          </p>
        </div>
      )}

      <button
        onClick={() => onSelectRegion(null)}
        className="mt-5 w-full rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10"
      >
        Clear selection
      </button>
    </aside>
  );
}
