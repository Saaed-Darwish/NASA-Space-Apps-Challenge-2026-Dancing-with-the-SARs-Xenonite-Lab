/** Years verified against EOX's public WMTS capabilities. */
export const FIRST_YEAR = 2020;
export const LAST_IMAGERY_YEAR = 2025;
export const CURRENT_YEAR = new Date().getFullYear();
export const YEARS = Array.from(
  { length: LAST_IMAGERY_YEAR - FIRST_YEAR + 1 },
  (_, index) => FIRST_YEAR + index,
);
