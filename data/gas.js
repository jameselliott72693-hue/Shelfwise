/**
 * Default fuel price for the drive estimate.
 * EIA weekly retail price for regular gasoline, all formulations,
 * Lower Atlantic (PADD 1C), including taxes.
 * Week of November 9, 2026. Released November 10, 2026.
 * Source: https://www.eia.gov/petroleum/gasdiesel/
 * Series: Weekly Lower Atlantic (PADD 1C) Regular All Formulations
 * Retail Gasoline Prices (EMM_EPMR_PTE_R1Z_DPG).
 */

export const GAS_PRICE = 3.609;
export const GAS_AS_OF = "2026-11-09";
export const GAS_AS_OF_LABEL = "November 9, 2026";
export const GAS_REGION = "Lower Atlantic (PADD 1C)";
export const GAS_SOURCE = "https://www.eia.gov/petroleum/gasdiesel/";
export const DEFAULT_MPG = 26;
export const DEFAULT_PER_MILE = Math.round((GAS_PRICE / DEFAULT_MPG) * 1000) / 1000;
