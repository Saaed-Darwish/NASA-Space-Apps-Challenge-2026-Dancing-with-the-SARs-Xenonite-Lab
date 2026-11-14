# Dancing with the SARs

A React + TypeScript + Vite + Tailwind CSS frontend and a Python FastAPI backend.

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

Open the local URL printed by Vite (usually http://localhost:5173). The current explorer loads its curated demo data locally, so you can run the frontend on its own. The backend exposes health and region endpoints for future integration.

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
- [frontend/src/globe/scene.ts](./frontend/src/globe/scene.ts): Camera destinations, region markers, and synthetic overlay geometry.
- [frontend/src/data/demo.ts](./frontend/src/data/demo.ts): Indicator definitions, curated regions, and mock readings.
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

The explorer uses the local study-area collection in [frontend/src/data/demo.ts](./frontend/src/data/demo.ts), so the visual demo does not require the backend. Alberta foothills, Thames basin, and Sacramento Valley each have a fixed camera destination and synthetic indicator readings. Select any region again, or use Refocus region, to restore its camera view after panning or zooming.

Switch between land displacement (purple to amber), water extent change (tan to blue), and wildfire impact (yellow to red). The layer toggle and opacity slider control deterministic illustrative polygon overlays. Snapshot values and trend lines are mock data for June 2026, not satellite measurements; wildfire area is distinct from the burn-severity index used for map colors. The polygon geometry is illustrative and does not trace actual water bodies or burn boundaries.

To curate another region, add its coordinates, altitude, description, and all three indicator readings to the local collection. These initial views are candidates for visual approval, not scientifically validated study areas. Base-map tiles require an internet connection; a `VITE_CESIUM_ION_TOKEN` enables Cesium imagery, otherwise the app uses OpenStreetMap.
