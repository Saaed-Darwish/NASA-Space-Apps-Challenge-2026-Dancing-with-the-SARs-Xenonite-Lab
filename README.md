# Dancing with the SARs

A React + TypeScript + Vite + Tailwind CSS frontend and a Python FastAPI backend.

## Water monitoring update

The frontend now supports water overlays only. Porto Alegre and Rio Grande do Sul
(Brazil), plus Can Tho and the Mekong Delta (Vietnam), are prioritized study areas.
Their flood data is being processed by the backend team. Until a flood-data endpoint
is connected, these areas show a processing state with no invented footprints or
measurements. Water controls are reserved for these four regions; the remaining
curated views use a story and camera sidebar, including Lake Manchar.

Every curated view has two sourced stories. Transient events have an editorial map
window with smooth fades on the annual timeline: Lake Manchar's flood appears near
2022 and is hidden by 2023. Hidden markers remain accessible through their story
cards and source links. These windows do not establish measured recovery dates.

Globe markers use fixed ellipsoid anchors with horizon visibility checks. Camera
zoom and panning update the focused study area without initiating another camera
flight. City and regional focus have separate entry and exit bounds to avoid flicker.
Run `npm test` from [frontend/](./frontend) to check focus transitions and data scope
(Node.js 22.18+).

## Requirements

- Node.js 22 LTS or newer
- Python 3.10 or newer

## Run locally

Open two terminals at the project root.

### Backend (PowerShell)

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
backend/.venv/Scripts/python -m uvicorn main:app --app-dir backend --reload
```

The API runs at http://127.0.0.1:8000. Interactive API documentation is at http://127.0.0.1:8000/docs.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173). The explorer loads curated map data locally. Earth AI requires the backend and a running model. Vite proxies `/api` requests to http://127.0.0.1:8000.

### Local Earth AI (Ollama)

Install [Ollama for Windows](https://ollama.com/download/windows), then download the development model:

```powershell
ollama pull ministral-3:3b
```

Ollama's Windows app serves the model locally on port 11434. If it is not running,
start the app or run `ollama serve`. The default backend configuration uses
`http://127.0.0.1:11434/v1` and `ministral-3:3b`. Copy
[backend/.env.example](./backend/.env.example) to `backend/.env` to override them;
restart the backend after changing configuration. The backend loads this file automatically.
The first response can take longer while the model loads. CPU inference is slower than GPU inference.

Earth AI sends the region ID, story ID, selected years, question and up to eight
recent conversation turns to `POST /api/chat`. The backend resolves region and
story facts from [earth_context.json](./backend/data/earth_context.json), supplies
source IDs to the model, and returns links only for supplied sources cited in the
answer. It never sends illustrative readings as measured water data. Water data
currently has `processing` or `not_configured` status; forecast outputs are absent.
When validated measurements arrive, integrate them in `build_context` in
[assistant.py](./backend/assistant.py), including units, dates, provenance and uncertainty.

After editing curated regions or stories, regenerate the tracked backend catalogue:

```powershell
cd frontend
npm run export:ai-context
```

Restart the backend to load the updated catalogue. No embeddings or training step is needed.
Chat history lives in browser memory until reload. This integration does not persist
questions or answers on the backend. Local configuration sends inference requests
to your own Ollama instance; source links are not automatically fetched by the model.

For deployment, set `AI_BASE_URL`, `AI_MODEL` and server-only `AI_API_KEY` to a hosted
provider supporting `/v1/chat/completions`; the frontend does not change. The base URL
must include `/v1` where required by the provider. Configure `CORS_ORIGINS` if the browser
calls FastAPI directly. Production hosting must route `/api` to FastAPI. Before public
deployment, add authentication and per-user rate limits; the development backend
allows one in-flight model request and rejects concurrent requests with HTTP 429.
Model answers can still be wrong: citations identify supplied evidence, not automatic verification.

Backend checks:

```powershell
cd backend
.venv/Scripts/python -m unittest test_assistant -v
```

## Production build

```powershell
cd frontend
npm run build
```

The generated frontend is in `frontend/dist`. For deployment, serve those static files and route `/api` to the FastAPI service through your hosting platform or reverse proxy. Vite's development proxy does not apply to production or `vite preview`.

## Project layout

- [frontend/](./frontend): React app and Vite/Tailwind configuration.
- [frontend/src/App.tsx](./frontend/src/App.tsx): Shared selection and layer state, plus the main page layout.
- [frontend/src/components/](./frontend/src/components): Globe, region sidebar, layer controls, regional snapshot, and map caption.
- [frontend/src/globe/scene.ts](./frontend/src/globe/scene.ts): Camera destinations and region markers.
- [frontend/src/globe/surface.ts](./frontend/src/globe/surface.ts): Continuous synthetic change fields and cached raster textures.
- [frontend/src/globe/historicalImagery.ts](./frontend/src/globe/historicalImagery.ts): Dated EOX satellite tile providers and basemap crossfading.
- [frontend/src/globe/overlays.ts](./frontend/src/globe/overlays.ts): Independently visible raster overlay collections and opacity blending.
- [frontend/src/data/imagery.ts](./frontend/src/data/imagery.ts): Verified archive years; update only after checking the provider's availability.
- [frontend/src/hooks/useTimeline.ts](./frontend/src/hooks/useTimeline.ts): Year selection, playback range, and animation timing.
- [frontend/src/data/demo.ts](./frontend/src/data/demo.ts): Indicator definitions, curated regions, and mock readings.
- [frontend/src/data/stories.ts](./frontend/src/data/stories.ts): Sourced construction and wildfire stories, approximate marker locations, and suggested comparison years.
- [frontend/src/data/assistant.ts](./frontend/src/data/assistant.ts): Frontend-only guided assistant adapter and conversation types.
- [frontend/src/globe/storyMarkers.ts](./frontend/src/globe/storyMarkers.ts): Clickable story symbols and year/region visibility rules.
- [frontend/src/index.css](./frontend/src/index.css): Styles grouped by interface area, followed by responsive layouts.
- [backend/main.py](./backend/main.py): FastAPI application and health endpoint.
- [backend/requirements.txt](./backend/requirements.txt): Python dependencies.

## Code formatting

Run these commands from the frontend directory:

```powershell
npm run format       # Format frontend source and configuration.
npm run format:check # Check formatting without changing files.
npm run build        # Check TypeScript and build the production app.
```

React components handle the interface, while the globe scene helpers contain Cesium-specific drawing and camera logic. Demo trend arrays contain SVG coordinates; they do not represent measured displacement or severity values. The API keeps its existing `zoom_level` field name so its response shape remains stable.

## Curated surface-change demo

The explorer uses the local study-area collection in [frontend/src/data/demo.ts](./frontend/src/data/demo.ts), so the visual demo does not require the backend. Nusantara, Egypt's New Administrative Capital, Tuas Port, Alberta foothills, Thames basin, and Sacramento Valley each have a fixed camera destination and synthetic indicator readings. Nusantara opens first as the construction showcase. Select any region again, or use Refocus region, to restore its camera view after panning or zooming.

For construction comparisons, turn off the three simulated overlays and play 2020–2025. Nusantara's government core highlights roads and buildings emerging after 2022; Egypt's new capital shows road grids filling with districts; Tuas Port shows reclaimed coastline and industrial infrastructure. The indicator readings at these locations are mock fixtures, not measurements of construction impacts.

Land displacement (purple to amber), water extent change (tan to blue), and wildfire impact (yellow to red) each have their own visibility switch. All three can be displayed together. The tabs select details and each layer's own opacity; changing a detail tab does not toggle any layer. Turn off all three switches to inspect the satellite imagery by itself.

Smooth raster fields highlight simulated changes with transparent edges. Unchanged areas remain clear, and 2020 is the reference year. Patterns suggest ground movement, channel expansion, and wildfire scars; they do not trace measured terrain, actual water bodies, or burn boundaries. Snapshot values are synthetic estimates for the selected year, independent of the illustrative trend chart and color field. Wildfire area is distinct from the burn-severity index used for map colors.

The timeline runs from 2020 to 2025, the latest verified year in the public archive. The current calendar year is shown separately; a 2026 mosaic is not substituted or invented. Click a year bookmark, scrub between years, or select a From/To playback range. Play advances at approximately 4.5 seconds per year and stops at the selected end year; playing from the end restarts at the beginning. Pausing preserves the blend position, while selecting a year stops playback. Camera movement remains independent of playback.

The globe now displays real [EOX Sentinel-2 cloudless annual mosaics](https://maps.eox.at/), streamed directly from the public WMTS service. Selecting 2020 uses the 2020 satellite tiles; selecting 2025 uses the 2025 tiles. These approximately 10-metre mosaics can reveal larger developments and land-use changes, but are composites rather than photos from one date, and cannot reliably resolve individual building modifications. Differences in season, atmosphere, and mosaic processing also affect their appearance; the app does not classify urban growth or measure it from these images.

Basemap years use persistent tiled imagery layers. Simulated overlays use decoded, static PNG imagery layers rather than coplanar rectangles with animated entity materials. Playback changes layer opacity, keeping the earlier basemap opaque beneath the incoming year. Cesium renders continuously while playing so texture uploads finish without a camera movement, and returns to on-demand rendering when paused. Overlay layers are disposed when changing regions, and asynchronous image loads cannot attach to a destroyed viewer.

EOX's 2018–2025 public imagery is licensed under [CC BY-NC-SA 4.0 for non-commercial use](https://cloudless.eox.at/license-non-commercial). Required EOX and Copernicus attribution is displayed on the globe. Commercial deployment requires an appropriate imagery license or another provider. The public service is supplied without availability guarantees; imagery loading and errors are displayed in the map status.

To curate another region, add its coordinates, altitude, description, and all three indicator readings to the local collection. These initial views are candidates for visual approval, not scientifically validated study areas. Satellite tiles require an internet connection; no Cesium ion token or backend is needed for the public EOX archive.

## Analyze, stories, and Earth AI

Analyze combines camera views, year comparisons, sourced stories, and applicable water controls. Earth AI shares the selected region, camera, and timeline. The frontend works without a running backend, with two sourced stories for each of the eleven curated views.

Use **Stories & evidence** to open Analyze, or click a story symbol on the globe. Story markers are hidden in the global overview and appear only within the focused region and their configured time window. Region and story labels use 50%-transparent black backgrounds with white text. Their approximate locations do not represent damage footprints. Source cards identify retrospective material published after the selected map year.

Selecting a story configures its comparison range. **Play** starts a focused story from the earliest bookmarked year; Analyze's **Before** and **After** buttons jump to the comparison endpoints. The LNU story explicitly notes that the 2020 annual mosaic is not a guaranteed pre-fire image.

**Forecast** appears only for Porto Alegre, Rio Grande do Sul, Can Tho, and the Mekong Delta. It currently shows the time-series model's development state and pending input/output availability; there is no forecast endpoint or invented prediction series. Switching to another region or the global overview returns to Analyze. The map timeline remains a historical imagery control.

**Earth AI connects to a model through the backend.** Local development uses Ollama and Ministral 3 3B. Suggested prompts and typed questions include region, story and timeline context; unavailable water data is explicitly marked. Conversations remain separate for each region during the page session. A page reload resets them. Connection failures are shown explicitly, without substituting demo answers.

### Data handoff

Lake Manchar, Pakistan, has sourced stories about the 2022 flooding and a suggested 2021–2023 comparison. Annual mosaics may omit the flood peak; this curated view does not display water measurements.

**Discover more** searches live Wikipedia reference articles for the selected study area and an optional topic. Only articles with published Earth coordinates can be added as blue map pins. These coordinates identify the article subject, not a verified event location or boundary; search results are not timeline-filtered. Discovered pins remain separate from curated stories, persist across region changes until reload, and can be refocused, opened, or removed. Search has cancellation, a timeout, empty and error states. A separate external news-search link opens broader web results; it does not automatically ingest news or infer incident coordinates. No backend or API keys are used. Wikipedia extracts are attributed under CC BY-SA.

- Replace the fixtures in [demo.ts](./frontend/src/data/demo.ts) and the mock interpolation in [history.ts](./frontend/src/data/history.ts) with the team's validated measurements. Analyze and the demo assistant use these same adapters.
- Add or update `RegionStory` records in [stories.ts](./frontend/src/data/stories.ts) to provide event dates, location, comparison years, sources, and interpretation. Link measured event boundaries separately from the editorial locators.
- Replace synthetic surface textures through [overlays.ts](./frontend/src/globe/overlays.ts) when dated land/water/fire rasters are available. Visibility and per-layer opacity are already independent.
- [earthAI.ts](./frontend/src/data/earthAI.ts) calls the backend model integration. Provider configuration and credentials stay on the backend. [assistant.ts](./frontend/src/data/assistant.ts) retains shared conversation types and the unused legacy demo adapter.
