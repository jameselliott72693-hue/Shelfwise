/**
 * Bundled EIA weekly gasoline price for when the optional worker is absent
 * or offline. Series EMM_EPMR_PTE_R1Z_DPG: Lower Atlantic (PADD 1C) regular,
 * all formulations, dollars per gallon. Week of November 9, 2026, released
 * November 10, 2026. EIA does not publish a Greensboro or North Carolina
 * weekly series on this table.
 */

export const GAS_SERIES = "EMM_EPMR_PTE_R1Z_DPG";

export const GAS_FALLBACK = {
  price: 3.609,
  period: "2026-11-09",
  released: "2026-11-10",
  label: "Week of November 9, 2026",
  region: "Lower Atlantic (PADD 1C)",
  product: "Regular gasoline, all formulations",
  units: "dollars per gallon",
  sourceName: "U.S. Energy Information Administration",
  sourceUrl: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_R1Z_DPG&f=W",
  series: GAS_SERIES,
  note: "Regional weekly average for the Lower Atlantic, including North Carolina. Not a station quote and not a Greensboro price.",
};
