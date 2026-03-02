import {
  normalizeInputRegex,
  isRegex,
  removeDuplicateBlocks,
} from "./utils";
import {
  actualizeHighlights,
  removeHighlightedNodes,
} from "./highlighting";
import { displayResultsInPlainText } from "./wholeGraph";
import { openPanel } from "./panelBridge";
import state from "./state";

// Dependencies injected from index.js to avoid circular imports
let _initializeGlobalVar,
  _selectedNodesProcessing,
  _replaceOpened;

export function setSearchDialogDeps({
  initializeGlobalVar,
  selectedNodesProcessing,
  replaceOpened,
}) {
  _initializeGlobalVar = initializeGlobalVar;
  _selectedNodesProcessing = selectedNodesProcessing;
  _replaceOpened = replaceOpened;
}

/******************************************************************************************
/*	Search and Highlight (supporting regular expressions)
*****************************************************************************************/
export const searchOnly = async function (
  findInput = "",
  caseInsensitive = false,
  wordOnly = false,
  expandToHighlight = false,
  workspaceArg = false,
  position,
  refresh = true,
  label = "Search in page or workspace",
) {
  if (workspaceArg != null) state.workspace = workspaceArg;
  if (findInput === null) findInput = "";
  if (refresh) _initializeGlobalVar();

  const scope = state.workspace ? "workspace" : "page";

  openPanel({
    mode: "search",
    scope,
    label,
    findInput,
    caseInsensitive,
    wordOnly,
    expandToHighlight,
    searchLogic: "",
  });

  if (findInput != null && findInput.length > 1 && refresh) {
    actualizeHighlights(findInput, caseInsensitive, wordOnly, expandToHighlight);
  }
};

/**
 * Handle search panel close.
 */
export const onSearchClose = (findInput, caseInsensitive, wordOnly, expandToHighlight, workspace) => {
  state.lastOperation = "Search";
  state.inputBackup = [
    findInput,
    caseInsensitive,
    wordOnly,
    expandToHighlight,
    workspace,
  ];
  state.workspace = false;
  state.selectedBlocks = [];
  removeHighlightedNodes();
};

export const getFullMatchArrayInPage = async (promptParameters) => {
  state.matchArray = [];
  state.matchingStringsArray = [];
  promptParameters.push(false);
  let nodesToProcess = state.expandedNodesUid
    .concat(state.collapsedNodesUid)
    .concat(state.referencedNodesUid);
  nodesToProcess = removeDuplicateBlocks(nodesToProcess);

  await _selectedNodesProcessing(
    nodesToProcess,
    promptParameters,
    _replaceOpened,
    false,
  );
};

export const displaySearchResustsInPlainText = async (
  promptParameters,
  findInput,
  onApplyToTab,
) => {
  state.changesNbBackup = state.changesNb;
  let matchArrayBackup = state.matchArray;

  await getFullMatchArrayInPage(promptParameters);

  displayResultsInPlainText(
    state.matchArray.length +
      " blocks in this page or workspace containing matching strings",
    promptParameters,
    findInput,
    undefined,
    onApplyToTab,
  );
  state.changesNb = state.changesNbBackup;
  state.matchArray = matchArrayBackup;
};
