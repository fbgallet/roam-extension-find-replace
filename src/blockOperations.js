import React from "react";
import { updateBlock, getBlockAttributes, normalizeInputRegex } from "./utils";
import { openPanel } from "./panelBridge";
import renderOverlay from "roamjs-components/util/renderOverlay";
import state from "./state";
import FormatChangeDialog from "./components/FormatChangeDialog";

// Dependencies injected from index.js to avoid circular imports
let _selectedNodesProcessing, _initializeGlobalVar, _replaceOpened, _referencesRegexStr;

export function setBlockOperationsDeps({
  selectedNodesProcessing,
  initializeGlobalVar,
  replaceOpened,
  referencesRegexStr,
}) {
  _selectedNodesProcessing = selectedNodesProcessing;
  _initializeGlobalVar = initializeGlobalVar;
  _replaceOpened = replaceOpened;
  _referencesRegexStr = referencesRegexStr;
}

/******************************************************************************************
/*	Append and/or Prepend
/******************************************************************************************/

export const appendPrepend = async (node, stringBefore, stringAfter) => {
  let uid = node.uid;
  let blockContent = node.content;
  let isOpened = node.open;
  state.modifiedBlocksCopy.push({
    uid: uid,
    content: blockContent,
    open: isOpened,
    page: node.page,
  });
  updateBlock(uid, stringBefore + blockContent + stringAfter, isOpened);
  state.changesNb++;
};

/**
 * Called by the panel's onAppendPrepend callback (from index.js).
 * Runs the bulk operation on all selected nodes.
 */
export const doAppendPrepend = async (prefixe, suffixe) => {
  state.lastOperation = "Append and/or Prepend";
  while (state.modifiedBlocksCopy.length > 0) state.modifiedBlocksCopy.pop();
  await _selectedNodesProcessing(
    state.expandedNodesUid,
    [prefixe, suffixe],
    appendPrepend,
  );
  state.selectedBlocks = [];
  state.seletionBlue = false;
  _initializeGlobalVar(true);
};

/**
 * Opens the unified panel on the Pre/Append tab.
 * Selection is checked inside the panel via onCheckSelection callback.
 */
export const appendPrependDialog = function () {
  state.changesNb = 0;
  state.formatChange = false;
  openPanel({
    mode: "appendPrepend",
    label: "Prepend / Append to selected blocks",
  });
};

/******************************************************************************************
/*	Change format
/******************************************************************************************/
export const changeBlockFormat = async (node, headingLevel, alignment, view) => {
  let h;
  let hOld = headingLevel;
  let aOld = alignment;
  let vOld = view;
  let uid = node.uid;
  let blockContent = node.content;
  let isOpened = node.open;
  let blockTree = getBlockAttributes(uid);

  if (headingLevel != "noChange") {
    h = parseInt(headingLevel);
    if (blockTree.heading != null) {
      hOld = blockTree.heading;
    } else {
      hOld = 0;
    }
    if (blockTree.heading != h) {
      await window.roamAlphaAPI.updateBlock({
        block: { uid: uid, heading: h },
      });
    }
  }
  if (alignment != "noChange") {
    if (blockTree["text-align"] != null) {
      aOld = blockTree["text-align"];
    } else {
      aOld = "left";
    }
    await window.roamAlphaAPI.updateBlock({
      block: { uid: uid, "text-align": alignment },
    });
  }
  if (view != "noChange") {
    if (blockTree["view-type"] != null) {
      vOld = blockTree["view-type"];
    } else {
      vOld = "bullet";
    }
    await window.roamAlphaAPI.updateBlock({
      block: { uid: uid, "children-view-type": view },
    });
  }
  state.changesNb++;
  state.modifiedBlocksCopy.push({
    uid: uid,
    content: blockContent,
    open: isOpened,
    page: node.page,
    h: hOld,
    a: aOld,
    v: vOld,
  });
};

export const changeBlockFormatPrompt = async function () {
  state.changesNb = 0;

  const onApply = async (h, a, v, caseChange) => {
    if (h != "noChange" || a != "noChange" || v != "noChange") {
      state.lastOperation = "Change format";
      state.formatChange = true;
      const promptParameters = [h, a, v];
      while (state.modifiedBlocksCopy.length > 0) state.modifiedBlocksCopy.pop();
      await _selectedNodesProcessing(
        state.expandedNodesUid,
        promptParameters,
        changeBlockFormat,
      );
    }
    if (caseChange != "noChange") {
      state.lastOperation = "Change case";
      await caseBulkChange(caseChange);
    }
    state.selectedBlocks = [];
    state.seletionBlue = false;
    _initializeGlobalVar(true);
    state.changesNbBackup = state.changesNb;
  };

  renderOverlay({
    Overlay: ({ isOpen, onClose }) => (
      <FormatChangeDialog
        isOpen={isOpen}
        onClose={() => {
          state.selectedBlocks = [];
          state.seletionBlue = false;
          _initializeGlobalVar(true);
          state.changesNbBackup = state.changesNb;
          onClose();
        }}
        onApply={async (h, a, v, caseChange) => {
          await onApply(h, a, v, caseChange);
          onClose();
        }}
      />
    ),
  });
};

export const caseBulkChange = async (change) => {
  let replace;
  let input = _referencesRegexStr;
  switch (change) {
    case "toUpper":
      replace = "$REGEX";
      break;
    case "toLower":
      replace = "$regex";
      break;
    case "capitalizeB":
      replace = "$Regex";
      break;
    case "capitalizeW":
      replace = "$RegexW";
      break;
    case "capitalizeS":
      replace = "$RegexS";
      break;
  }

  while (state.modifiedBlocksCopy.length > 0) state.modifiedBlocksCopy.pop();
  let promptParameters = normalizeInputRegex(input, replace);
  promptParameters.push(true);
  if (change == "capitalizeS") promptParameters[0] = /.*/g;
  else promptParameters.push(true);
  await _selectedNodesProcessing(
    state.expandedNodesUid,
    promptParameters,
    _replaceOpened,
  );
  state.changesNbBackup = state.changesNb;
};
