export const HISTORY_FIND = "historyFind";
export const HISTORY_REPLACE = "historyReplace";
export const HISTORY_PREFIX_SUFFIX = "historyPrefixSuffix";

const MAX_HISTORY = 10;

export function loadHistoryData(extensionAPI, storageKey) {
  const data = extensionAPI.settings.get(storageKey);
  if (!data || typeof data !== "object") return { history: [], favorites: [] };
  return {
    history: Array.isArray(data.history) ? data.history : [],
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
  };
}

function saveHistoryData(extensionAPI, storageKey, data) {
  extensionAPI.settings.set(storageKey, data);
}

export function addToHistory(extensionAPI, storageKey, value) {
  if (!value || !value.trim()) return;
  const data = loadHistoryData(extensionAPI, storageKey);
  // If already a favorite, don't add to history
  if (data.favorites.includes(value)) return;
  // Remove if already in history (will re-add at top)
  data.history = data.history.filter((v) => v !== value);
  data.history.unshift(value);
  if (data.history.length > MAX_HISTORY) data.history = data.history.slice(0, MAX_HISTORY);
  saveHistoryData(extensionAPI, storageKey, data);
}

export function toggleFavorite(extensionAPI, storageKey, value) {
  const data = loadHistoryData(extensionAPI, storageKey);
  if (data.favorites.includes(value)) {
    // Unfavorite: move back to top of history
    data.favorites = data.favorites.filter((v) => v !== value);
    data.history = data.history.filter((v) => v !== value);
    data.history.unshift(value);
    if (data.history.length > MAX_HISTORY) data.history = data.history.slice(0, MAX_HISTORY);
  } else {
    // Favorite: remove from history, add to favorites
    data.history = data.history.filter((v) => v !== value);
    data.favorites.unshift(value);
  }
  saveHistoryData(extensionAPI, storageKey, data);
}

export function removeFromHistory(extensionAPI, storageKey, value) {
  const data = loadHistoryData(extensionAPI, storageKey);
  data.history = data.history.filter((v) => v !== value);
  data.favorites = data.favorites.filter((v) => v !== value);
  saveHistoryData(extensionAPI, storageKey, data);
}
