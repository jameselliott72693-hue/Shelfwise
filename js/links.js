/** Only https links on instacart.com may be opened from a worker response. */
export function instacartLinkUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    if (host !== "instacart.com" && !host.endsWith(".instacart.com")) return "";
    if (url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}
