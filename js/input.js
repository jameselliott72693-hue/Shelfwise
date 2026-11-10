/** A trailing dot is an unfinished decimal. Refreshing the field would drop it. */
export function isPartialNumber(raw) {
  const text = String(raw ?? "").trim();
  return text === "." || /^\d+\.$/.test(text);
}

/**
 * Whether a price field should rerender from saved state.
 * "3." must stay on screen until the next digit or a blur.
 */
export function shouldRefreshPriceField(raw) {
  return !isPartialNumber(raw);
}
