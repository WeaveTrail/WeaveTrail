const LOCAL_SITE_URL = "http://localhost:3000";

function parseSiteUrl(value: string, source: string): URL {
  const candidate = value.includes("://") ? value : `https://${value}`;
  const url = new URL(candidate);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${source} must use the http or https protocol.`);
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      `${source} must be an origin without a path, query, or hash.`,
    );
  }

  return url;
}

export function getSiteUrl(): URL {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return parseSiteUrl(process.env.VERCEL_URL, "VERCEL_URL");
  }

  if (process.env.WEAVETRAIL_SITE_URL) {
    return parseSiteUrl(process.env.WEAVETRAIL_SITE_URL, "WEAVETRAIL_SITE_URL");
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return parseSiteUrl(
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
      "VERCEL_PROJECT_PRODUCTION_URL",
    );
  }

  return new URL(LOCAL_SITE_URL);
}
