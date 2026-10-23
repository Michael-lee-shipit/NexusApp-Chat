export const API_URL = (() => {
  if (window.NEXUS_API_URL) return window.NEXUS_API_URL.replace(/\/$/, "");
  if (window.ZENITH_API_URL) return window.ZENITH_API_URL.replace(/\/$/, "");
  const { hostname, origin, port, protocol } = window.location;
  const localHosts = ["localhost", "127.0.0.1", "[::1]"];

  if (protocol === "file:") {
    return `http://127.0.0.1:${window.ZENITH_API_PORT || "8000"}`;
  }

  if (
    localHosts.includes(hostname) &&
    port !== (window.ZENITH_API_PORT || "8000")
  ) {
    return `${protocol}//${hostname}:${window.ZENITH_API_PORT || "8000"}`;
  }

  return origin;
})();
export const AUTH_CONNECTION_ERROR =
  "We couldn't connect to the server. Please try again in a moment.";
export async function readApiResponse(response) {
  const responseText = await response.text();
  if (!responseText) return {};

  try {
    return JSON.parse(responseText);
  } catch {
    return { detail: responseText };
  }
}

export function apiErrorMessage(data, fallback) {
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((issue) => issue.msg || String(issue)).join(" ");
  }
  return fallback;
}
