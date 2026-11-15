# Application readiness review

Review date: 2026-11-14. Scope: current React/Cesium frontend, FastAPI and Earth AI integration, external reference search, installed dependencies, and readiness for future SAR data. This is a targeted code review and smoke test, not a penetration test or a guarantee against unknown vulnerabilities.

## Changes made

| Finding | Resolution |
| --- | --- |
| Backend Python environment contained setuptools 65.5.0 with reported advisories | Updated the project virtual environment to 84.2.1; recorded the installed Python dependencies in a pinned lock file. |
| API could parse oversized bodies before field validation; CORS alone did not reject untrusted-origin writes | Added a 160,000-byte ASGI body cap for writes, including chunked requests; explicit origin enforcement; JSON-only chat requests. Credentialed CORS is disabled because the app does not use cookies. |
| Provider response size was unbounded | Bounded the provider response to 256 KiB and answer text to 12,000 characters; invalid responses produce a generic 502. |
| External results were trusted TypeScript casts | Validate discovery records, page identifiers, coordinates, and Wikipedia URLs. Bound result count and displayed text. Validate AI response fields and HTTPS source links; discard unexpected message metadata instead of spreading it into chat state. Source rendering also rejects unsafe URLs. |
| API regions diverged from frontend and AI regions | Load API regions from the shared exported catalogue, with finite coordinate and altitude validation. Preserve water-monitoring metadata. |
| Chat rerendered throughout timeline playback and history grew indefinitely | Memoize the chat panel, stabilize its request callback, and retain the latest 40 messages per region. |
| Globe repeatedly replaced unchanged marker colors during animation | Cache applied story opacity and skip horizon checks for hidden entities. Existing viewer, imagery, overlay, event-handler and animation cleanup remain in place. |

## Verification

- Frontend: 26 tests pass, including hostile URL schemes, credential-bearing URLs, malformed external records, spoofed Wikipedia hosts, and unexpected AI message metadata.
- Backend: 19 tests pass, including disallowed origins, JSON-only chat, declared and chunked oversized bodies, accepted chunked JSON and Unicode history, trusted-origin preflight, shared region data, oversized provider answers, and inference-slot release after failure.
- TypeScript and Vite production build pass: application JavaScript approximately 295.55 kB / 93.40 kB gzip. Cesium is copied separately by the existing Vite plugin; these figures are not the total transfer size of the globe engine or satellite tiles.
- npm audit reports zero known vulnerabilities in the audited dependency graph.
- OSV checked 21 installed Python distributions after the setuptools update and reported zero affected packages. Advisory databases change; rerun before deployment and after dependency updates.
- Python dependency consistency check passes (`python -m pip check`).
- Production-preview browser smoke test: application and globe initialize; mocked Wikipedia discovery returns a reference that can be added to the map; first story playback begins at 2020 and subsequent playback resumes at the selected 2023 position. This verifies UI state transitions, not Wikipedia uptime, satellite image accuracy, or live model output. Automated clicks used forced dispatch after scrolling because the browser's layout-stability wait timed out.
- Only the environment example is tracked; no real environment files are tracked. AI credentials remain server-side. This was not a forensic scan of all historical commits.

## Deployment requirements still outstanding

The app is suitable to continue local integration work. Public hosting requires the following work in its actual deployment environment:

1. Authenticate access to costly/private endpoints and apply per-user rate limits. The existing one-request inference semaphore is process-local and is not a user quota or distributed rate limiter. Origin validation is a browser safeguard, not access control for arbitrary clients.
2. Use HTTPS and configure the deployed frontend's exact origin. Serve the frontend and API through an explicitly configured reverse proxy; Vite preview does not proxy API traffic. Apply request size, connection/read timeout and concurrency limits at that edge as well.
3. Configure and test static-site security headers and a Cesium-compatible Content Security Policy. Its worker/blob, image and external tile requirements must be validated in the target host. API responses already add nosniff and referrer headers; chat responses are no-store.
4. Decide retention, authorization and logging rules before receiving sensitive datasets or user data. The current app has no user accounts or persistent data store.

## Before adding SAR data

- Keep observations, study-area boundaries, raster footprints and quality/confidence fields distinct. Coordinates identifying a study area do not establish a water footprint.
- Validate units, CRS, coordinate bounds, geometry size, acquisition dates, finite numeric values, region ownership, no-data semantics and source provenance at ingestion.
- Preserve unvalidated/validated status and source lineage. Do not route imported records through synthetic readings or surface textures.
- Use exact observation dates independently of annual basemap years, with explicit no-data states and gaps. Do not silently fabricate intermediate measurements.
- Prefer bounded, paginated observation endpoints and tiled raster delivery over sending entire rasters or long histories in JSON. Limit visible pins and tile caches based on measured workloads.
- Only allow explicit storage locations or trusted data hosts for server-side retrieval. Do not implement arbitrary URL downloads or file-path access based on client parameters.
- Give Earth AI only approved summaries and source references; keep model output advisory and separate from measured values.

## Repeating checks

From the frontend directory: `npm test`, `npm run build`, `npm run format:check`, and `npm audit`.

From the backend directory: `.venv/Scripts/python -m unittest discover -v` and `.venv/Scripts/python -m pip check`. Install using `requirements.lock.txt`; recheck installed distributions with an advisory scanner such as OSV before updating the reviewed lock.
