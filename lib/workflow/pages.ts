const CANONICAL_PAGES = [
  "GitHub Connected",
  "GitHub Authorization",
  "GitHub Integration",
  "API Keys",
  "Integrations",
  "Settings",
  "Dashboard",
  "Loading",
] as const;

export type CanonicalPage = (typeof CANONICAL_PAGES)[number];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function canonicalizePage(page: string | null | undefined): CanonicalPage | null {
  if (!page?.trim()) return null;
  const normalized = normalize(page);

  if (/\bapi keys?\b/.test(normalized)) return "API Keys";
  if (/\bloading\b|\bskeleton\b/.test(normalized)) return "Loading";
  if (/\bgithub\b/.test(normalized) && /\bconnected\b/.test(normalized)) {
    return "GitHub Connected";
  }
  if (/\bconnected\b/.test(normalized) && /\bgithub\b/.test(normalized)) {
    return "GitHub Connected";
  }
  if (normalized === "github connected") return "GitHub Connected";
  if (/\bauthoriz/.test(normalized)) return "GitHub Authorization";
  if (/\bgithub\b/.test(normalized)) return "GitHub Integration";
  if (/\bintegrations?\b/.test(normalized)) return "Integrations";
  if (/\bsettings?\b/.test(normalized)) return "Settings";
  if (/\bdashboard\b|\bhome\b/.test(normalized)) return "Dashboard";

  for (const name of CANONICAL_PAGES) {
    if (normalized === normalize(name)) return name;
  }

  return null;
}

export function isKnownPage(page: string | null | undefined): boolean {
  return canonicalizePage(page) !== null;
}
