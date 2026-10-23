const fs = require("node:fs");
const path = require("node:path");

const frontend = path.join(__dirname, "Zenith chatt", "frontend");
const appPath = path.join(frontend, "app.js");
const source = fs.readFileSync(appPath, "utf8").replace(/\r\n/g, "\n");
const find = (marker, from = 0) => {
  const index = source.indexOf(marker, from);
  if (index < 0) throw new Error(`Missing source marker: ${marker}`);
  return index;
};
const deindent = (text) =>
  text
    .split("\n")
    .map((line) => (line.startsWith("  ") ? line.slice(2) : line))
    .join("\n");

const apiBoundary = find("let ws = null;");
const storageStart = find("const CHAT_CACHE_PREFIX =");
const emojiStart = find("const EMOJI_CATEGORIES = {");
const voiceStart = find("const VOICE_NOTE_MIME_TYPES =");
const apiHelpersStart = find("async function readApiResponse(response) {");
const domStartMarker = 'document.addEventListener("DOMContentLoaded", () => {\n';
const domStart = find(domStartMarker);
const dashboardMarker = "  // 3. Main Dashboard (`index.html`)\n";
const dashboardStart = find(dashboardMarker, domStart);
const settingsMarker = "  // 4. Settings Page (`settings.html`)\n";
const settingsStart = find(settingsMarker, dashboardStart);
const domCloseMarker = "\n});\n\nasync function loadRooms() {";
const domClose = find(domCloseMarker, settingsStart);
const loadRoomsStart = domClose + "\n});\n\n".length;

const apiConfig = source.slice(0, apiBoundary);
const storage = source
  .slice(storageStart, emojiStart)
  .replace(
    /^function (getCurrentUserKey|activeRoomStorageKey|roomListCacheKey|roomPreviewCacheKey|roomMessagesCacheKey|readJsonStorage|writeJsonStorage)\(/gm,
    "export function $1(",
  );
const emoji = source
  .slice(emojiStart, voiceStart)
  .replace(/^const EMOJI_CATEGORIES =/m, "export const EMOJI_CATEGORIES =");
const voiceConstants = source.slice(voiceStart, apiHelpersStart);
const apiHelpersEnd = find(domStartMarker, apiHelpersStart);
const apiHelpers = source
  .slice(apiHelpersStart, apiHelpersEnd)
  .replace(
    /^async function readApiResponse\(/m,
    "export async function readApiResponse(",
  )
  .replace(/^function apiErrorMessage\(/m, "export function apiErrorMessage(");
const authBody = deindent(
  source.slice(domStart + domStartMarker.length, dashboardStart),
);
const dashboardBody = deindent(source.slice(dashboardStart, settingsStart));
const settingsBody = deindent(source.slice(settingsStart, domClose));
const dashboardTail = source.slice(loadRoomsStart);

const modules = path.join(frontend, "js");
fs.mkdirSync(modules, { recursive: true });
fs.writeFileSync(path.join(modules, "api.js"), apiConfig + apiHelpers);
fs.writeFileSync(path.join(modules, "storage.js"), storage);
fs.writeFileSync(path.join(modules, "emoji.js"), emoji);
fs.writeFileSync(
  path.join(modules, "auth.js"),
  `import { API_URL, AUTH_CONNECTION_ERROR, readApiResponse, apiErrorMessage } from "./api.js";\n\nexport function initAuth() {\n${authBody}\n}\n`,
);
fs.writeFileSync(
  path.join(modules, "dashboard.js"),
  `import { API_URL } from "./api.js";\nimport { readJsonStorage, writeJsonStorage, activeRoomStorageKey, roomListCacheKey, roomPreviewCacheKey, roomMessagesCacheKey } from "./storage.js";\nimport { EMOJI_CATEGORIES } from "./emoji.js";\n\n${source.slice(apiBoundary, storageStart)}${voiceConstants}\nexport function initDashboard() {\n${dashboardBody}\n}\n\n${dashboardTail}`,
);
fs.writeFileSync(
  path.join(modules, "settings.js"),
  `export function initSettings() {\n${settingsBody}\n}\n`,
);
fs.writeFileSync(
  appPath,
  `import { initAuth } from "./js/auth.js";\nimport { initDashboard } from "./js/dashboard.js";\nimport { initSettings } from "./js/settings.js";\n\ndocument.addEventListener("DOMContentLoaded", () => {\n  initAuth();\n  initDashboard();\n  initSettings();\n});\n`,
);

console.log(`Generated modules in ${modules}`);
