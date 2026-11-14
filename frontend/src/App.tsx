
import { useEffect, useState } from "react";
import EarthGlobe from "./components/EarthGlobe";
import RegionSidebar from "./components/RegionSidebar";
import type { Region } from "./types/region";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function App() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] =
    useState<Region | null>(null);

  useEffect(() => {
    async function loadRegions() {
      try {
        const response = await fetch(`${API_URL}/api/regions`);

        if (!response.ok) {
          throw new Error("Failed to load regions");
        }

        const data: Region[] = await response.json();
        setRegions(data);
      } catch (error) {
        console.error(error);
      }
    }

    void loadRegions();
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#020817]">
      <EarthGlobe
        regions={regions}
        selectedRegion={selectedRegion}
        onSelectRegion={setSelectedRegion}
      />

      <header className="absolute left-0 right-0 top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-slate-950/80 px-6 text-white backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-2xl text-sky-400">◈</span>
          <h1 className="text-xl font-bold">
            Earth<span className="text-sky-400">Pulse</span>
          </h1>
        </div>

        <nav className="flex gap-6 text-sm text-slate-300">
          <span className="text-sky-400">Explore</span>
          <span>Time Machine</span>
          <span>Analyze</span>
          <span>Forecast</span>
        </nav>
      </header>

      <RegionSidebar
        regions={regions}
        selectedRegion={selectedRegion}
        onSelectRegion={setSelectedRegion}
      />

      <div className="absolute bottom-6 right-6 z-20 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-xs text-slate-300 backdrop-blur-xl">
        EarthPulse · Interactive Earth Explorer
      </div>
    </main>
  );
}
