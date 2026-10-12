export const known = (value) =>
  typeof value === "number" && Number.isFinite(value);
export function amount(value, currency, mixed = false) {
  if (mixed) return "Mixed currencies";
  if (!known(value)) return "Not available";
  if (!currency || !/^[A-Z]{3}$/.test(currency))
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
      value,
    );
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
      value,
    );
  }
}
export const percent = (value) =>
  known(value)
    ? `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`
    : "Not available";
export function dateLabel(value, time = false) {
  if (!value) return "Not available";
  // SQLite may omit the timezone on server UTC timestamps.
  const normalized =
    value.includes("T") && !/(Z|[+-]\d\d:\d\d)$/.test(value)
      ? `${value}Z`
      : value;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf())
    ? "Not available"
    : date.toLocaleString(
        "en-IN",
        time
          ? {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }
          : { day: "numeric", month: "short", year: "numeric" },
      );
}
export const sourceLabel = (source) =>
  ({
    wallet: "Wallet snapshot",
    manual_profile: "Saved profile",
    manual_override_of_wallet: "Edited wallet profile",
  })[source] || "Saved profile";
