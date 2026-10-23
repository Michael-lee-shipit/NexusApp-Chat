const CHAT_CACHE_PREFIX = "zenith_chat_cache:";
const ACTIVE_ROOM_PREFIX = "zenith_active_room:";

export function getCurrentUserKey() {
  return localStorage.getItem("user_id") || "guest";
}

export function activeRoomStorageKey() {
  return `${ACTIVE_ROOM_PREFIX}${getCurrentUserKey()}`;
}

export function roomListCacheKey() {
  return `${CHAT_CACHE_PREFIX}${getCurrentUserKey()}:rooms`;
}

export function roomPreviewCacheKey(roomId) {
  return `${CHAT_CACHE_PREFIX}${getCurrentUserKey()}:room:${roomId}:preview`;
}

export function roomMessagesCacheKey(roomId) {
  return `${CHAT_CACHE_PREFIX}${getCurrentUserKey()}:room:${roomId}:messages`;
}

export function readJsonStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota issues so the chat remains usable offline.
  }
}
