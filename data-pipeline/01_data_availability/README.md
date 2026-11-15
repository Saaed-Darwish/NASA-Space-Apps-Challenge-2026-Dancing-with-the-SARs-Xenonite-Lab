# 01 — Data Availability and Feasibility Assessment

## NASA Space Apps Challenge 2026 — Dancing with the SARs

### 1. Purpose

The first stage of the data pipeline assesses whether suitable satellite observations are available for each study region before proceeding to parameter selection, validation, and final dataset extraction.

The purpose is to establish that the selected geographical areas can be monitored using consistent satellite acquisition configurations and that the resulting observations provide sufficient spatial and temporal coverage for the intended analysis.

This stage supports three research applications:

1. **Potential inundation monitoring:** Using Sentinel-1 VV radar backscatter to identify candidate water-covered areas.
2. **Forest monitoring:** Using Sentinel-1 VH radar backscatter to characterize forest conditions and, in selected regions, investigate potential forest disturbance.
3. **Ground displacement:** Integrating European Ground Motion Service (EGMS) observations for London. This follows a separate data-ingestion workflow rather than the Google Earth Engine satellite-availability process.

The availability assessment is exploratory. It does not establish that low-backscatter pixels represent flooding, that changes in forest backscatter represent deforestation, or that measured ground displacement is necessarily land subsidence.

---

## 2. Research Logic

The project adopted a progressive experimental approach.

Before generating final time-series datasets, the workflow investigated whether the underlying satellite data could support consistent monitoring.

The principal questions were:

- Are Sentinel-1 observations available for the selected geographical area and study period?
- Which polarization and acquisition geometry are appropriate for the intended indicator?
- Are observations sufficiently frequent to support temporal analysis?
- Can acquisitions be restricted to a consistent relative orbit?
- How much of the study area is covered by valid radar observations?
- Do geographical and historical masks leave sufficient eligible area for analysis?
- Are additional restrictions, such as minimum coverage or seasonal acquisition windows, necessary?

These questions informed subsequent parameter-testing and quality-control decisions.

The methodology evolved through repeated experiments. Early scripts established scene availability and preliminary indicators. Later scripts introduced orbit consistency, spatial coverage requirements, historical land-cover masks, and more explicit quality diagnostics.

Not every region underwent the same sequence of tests. The pipeline therefore distinguishes shared methodological principles from region-specific implementations.

---

## 3. Data Sources

### 3.1 Sentinel-1 Ground Range Detected Imagery

**Google Earth Engine collection:** `COPERNICUS/S1_GRD`

Sentinel-1 synthetic aperture radar (SAR) imagery formed the primary observational source for the flooding and forest-monitoring components.

The scripts used:

- Interferometric Wide Swath (IW) acquisition mode.
- VV polarization for potential inundation monitoring.
- VH polarization for forest-backscatter monitoring and disturbance screening.
- Descending acquisitions in the principal regional workflows.
- Relative-orbit filtering where specified, to reduce acquisition-geometry variation.
- Acquisition timestamps for constructing time-series observations.

VV and VH backscatter values were analyzed in decibels (dB).

SAR provides observations independently of daylight and can acquire data through cloud cover. Nevertheless, interpretation remains sensitive to acquisition geometry, surface conditions, vegetation, and local terrain.

### 3.2 JRC Global Surface Water

**Google Earth Engine dataset:** `JRC/GSW1_4/GlobalSurfaceWater`

The historical water-occurrence layer was used to distinguish candidate inundation from areas with persistent historical water occurrence.

The project investigated different occurrence thresholds, particularly 90% and 50%.

This dataset was used as a historical contextual mask rather than as direct evidence of flooding on a particular acquisition date.

### 3.3 Shuttle Radar Topography Mission

**Google Earth Engine dataset:** `USGS/SRTMGL1_003`

SRTM elevation data were used to calculate terrain slope.

Slope restrictions varied according to the monitoring objective:

- Potential inundation: generally less than 5 degrees.
- Forest backscatter monitoring in Italy and London: less than 30 degrees.

These restrictions reduced the eligible analysis area and therefore affected both coverage calculations and spatial representativeness.

### 3.4 Forest-Cover Datasets

Two forest-data approaches were used.

**Hansen Global Forest Change**

`UMD/hansen/global_forest_change_2024_v1_12`

Used for the Brazil and Vietnam forest-disturbance experiments.

The scripts selected areas with at least 60% tree cover in 2000 and applied historical forest-loss exclusions.

**ESA WorldCover**

`ESA/WorldCover/v200`

Used for Belluno and Epping Forest.

The scripts identified tree-covered pixels using WorldCover class 10 and combined that mask with a slope restriction.

These masks describe different forest populations and reference periods. They are not directly interchangeable.

### 3.5 European Ground Motion Service

The London ground-displacement component used EGMS ORTHO Level 3 observations supplied for eight monitoring points.

Unlike the Sentinel-1 VV/VH extraction scripts, this component did not require a Google Earth Engine scene-availability workflow.

Its availability assessment concerns the supplied point coverage, observation dates, completeness, and displacement metadata.

---

## 4. Study Regions and Initial Configurations

The project investigated several geographical regions and monitoring objectives.

| Country | Study region | Indicator | Main SAR polarization | Acquisition configuration |
|---|---|---|---|---|
| Brazil | Porto Velho, Madeira River | Potential inundation | VV | Descending, relative orbit 156 |
| Brazil | Porto Velho forest area | Potential forest disturbance | VH | Descending, relative orbit 156 |
| Vietnam | Can Tho, Mekong Delta | Potential inundation | VV | Initially unrestricted pass/orbit; later descending orbit 18 |
| Vietnam | Dak Lak | Potential forest disturbance | VH | Descending, relative orbit 120 |
| Vietnam | Binh Phuoc | Potential forest disturbance | VH | Descending, relative orbit 18 |
| Italy | Venice | Potential inundation | VV | Descending; most frequent relative orbit selected |
| Italy | Belluno | Forest backscatter | VH | Descending; most frequent relative orbit selected |
| United Kingdom | East London | Potential inundation | VV | Descending; most frequent relative orbit selected |
| United Kingdom | Epping Forest | Forest backscatter | VH | Descending; most frequent relative orbit selected |

The selected regions represented different environmental conditions and analytical challenges, including riverine and deltaic water systems, tropical forest environments, mountainous forest terrain, and urban landscapes.

The study-area rectangles used in the original scripts were:

| Study area | Bounding rectangle [west, south, east, north] |
|---|---|
| Porto Velho | `[-64.10, -8.95, -63.75, -8.65]` |
| Can Tho | `[105.65, 9.95, 105.90, 10.15]` |
| Dak Lak | `[108.10, 12.60, 108.40, 12.90]` |
| Binh Phuoc | `[106.70, 11.60, 107.00, 11.90]` |
| Venice | `[12.29, 45.41, 12.38, 45.47]` |
| Belluno | `[12.05, 46.15, 12.22, 46.27]` |
| East London | `[0.00, 51.48, 0.12, 51.54]` |
| Epping Forest | `[0.00, 51.60, 0.08, 51.69]` |

Coordinates are expressed in longitude and latitude degrees.

The Venice, Belluno, East London, and Epping Forest rectangles were illustrative study areas in the recovered scripts. Their use should not be interpreted as confirmation that the boundaries were independently optimized or formally validated.

---

## 5. Satellite Availability Assessment

### 5.1 Initial Image Collection Filtering

The first availability step involved constructing a Sentinel-1 image collection for each geographical region.

Typical collection filters included:

- Geographical intersection with the study area.
- Acquisition date range.
- IW instrument mode.
- Required polarization.
- Descending pass, where applicable.
- Relative-orbit number, where applicable.

The collection size was then inspected to determine how many matching observations were available.

In the earliest Brazil experiment, descending relative orbit 156 was explicitly selected.

The initial Vietnam Can Tho experiment did not restrict acquisition pass or relative orbit. This provided a broader initial collection but introduced potential acquisition-geometry differences between observations.

Later Vietnam experiments used descending relative orbit 18 for Can Tho and Binh Phuoc.

### 5.2 Relative-Orbit Selection

The Italy and London scripts introduced a more automated orbit-selection procedure.

Rather than assigning a fixed relative orbit in advance, the scripts:

1. Collected descending Sentinel-1 observations matching the study area and polarization.
2. Calculated the frequency of each available relative orbit.
3. Selected the orbit with the highest number of matching acquisitions.
4. Restricted the subsequent time series to that orbit.

This approach favored temporal observation availability while maintaining a more consistent acquisition geometry.

However, the most frequent orbit is not necessarily the orbit with the best spatial coverage, lowest noise, or greatest suitability for a particular monitoring objective.

The actual selected orbit numbers for Venice, Belluno, East London, and Epping Forest are not established by the recovered source code alone; they require the corresponding console results.

### 5.3 Temporal Availability

Most exploratory and final Sentinel-1 time-series scripts targeted observations beginning in 2019.

The regional scripts used slightly different end dates, including November 15 or November 16, 2026, as exclusive date boundaries.

Consequently, annual datasets extending into 2026 may represent incomplete calendar-year coverage.

The Belluno and Epping Forest analyses were additionally restricted to May–October acquisitions.

This seasonal selection reduced seasonal heterogeneity but also restricted the observations available for analysis.

A calendar year with no usable observations should not automatically be interpreted as a year without flooding or forest disturbance.

---

## 6. Spatial Coverage Assessment

### 6.1 Why Coverage Matters

A Sentinel-1 acquisition may intersect a study area without providing valid measurements across its entire extent.

Spatial coverage can be affected by acquisition footprints, image masks, geographical boundaries, and the eligibility masks applied during processing.

This creates an important distinction between:

- **Available acquisitions:** Images matching the initial collection filters.
- **Usable acquisitions:** Images meeting the subsequent coverage and validity criteria.

The project increasingly emphasized this distinction as the experiments progressed.

### 6.2 General Coverage Calculation

Coverage was generally calculated as:

\[
\text{Coverage fraction} =
\frac{\text{Area with valid observations}}
{\text{Eligible analysis area}}
\]

The numerator and denominator were calculated using pixel-area reductions in Google Earth Engine.

The definition of eligible area depended on the workflow.

For example, the Venice and East London potential-inundation scripts calculated coverage relative to the eligible nonpersistent-water, low-slope area rather than the entire rectangular AOI.

Forest workflows calculated coverage relative to the selected forest analysis mask.

Consequently, coverage fractions from different workflows should not be assumed to describe identical geographical populations.

### 6.3 Coverage Thresholds Tested

Different experiments applied different coverage requirements.

| Experiment | Coverage rule |
|---|---|
| Initial Brazil flooding exploration | No explicit minimum coverage |
| Initial Vietnam Can Tho flooding exploration | At least 95% of AOI |
| Brazil and Vietnam candidate inundation | At least 95% of AOI |
| Brazil forest disturbance extraction | Coverage sufficiency flag at 95% |
| Brazil and Vietnam forest threshold validation | Minimum 95% coverage enforced for qualifying scenes |
| Venice potential inundation | At least 95% of eligible area |
| Belluno initial forest backscatter | At least 90% |
| Belluno revised forest backscatter | At least 50% |
| Belluno final exploratory revision | No numerical minimum coverage |
| East London potential inundation | Coverage greater than zero |
| Epping Forest backscatter | No numerical minimum coverage |

These differences are part of the research history and should not be replaced with a single universal threshold.

The Belluno experiments are particularly useful as a coverage-sensitivity sequence because they explicitly changed the minimum requirement from 90% to 50%, and then removed it.

The recovered scripts do not provide the numerical observation counts needed to determine how many additional acquisitions were retained at each threshold.

### 6.4 Coverage Versus Comparability

Relaxing a coverage requirement can increase the number of usable dates.

However, a larger number of observations does not necessarily mean that the resulting time series is more comparable.

If different acquisitions cover different subsets of a forest or urban area, apparent temporal changes may partly reflect changing spatial composition.

Therefore, coverage fractions should remain available as quality metadata even when no minimum threshold is enforced.

---

## 7. Availability Testing by Research Application

### 7.1 Potential Inundation

The flooding availability workflow focused on whether sufficient Sentinel-1 VV observations were available for monitoring candidate low-backscatter areas.

Early experiments combined scene filtering with a provisional threshold of −17 dB.

Subsequent experiments incorporated:

- Consistent relative-orbit selection.
- Historical surface-water exclusions.
- Terrain-slope restrictions.
- Valid observation masks.
- Minimum coverage criteria.
- Acquisition-level area calculations.

These procedures established the observations available for further analysis.

They did not independently confirm flooding events.

### 7.2 Forest Disturbance and Backscatter

The Brazil and Vietnam forest-disturbance workflows required both current Sentinel-1 VH observations and suitable historical observations for constructing a reference baseline.

The baseline was calculated from acquisitions approximately one year before each current observation, using a window from 410 to 320 days earlier.

The scripts assessed whether at least three baseline observations were available.

This is a more demanding feasibility requirement than simply confirming that a current Sentinel-1 acquisition exists.

In the forest validation experiments, insufficient baseline availability could prevent a scene from qualifying for the annual detection analysis.

In the final Brazil and Vietnam extraction scripts, baseline sufficiency and coverage sufficiency were recorded as quality flags, but all acquisition-level records were retained.

The Belluno and Epping Forest workflows used a different approach.

They extracted seasonal mean VH backscatter and spatial standard deviation within fixed forest masks, without constructing historical VH-change baselines or classifying individual forest-disturbance events.

### 7.3 London Ground Displacement

The EGMS data-integration workflow concerned eight monitoring points and their supplied vertical-displacement time series.

The previously documented dataset contained 302 observations per point, for 2,416 observations in total, covering December 15, 2020, through November 25, 2025.

These figures describe the recovered workbook history; they should be checked against the retained source data before being treated as independently verified.

No original Google Earth Engine script was associated with this integration task.

---

## 8. Console Testing and Diagnostic Checks

The original scripts used Google Earth Engine console output to inspect data availability and the effects of filtering.

Recovered checks included:

| Diagnostic | Purpose |
|---|---|
| Initial image count | Confirm matching Sentinel-1 acquisitions exist |
| Relative-orbit histogram | Identify available acquisition geometries |
| Selected relative orbit | Record the orbit used for the time series |
| Post-orbit image count | Measure the impact of orbit filtering |
| Eligible analysis area | Establish the geographical coverage denominator |
| Usable observation count | Identify records meeting validity or coverage criteria |
| First five or ten observations | Inspect extracted fields and initial records |
| Time-series chart | Visually examine temporal distribution and indicator behavior |
| Forest baseline image count | Check availability of historical comparison observations |
| Forest coverage sufficiency | Assess spatial validity within the monitored forest cohort |

Some diagnostic code and historical console outputs were not retained.

The checks listed here are supported by the recovered script analyses, but their numerical results are not available in the present documentation.

Missing historical checks may be recreated in a separate testing suite. Any new execution should be recorded with its actual run date and outputs rather than represented as an original hackathon console result.

---

## 9. Key Methodological Decisions

### Decision 1: Use Sentinel-1 SAR as the primary observation source

Sentinel-1 was selected for its suitability for repeated radar observations across regions where cloud cover or changing illumination can limit optical monitoring.

**Implication:** Radar backscatter provides useful environmental indicators, but it requires careful interpretation and contextual filtering.

### Decision 2: Favor consistent acquisition geometry

Fixed or automatically selected relative orbits were used in later experiments to reduce variation caused by differing observation geometries.

**Implication:** Orbit consistency improves methodological control but can reduce temporal observation availability.

### Decision 3: Separate raw availability from usable observations

The pipeline evolved from counting matching scenes to calculating spatial validity and coverage fractions.

**Implication:** A large image collection is not sufficient evidence that a reliable regional time series can be constructed.

### Decision 4: Use application-specific eligibility masks

Flooding and forest monitoring required different geographical masks.

**Implication:** Coverage must be interpreted relative to the exact eligible analysis area used in each experiment.

### Decision 5: Investigate the sensitivity of coverage thresholds

The Belluno sequence explicitly examined alternative minimum-coverage rules.

**Implication:** More permissive thresholds may increase temporal availability while reducing spatial comparability.

### Decision 6: Preserve quality indicators in final datasets

The final Brazil and Vietnam forest extraction scripts retained baseline and coverage sufficiency indicators.

**Implication:** Downstream analyses can distinguish higher-quality observations without losing the original acquisition records.

---

## 10. Limitations and Unresolved Questions

The availability assessment has several limitations.

**Incomplete console evidence.** The recovered scripts establish which checks were programmed, but not all numerical outputs or execution histories have been preserved.

**Different acquisition configurations.** Fixed-orbit and most-frequent-orbit strategies were both used. These methods are related but not identical.

**Changing coverage requirements.** Regional datasets were generated under different coverage thresholds, which may affect cross-region comparability.

**Incomplete 2026 calendar-year coverage.** Some scripts ended in mid-November 2026, excluding later acquisitions.

**Historical land-cover assumptions.** Fixed historical forest and water masks may not reflect land-cover conditions at every observation date.

**No universal minimum observation count.** The scripts assessed availability and quality using several methods, but a single minimum number of observations was not established for all regions.

**No independent confirmation of all exports.** Export commands in the source code do not establish that the corresponding Google Drive tasks completed successfully.

These limitations should be retained when interpreting the final datasets.

---

## 11. Outputs of This Stage

The intended outputs of the data-availability stage are:

1. A documented study-area configuration for each region.
2. The selected Sentinel-1 polarization and acquisition geometry.
3. The temporal window and any seasonal restrictions.
4. The initial and usable observation counts, where execution evidence exists.
5. A definition of the eligible analysis area.
6. A coverage metric and any applied minimum threshold.
7. A record of unresolved data gaps or availability constraints.

The historical experiments provide the methodological basis for these outputs.

Where numerical results are missing, the pipeline records the relevant check without inventing a value.

---

## 12. Relationship to Subsequent Pipeline Stages

Data availability establishes whether an environmental indicator can be extracted from the selected observations.

It does not determine whether the indicator is scientifically accurate.

The next stage, **02 — Parameter Testing**, examines the choices used to transform available observations into candidate environmental measurements.

These include:

- VV backscatter thresholds for potential inundation.
- JRC historical-water occurrence thresholds.
- VH-change thresholds for potential forest disturbance.
- Historical forest eligibility criteria.
- Coverage and detection requirements.
- The implications of changing these parameters across regions and years.

Subsequent validation, anomaly investigation, and quality-control stages assess the reliability and interpretation of those choices.

---

## 13. Reproducibility Requirements

To reproduce this stage, a researcher should:

1. Define the original study-area geometry and date range.
2. Load the specified Earth Engine datasets.
3. Apply the documented acquisition and polarization filters.
4. Record the initial image count and available relative orbits.
5. Apply the selected orbit strategy.
6. Construct the relevant geographical eligibility mask.
7. Calculate valid observation area and coverage fraction.
8. Apply the specified coverage requirement, if any.
9. Inspect the resulting observation collection and export schema.
10. Save console outputs and execution metadata.

A reproducible execution record should include the date of execution, Earth Engine script version, configuration, console results, and any resulting export files.

Where historical code is available, it should be preserved without modification before preparing updated production versions.

---

## 14. Research Summary

The data-availability stage established the foundation for a multi-region SAR monitoring workflow.

The experiments progressed from basic Sentinel-1 scene discovery to more systematic assessment of orbit consistency, eligible geographical area, spatial coverage, baseline availability, and observation-quality requirements.

A central methodological lesson was that **satellite availability and analytical usability are different concepts**.

This distinction influenced the subsequent threshold tests, validation experiments, anomaly investigations, and final extraction workflows.

The resulting pipeline is designed to preserve that experimental reasoning while making the process easier to reproduce, evaluate, and extend.

**Next stage:** `02_parameter_testing/README.md`


