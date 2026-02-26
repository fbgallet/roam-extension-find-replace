/**
 * panelBridge.js
 * Observable store that replaces iziToast for the unified search panel.
 * Plain JS, no React dependency — all modules call openPanel() / closePanel().
 */

const panelState = {
  isOpen: false,
  /**
   * Active tab: "search" | "findReplace" | "appendPrepend" | "pageBlockConversion"
   */
  mode: "search",
  /**
   * Scope (only relevant for search/findReplace tabs):
   * "page" | "workspace" | "graph" | "pageTitles"
   */
  scope: "page",
  /** Graph sub-mode for search/findReplace: "search" | "replace" | "replace page names" */
  graphSubMode: "search",
  /** Direction for pageBlockConversion tab: "pageToBlock" | "blockToPage" */
  conversionDirection: "pageToBlock",
  findInput: "",
  replaceInput: "",
  caseInsensitive: false,
  wordOnly: false,
  expandToHighlight: false,
  moveContent: false,
  searchLogic: "",
  /** Updated by displayMatchCountInTitle, rendered in panel header */
  matchLabel: "",
  /** Label shown as the panel title / subtitle */
  label: "",
};

let listeners = [];

/** Subscribe to state changes. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function notify() {
  const snapshot = { ...panelState };
  listeners.forEach((fn) => fn(snapshot));
}

/**
 * Open the panel with the given config.
 * Any key not provided keeps its current value.
 */
export function openPanel(config) {
  Object.assign(panelState, config, { isOpen: true });
  notify();
}

export function closePanel() {
  panelState.isOpen = false;
  notify();
}

export function updatePanelField(key, value) {
  panelState[key] = value;
  notify();
}

export function getPanelState() {
  return { ...panelState };
}
