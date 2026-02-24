import { normalizeInputRegex, getPageTitleByBlockUid } from "./utils";
import { copyMatchingUidsToClipboard, displayChangedBlocks } from "./copyResults";
import { infoToast } from "./notifications";
import { getSelection, getNodes, initializeNodesArrays } from "./nodeTraversal";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import state from "./state";

// Dependencies injected from index.js to avoid circular imports
let _initializeGlobalVar, _selectedNodesProcessing, _replaceOpened;

export function setExtractContentDeps({
  initializeGlobalVar,
  selectedNodesProcessing,
  replaceOpened,
}) {
  _initializeGlobalVar = initializeGlobalVar;
  _selectedNodesProcessing = selectedNodesProcessing;
  _replaceOpened = replaceOpened;
}

export async function extractContentFromPageOrSelectionByRegex(strRegex, title) {
  let zoomUid =
    await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
  let pageTitle = getPageTitleByBlockUid(zoomUid);
  if (pageTitle === "") pageTitle = getPageTitleByPageUid(zoomUid);

  _initializeGlobalVar();
  getSelection();
  await getNodes();

  let promptParameters = normalizeInputRegex(strRegex, "$1");
  promptParameters.push(false);
  let varBackup = state.extractMatchesOnly;
  state.extractMatchesOnly = true;
  await _selectedNodesProcessing(
    state.expandedNodesUid,
    promptParameters,
    _replaceOpened,
    false,
  );

  state.matchingStringsArray.forEach((match) => {
    match.content = match.replace;
  });

  copyMatchingUidsToClipboard(
    state.matchingStringsArray,
    `extract ${title}`,
    false,
    false,
    "",
    "page",
    true,
    `${title} extracted`,
  );
  infoToast(
    state.changesNb +
      ` ${title} copied in the clipboard. Paste them anywhere in your graph!`,
  );

  displayChangedBlocks(true, `Extracted ${title} in [[${pageTitle}]] on `, "only matching");
  state.extractMatchesOnly = varBackup;
  initializeNodesArrays();
}
