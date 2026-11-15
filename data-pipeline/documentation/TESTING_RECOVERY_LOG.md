# Missing console testing — recovery log

Use this document to separate historical evidence from new diagnostic proposals.

| ID | Region | Test | Historical evidence | Next action | Status |
|---|---|---|---|---|---|
| REC-001 | All | Initial scene and orbit availability | Prints appear in multiple recovered scripts | Save outputs if available | Source only |
| REC-002 | Brazil | JRC mask missing-data comparison | Task 09 source recovered | Recover CSV / console values | Source only |
| REC-003 | Brazil | S1/S2 agreement and coverage | Tasks 07–10 source recovered | Recover exported comparisons | Source only |
| REC-004 | Brazil/Vietnam | VH threshold validation | Tasks 15–16 and 18–20 source recovered | Recover precision/recall/IoU CSVs | Source only |
| REC-005 | Belluno | 90% vs 50% vs unrestricted coverage | Tasks 23–25 source recovered | Compare actual counts and VH trends | Source only |
| REC-006 | London | EGMS input integration | User-supplied 8-point data | Verify workbook and original inputs | Workbook not inspected |

New checks should receive a `NEW-QC-*` ID and execution date. Never label reconstructed code as an original 2026 console snippet.
