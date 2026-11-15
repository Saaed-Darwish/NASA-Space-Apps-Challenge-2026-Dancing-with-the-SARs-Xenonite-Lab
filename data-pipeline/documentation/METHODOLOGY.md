# Methodology and scientific constraints

## Sentinel-1 inundation

Candidate inundation is derived from VV backscatter below **−17 dB**, typically excluding JRC Global Surface Water occurrence >=90% and slopes >=5°. Earlier Brazil/Vietnam scripts also tested JRC occurrence <50% and used focal-median smoothing. Later Venice/London scripts do **not** smooth VV. Missing JRC values unmasked to zero must not be interpreted as known dry land. Urban radar geometry can confound detection.

## Forest disturbance and forest backscatter

Brazil/Vietnam disturbance experiments use Hansen Global Forest Change and Sentinel-1 VH differences relative to a previous-year seasonal baseline (−410 to −320 days). Candidate thresholds tested: −2, −3, −4 dB, with connected-pixel and repeated-detection requirements in validation scripts. Annual extraction scripts use −3 dB (Brazil) and −4 dB (Vietnam); **no recovered numerical evidence establishes either as optimal**.

Belluno and Epping Forest scripts use fixed ESA WorldCover 2021 tree-cover masks, slope <30°, and May–October VH means/stdDev. They do **not** classify disturbance or validate forest loss.

## Reference comparisons

Sentinel-2 MNDWI water masks are provisional optical references, not field truth; paired dates may differ. Hansen annual loss is an independent mapped reference, not direct field validation. Record evaluation footprint and coverage, and avoid comparing incompatible denominators.

## London ground displacement

Task 28 is workbook organization of user-supplied EGMS ORTHO Level 3 vertical-displacement observations for eight London monitoring points. **No original GEE or Python script existed for Task 28.** Displacement is not automatically confirmed subsidence; preserve units, sign convention, reference frame, and quality metadata.

## Period limitations

Some 2026 annual datasets are partial due to an exclusive November 2026 end date. May–October seasonal Belluno/Epping analyses may include the complete specified seasonal window, subject to image availability.
