# How to merge this package into your GitHub repository

1. Download and unzip the package.
2. Open the extracted `data-pipeline/` directory.
3. Copy its **contents** into the existing repository's `data-pipeline/` directory, merging folders.
4. Do **not** replace your existing `data-pipeline/README.md`; this package uses `README_PIPELINE.md` instead.
5. Add your original GEE scripts to `archive/original_gee_scripts/` and link them from `documentation/experiment_registry.csv`.
6. Add actual console outputs/CSVs as they are recovered; keep unverified results marked unverified.
7. Review changed files with `git status`, then commit and push.

This package is a scaffold and documented experiment inventory. It does not claim to contain the original 27 GEE scripts, actual numerical results, or the EGMS workbook.
