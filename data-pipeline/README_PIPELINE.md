# Dancing with the SARs — Reproducible Data Pipeline

This is a **supplemental README**. Keep the existing `data-pipeline/README.md` intact and link to this file.

## Workflow

1. **Availability:** identify valid Sentinel-1 observations, dates, polarizations, orbit counts, and eligible spatial coverage.
2. **Parameter testing:** compare VV/VH thresholds, JRC occurrence masks, historical forest cohorts, and coverage requirements.
3. **Validation:** compare candidate detections with provisional optical or Hansen reference datasets; record precision, recall, and IoU where available.
4. **Anomaly investigation:** diagnose unexpected coverage, missing masks, outliers, and export issues.
5. **Quality control:** document whether checks were enforced or merely exported as flags.
6. **Final extraction:** export reproducible per-acquisition CSVs with units, parameters, and metadata.
7. **Integration:** consolidate regional exports and EGMS vertical displacement data with explicit provenance.

## Reproducibility

- Store **original** GEE JavaScript in `archive/original_gee_scripts/`, without modifying it.
- Put any cleaned scripts or new diagnostics in the numbered stage folders; label them **reconstructed** or **new**, never as original historical code.
- Record Earth Engine collection IDs, AOIs, dates (including exclusive end dates), orbit selection, filters, reduction scales, and export selectors.
- Save console screenshots or copied outputs in `results/console_logs/`; a scripted `print()` is not proof of an observed result.
- Document export status independently: configured, task submitted, task completed, file inspected.
- Use `documentation/experiment_registry.csv` to connect experiments with their evidence.
- Do not describe candidate inundation as confirmed flooding or VH changes as independently verified forest disturbance.

## Evidence statuses

`source_recovered`: code was supplied. `execution_unverified`: outputs/logs not inspected. `reconstructed`: newly authored reproduction of a missing check. `verified`: supported by inspected execution evidence. These may be combined in explanatory notes.

## Coverage caveat

The final Belluno and Epping Forest backscatter scripts accept any non-null mean VH, regardless of coverage. East London flooding accepts any coverage fraction >0. Compare results with coverage fractions, not area alone.

## Original scripts

The folder archive includes an index, not copies of all 27 scripts. Populate it from your saved Google Earth Engine scripts or chat exports. The summaries here are **documentation**, not substitute source code.
