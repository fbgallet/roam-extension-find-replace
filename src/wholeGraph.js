import React from "react";
import { Alert, Intent } from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import {
  updateBlock,
  getBlockContentByUid,
  getPageUidByPageName,
  normalizeInputRegex,
  normalizeMention,
  moveChildBlocks,
  getPageUidByNameOrCreateIt,
  groupMatchesByPage,
  isRegex,
  createBlockOnDNP,
  getAllBlockData,
  getPagesNamesMatchingRegex,
  replaceSubstringOrCaptureGroup,
} from "./utils";
import { displayForm } from "./formDialog";
import { openPanel, closePanel } from "./panelBridge";
import {
  copyMatchingPagesToClipbard,
  copyMatchingUidsToClipboard,
  displayChangedBlocks,
} from "./copyResults";
import state from "./state";
import {
  errorToast,
  infoToast,
  displayWholeGraphCountInTitle,
} from "./notifications";
import Node from "./nodeModel";
import BlockResultsList from "./components/BlockResultsList";
import PageNamesList from "./components/PageNamesList";

// Dependencies injected from index.js to avoid circular imports
let _initializeGlobalVar,
  _replaceOpened,
  _highlightString,
  _highlightAllMatches,
  _undoPopup;

export function setWholeGraphDeps({
  initializeGlobalVar,
  replaceOpened,
  highlightString,
  highlightAllMatches,
  undoPopup,
}) {
  _initializeGlobalVar = initializeGlobalVar;
  _replaceOpened = replaceOpened;
  _highlightString = highlightString;
  _highlightAllMatches = highlightAllMatches;
  _undoPopup = undoPopup;
}

/******************************************************************************************
/*	Whole graph Find & Replace
/******************************************************************************************/

export const findAndReplaceInWholeGraph = async function (
  label,
  mode = "search",
  findInput = "",
  replaceInput = "",
  caseInsensitive = false,
  wordOnly = false,
  refresh = true,
) {
  if (refresh) _initializeGlobalVar();
  state.formatChange = false;

  // Determine panel mode from graph sub-mode
  const panelMode = mode === "search" ? "search" : "findReplace";

  openPanel({
    mode: panelMode,
    scope: "graph",
    graphSubMode: mode,
    label: label || "Whole Graph",
    findInput,
    replaceInput,
    caseInsensitive,
    wordOnly,
    searchLogic: "",
  });
};

/**
 * Opens the unified panel on the Page ⇔ Block conversion tab.
 */
export const openPageBlockConversionPanel = function (
  direction = "pageToBlock",
  findInput = "",
  replaceInput = "",
  moveContent = false,
) {
  openPanel({
    mode: "pageBlockConversion",
    conversionDirection: direction,
    findInput,
    replaceInput,
    moveContent,
    label: "Page ⇔ Block conversion",
  });
};

/**
 * Called by UnifiedSearchPanel "Replace" button in graph scope.
 */
export const doGraphReplace = async (findInput, replaceInput, caseInsensitive, wordOnly, searchLogic) => {
  const promptParameters = normalizeInputRegex(
    findInput, replaceInput, caseInsensitive, wordOnly, searchLogic, false, true,
  );
  if (findInput.length > 0) {
    state.lastOperation = "Find and Replace";
    warningPopupWholeGraph(promptParameters[0], promptParameters[1], "replace", false);
  }
};

export const doGraphReplacePageNames = async (findInput, replaceInput) => {
  const promptParameters = normalizeInputRegex(findInput, replaceInput, false, false, "", false, false);
  if (findInput.length > 0) {
    await wholeGraphPageNameProcessing(promptParameters, false);
    displayWholeGraphCountInTitle(state.changesNb + " matching [[page names]]");
    if (state.matchArray.length > 0) displayPageNamesResults(...promptParameters);
  }
};

/**
 * Page titles scope — show matching page names (called from panel 🔎 button).
 */
export const doPageTitlesDisplayResults = async (findInput, replaceInput) => {
  const promptParameters = normalizeInputRegex(findInput, replaceInput ?? "", false, false, "", false, false);
  if (findInput.length === 0) return;
  _initializeGlobalVar();
  wholeGraphPageNameProcessing(promptParameters, false);
  displayWholeGraphCountInTitle(state.changesNb + " matching [[page names]]");
  if (state.matchArray.length > 0) displayPageNamesResults(...promptParameters);
};

/**
 * Page titles scope — replace page name patterns (called from panel Replace button).
 */
export const doPageTitlesReplace = async (findInput, replaceInput) => {
  const promptParameters = normalizeInputRegex(findInput, replaceInput, false, false, "", false, false);
  if (findInput.length === 0) return;
  if (state.matchArray.length === 0) {
    _initializeGlobalVar();
    wholeGraphPageNameProcessing(promptParameters, false);
  }
  if (state.matchArray.length > 0) {
    displayPageNamesResults(...promptParameters);
  }
};

/**
 * Page⇔Block tab — show preview of affected blocks before converting.
 */
export const doPageBlockDisplayResults = async (findInput, replaceInput, direction, moveContent) => {
  _initializeGlobalVar();
  if (direction === "blockToPage") {
    const normalizedFind = normalizeMention(findInput, "block");
    if (normalizedFind === null) {
      errorToast("Incorrect block reference.");
      return;
    }
    const promptParameters = normalizeInputRegex(normalizedFind, replaceInput);
    await wholeGraphProcessing(promptParameters, false);
    displayWholeGraphCountInTitle(state.changesNb + " blocks referencing this block");
    if (state.matchArray.length > 0)
      displayResultsInPlainText(
        state.matchArray.length + " blocks referencing " + findInput,
        promptParameters,
        findInput,
      );
  } else {
    // pageToBlock: show blocks referencing the page
    const pageMentionsRegex = getPageMentionRegex(findInput.replace(/^\[\[|\]\]$/g, ""));
    await wholeGraphProcessing([pageMentionsRegex, replaceInput], false);
    displayWholeGraphCountInTitle(state.changesNb + " blocks referencing [[" + findInput + "]]");
    if (state.matchArray.length > 0)
      displayResultsInPlainText(
        state.matchArray.length + " blocks referencing " + findInput,
        [pageMentionsRegex, replaceInput],
        findInput,
      );
  }
};

export const doGraphBlockToPage = async (findInput, replaceInput, moveContent) => {
  let normalizedFind = normalizeMention(findInput, "block");
  if (normalizedFind === null) {
    errorToast("Incorrect block reference. Copy/paste it from the original block by pressing Ctrl+Shift+c.");
    return;
  }
  state.lastOperation = "block to page";
  warningPopupWholeGraph(normalizedFind, replaceInput, "block to page", moveContent);
};

export const doGraphPageToBlock = async (findInput, replaceInput, moveContent) => {
  let normalizedReplace = normalizeMention(replaceInput, "block");
  if (normalizedReplace === null) {
    if (replaceInput === "" || replaceInput.toLocaleLowerCase() === "dnp") {
      replaceInput = await createBlockOnDNP();
      infoToast("The converted block will be created as the last block of Today's page.");
    } else {
      errorToast("Incorrect block reference. Copy/paste it from the original block by pressing Ctrl+Shift+c.");
      return;
    }
  } else replaceInput = normalizedReplace;
  state.lastOperation = "page to block";
  warningPopupWholeGraph(findInput, replaceInput, "page to block", moveContent);
};

export const doGraphDisplayResults = async (findInput, caseInsensitive, wordOnly, searchLogic, graphSubMode, replaceInput) => {
  _initializeGlobalVar();
  const isPageNames = graphSubMode === "replace page names";
  const promptParameters = normalizeInputRegex(
    findInput, replaceInput ?? "", caseInsensitive, wordOnly, searchLogic, false, !isPageNames,
  );
  if (findInput.length > 0) {
    if (isPageNames) {
      wholeGraphPageNameProcessing(promptParameters, false);
      displayWholeGraphCountInTitle(state.changesNb + " matching [[page names]]");
      if (state.matchArray.length > 0) displayPageNamesResults(...promptParameters);
    } else {
      await wholeGraphProcessing(promptParameters, false);
      displayWholeGraphCountInTitle();
      if (state.matchArray.length > 0) {
        displayResultsInPlainText(
          state.matchArray.length + " blocks in your graph containing matching strings",
          promptParameters,
          findInput,
          replaceInput,
        );
      }
    }
  }
};

export const doGraphDisplayResultsSidebar = async (findInput, caseInsensitive, wordOnly, searchLogic, graphSubMode) => {
  _initializeGlobalVar();
  const isPageNames = graphSubMode === "replace page names";
  const promptParameters = normalizeInputRegex(
    findInput, "", caseInsensitive, wordOnly, searchLogic, false, !isPageNames,
  );
  if (findInput.length === 0) return;
  if (isPageNames) {
    wholeGraphPageNameProcessing(promptParameters, false);
    displayWholeGraphCountInTitle(state.changesNb + " matching [[page names]]");
  } else {
    await wholeGraphProcessing(promptParameters, false);
    displayWholeGraphCountInTitle();
  }
  const title = "Matching blocks for search on: `" + findInput + "`";
  if (state.matchArray.length > 0) {
    if (state.matchArray.length < 200)
      displayChangedBlocks(true, title, graphSubMode, false, findInput);
    else
      errorToast("More than 200 results, narrow down your search! Click on 🔎 to see the list in plain text.");
  }
};

export const doGraphCopyRefs = async (findInput, replaceInput, caseInsensitive, wordOnly, searchLogic, graphSubMode) => {
  const isPageNames = graphSubMode === "replace page names";
  const promptParameters = normalizeInputRegex(
    findInput, replaceInput, caseInsensitive, wordOnly, searchLogic, false, !isPageNames,
  );
  if (findInput.length === 0) return;
  if (isPageNames) {
    wholeGraphPageNameProcessing(promptParameters, false);
    displayWholeGraphCountInTitle(state.changesNb + " matching [[page names]]");
  } else {
    await wholeGraphProcessing(promptParameters, false);
    displayWholeGraphCountInTitle();
  }
  const searchString = !findInput.includes("/") ? findInput : promptParameters[0];
  const replaceString = !replaceInput.includes("/") ? replaceInput : promptParameters[1];
  if (state.matchArray.length < 200) {
    if (isPageNames) {
      copyMatchingPagesToClipbard();
    } else {
      copyMatchingUidsToClipboard(
        state.matchArray, searchString, caseInsensitive, state.showPath,
        replaceString, "whole graph", isRegex(findInput) && state.extractMatchesOnly,
      );
    }
    if (state.matchArray.length > 0)
      infoToast(state.matchArray.length + " items copied in the clipboard. Paste them anywhere in your graph!");
  } else {
    errorToast("More than 200 block references to copy, narrow down your search! Click on 🔎 to see the list in plain text.");
  }
};

export const displayResultsInPlainText = (
  dialogCaption,
  promptParameters,
  findInput,
  replaceInput,
) => {
  let treeArray;
  const isMatchesOnly = state.extractMatchesOnly && isRegex(findInput);

  if (isMatchesOnly) {
    if (state.matchingStringsArray.length > 0 && state.matchingStringsArray[0].groups.length > 0) {
      state.matchingStringsArray.forEach((match) => {
        match.replace && (match.content = match.replace);
      });
    }

    treeArray = groupMatchesByPage(state.matchingStringsArray);

    dialogCaption = "matching strings in your graph";
  } else {
    treeArray = groupMatchesByPage(state.matchArray);
  }

  // Only offer Replace Selected when there's a replace string (F&R mode, not plain search)
  const hasReplace = replaceInput !== undefined && replaceInput !== null;

  state.resultsJSX = (
    <BlockResultsList
      treeArray={treeArray}
      promptParameters={promptParameters}
      isMatchesOnly={isMatchesOnly}
      onHighlight={_highlightString}
      onHighlightAll={_highlightAllMatches}
      onReplaceSelected={hasReplace ? (selectedUids) => {
        warningPopupWholeGraph(
          promptParameters[0],
          promptParameters[1],
          "replace",
          false,
          selectedUids,
        );
      } : undefined}
    />
  );
  state.dialogTitle = <h4>{dialogCaption}:</h4>;
  state.handleSubmit = () => {
    navigator.clipboard.writeText(state.textToCopy);
  };
  state.submitParams = [];
  displayForm("Copy to clipboard");
};

const displayPageNamesResults = (find, replace) => {
  state.submitParams = [[...state.matchArray]];

  state.resultsJSX = (
    <PageNamesList
      matchArray={state.matchArray}
      find={find}
      replace={replace}
      replaceFunc={replaceSubstringOrCaptureGroup}
    />
  );
  state.dialogTitle = <h4>{state.matchArray.length} matching page names</h4>;
  state.handleSubmit = (selectedElts) => {
    warningPopupWholeGraph(
      find,
      replace,
      "replace page names",
      false,
      selectedElts,
    );
  };
  displayForm("Replace");
};

const warningPopupWholeGraph = async (
  find,
  replace,
  mode = "search",
  moveContent = false,
  arrayToProcess,
) => {
  let title = "Replace a given string in the whole graph";
  let findRegex = find;
  let inputs;
  // selectedUids: array of uid strings passed when replacing only selected blocks
  const selectedUids = Array.isArray(arrayToProcess) && mode === "replace" ? arrayToProcess : undefined;

  switch (mode) {
    case "replace page names":
      title = "Replacing patterns in [[page names]]";
      state.changesNb = arrayToProcess ? arrayToProcess.length : state.changesNb;
      break;
    case "block to page":
      title = "Convert a block in a page";
      inputs = normalizeInputRegex(find, replace);
      findRegex = inputs[0];
      replace = inputs[1];
      break;
    case "page to block":
      title = "Convert a page in a block";
      findRegex = getPageMentionRegex(find);
      break;
  }

  if (selectedUids) {
    // Replace selected: we already know the count, no re-scan needed
    state.changesNb = selectedUids.length;
    title = "Replace selected blocks in the whole graph";
  } else if (mode !== "replace page names") {
    await wholeGraphProcessing([findRegex, replace], false);
  }
  if (mode === "block to page" || mode === "page to block") state.changesNb++;
  if (state.changesNb === 0) {
    errorToast("0 matching block in the graph, try again with another block or page reference");
    return;
  }

  const confirmMsg =
    state.changesNb + " matches found.\n\n" +
    title + " is a very dangerous operation and can have unintended consequences.\n\n" +
    "Do you confirm that you want to replace '" + find + "' by '" + replace + "' ?";

  const ConfirmAlert = ({ isOpen, onClose }) => (
    <Alert
      isOpen={isOpen}
      onClose={onClose}
      intent={Intent.DANGER}
      confirmButtonText="Yes, I know what I do"
      cancelButtonText="No, cancel"
      canEscapeKeyCancel
      canOutsideClickCancel
      onConfirm={async () => {
        while (state.modifiedBlocksCopy.length > 0) state.modifiedBlocksCopy.pop();
        switch (mode) {
          case "replace page names":
            await wholeGraphPageNameProcessing([find, replace], true, arrayToProcess);
            break;
          case "block to page":
            await changeBlockToPage(find, replace, moveContent);
            break;
          case "page to block":
            await changePageToBlock(find, replace, moveContent);
            break;
          default:
            if (selectedUids) {
              await wholeGraphProcessingSelected(selectedUids, findRegex, replace);
            } else {
              await wholeGraphProcessing([find, replace], true);
            }
        }
        state.changesNbBackup = state.changesNb;
        closePanel();
        _undoPopup(state.changesNb, find, replace);
        onClose();
      }}
    >
      <p style={{ whiteSpace: "pre-wrap" }}>{confirmMsg}</p>
    </Alert>
  );
  renderOverlay({ Overlay: ConfirmAlert });
};

const wholeGraphProcessing = async (
  promptParameters,
  makeChanges = true,
) => {
  let find = promptParameters[0];
  let replace = promptParameters[1];
  let searchLogic = "";
  if (promptParameters.length > 2) {
    searchLogic = promptParameters[2];
  }
  if (state.matchArray.length == 0) {
    _initializeGlobalVar();
    const all = getAllBlockData();
    const totalBlocksNb = all.length;
    for (let i = 0; i < totalBlocksNb; i++) {
      if (all[i].text != "") {
        let node = new Node(all[i].uid, {
          string: all[i].text,
          page: all[i].page,
        });
        await _replaceOpened(node, find, replace, searchLogic, makeChanges);
      }
    }
  } else if (makeChanges) {
    state.changesNb = 0;
    for (const match of state.matchArray) {
      let node = new Node(match.uid, {
        string: match.content,
        open: match.open,
        page: match.page,
      });
      await _replaceOpened(node, find, replace, "", makeChanges);
    }
  }
};

// Processes only the blocks whose uids are in selectedUids (array of uid strings)
const wholeGraphProcessingSelected = async (selectedUids, find, replace) => {
  const uidSet = new Set(selectedUids);
  const blocksToProcess = state.matchArray.filter((m) => uidSet.has(m.uid));
  state.changesNb = 0;
  for (const match of blocksToProcess) {
    let node = new Node(match.uid, {
      string: match.content,
      open: match.open,
      page: match.page,
    });
    await _replaceOpened(node, find, replace, "", true);
  }
};

const wholeGraphPageNameProcessing = async (
  promptParameters,
  makeChanges = true,
  arrayToProcess,
) => {
  let findRegex = promptParameters[0];
  let replace = promptParameters[1];
  if (state.matchArray.length == 0) {
    _initializeGlobalVar();
    const matchingPages = getPagesNamesMatchingRegex(findRegex);
    for (let i = 0; i < matchingPages.length; i++) {
      state.matchArray.push(matchingPages[i][0]);
      state.changesNb++;
    }
  } else if (makeChanges) {
    if (arrayToProcess === undefined) arrayToProcess = state.matchArray;
    for (const match of arrayToProcess) {
      state.modifiedBlocksCopy.push(match);
      await roamAlphaAPI.data.page.update({
        page: {
          uid: match.uid,
          title: replaceSubstringOrCaptureGroup(
            match.title,
            findRegex,
            replace,
          ),
        },
      });
    }
    state.lastOperation = "Find and Replace page names";
  }
};

/******************************************************************************************
/*	Page <=> Block conversion
/******************************************************************************************/

export const changeBlockToPage = async (
  blockUid,
  pageName = "",
  moveContent = false,
) => {
  let blockMention = normalizeMention(blockUid, "block");
  if (blockMention === null) {
    return null;
  }
  blockUid = blockMention.slice(2, -2);
  let blockContent = getBlockContentByUid(blockUid);
  if (blockContent === null) {
    errorToast(
      "Block " +
        blockMention +
        "doesn't exist, so you can't change it in a page!",
    );
    return null;
  }
  if (pageName == "") pageName = blockContent;
  let pageMention = normalizeMention(pageName, "page");
  if (pageMention === null) return null;
  pageName = pageMention.slice(2, -2);

  let promptParameters = normalizeInputRegex(blockMention, pageMention);
  await wholeGraphProcessing(promptParameters, true);
  let pageUid = await getPageUidByNameOrCreateIt(pageName);

  if (moveContent) moveChildBlocks(blockUid, pageUid);
  await updateBlock(blockUid, pageMention);
  state.changesNbBackup = ++state.changesNb;
};

export const changePageToBlock = async (
  pageName,
  blockUid = "",
  moveContent = false,
) => {
  let pageMention = normalizeMention(pageName, "page");
  if (pageMention === null) return null;
  pageName = pageMention.slice(2, -2);
  let pageUid = getPageUidByPageName(pageName);
  if (pageUid === undefined) return null;
  let blockMention;
  blockMention = normalizeMention(blockUid, "block");
  if (blockMention === null) return null;
  else blockUid = blockMention.slice(2, -2);

  // Take into account all the forms of page reference: [[page]], #page, #[[page]] and page::
  let pageMentionsRegex = getPageMentionRegex(pageName);
  await wholeGraphProcessing([pageMentionsRegex, blockMention], true);
  if (moveContent) moveChildBlocks(pageUid, blockUid);
  await updateBlock(blockUid, pageName);
  state.changesNbBackup = state.changesNb;
};

const getPageMentionRegex = (pageName) => {
  return new RegExp(
    pageName + "::|[#]{0,1}\\[\\[" + pageName + "\\]\\]|#" + pageName,
    "g",
  );
};
