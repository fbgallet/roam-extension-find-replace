const state = {
  includeEmbeds: true,
  includeCollapsed: false,
  excludeDuplicate: false,
  displayBefore: false,
  showPath: true,
  wholeGraph: undefined,
  highlightColor: undefined,
  matchesSortedBy: "page",
  extractMatchesOnly: true,
  codeBlockLimit: 150,

  seletionBlue: false,
  lastOperation: "",
  changesNb: 0,
  changesNbBackup: undefined,
  isPrepending: undefined,
  workspace: undefined,
  formatChange: false,
  expandedNodesUid: [],
  collapsedNodesUid: [],
  referencedNodesUid: [],
  uniqueReferences: [],
  notExpandedNodesUid: [],
  selectedBlocks: [],
  modifiedBlocksCopy: [],
  inputBackup: [],
  refsUids: [],
  eltFound: undefined,
  scrollIndex: 0,
  matchIndex: 0,
  matchArray: [],
  matchingStringsArray: [],
  matchRefsArray: undefined,
  matchingTotal: 0,
  matchingHidden: 0,
  ANDwithChildren: false,
  textToCopy: undefined,

  // Dialog shared vars (used by formDialog)
  resultsJSX: undefined,
  dialogTitle: undefined,
  submitParams: undefined,
  handleSubmit: undefined,
  submitButtonTitle: "Copy to clipboard",
  cancelButtonTitle: "Close",

  // When true, getNodes() preserves expandedNodesUid instead of re-reading the page
  frozenNodes: false,

  // Panel position preset (setting) and persistence helpers
  panelPosition: "top right",
  panelInitialXY: null,           // {x, y} loaded from extensionAPI on startup
  savePanelXY: null,              // (x, y) => void — set by index.js after extensionAPI is ready
};
export default state;
