import { updateBlock, getBlockAttributes, normalizeInputRegex, getBlockContentByUid } from "./utils";
import { openPanel } from "./panelBridge";
import state from "./state";

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
  await updateBlock(uid, stringBefore + blockContent + stringAfter, isOpened);
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

/******************************************************************************************
/*	Clean content
/******************************************************************************************/

function resolveBlockRefs(text) {
  return text.replace(/\(\(([a-zA-Z0-9_-]{9})\)\)/g, (_match, uid) => {
    const content = getBlockContentByUid(uid);
    return content !== "" ? content : _match;
  });
}

/******************************************************************************************
/*	Style formatting removal
/******************************************************************************************/

// styleMode values: "bold" | "italic" | "highlight" | "strikethrough" | "allStyles"
function applyStyleChange(text, styleMode) {
  let result = text;
  const all = styleMode === "allStyles";

  // **bold** → bold
  if (all || styleMode === "bold")
    result = result.replace(/\*\*([^*]+)\*\*/g, "$1");

  // __italic__ → italic
  if (all || styleMode === "italic")
    result = result.replace(/__([^_]+)__/g, "$1");

  // ^^highlight^^ → highlight
  if (all || styleMode === "highlight")
    result = result.replace(/\^\^([^^]+)\^\^/g, "$1");

  // ~~strikethrough~~ → strikethrough
  if (all || styleMode === "strikethrough")
    result = result.replace(/~~([^~]+)~~/g, "$1");

  return result;
}

/******************************************************************************************
/*	Markdown alias handling
/******************************************************************************************/

// aliasMode values: "keepAlias" | "keepUrl" | "aliasWithStar" | "removeUrls"
function applyAliasChange(text, aliasMode) {
  let result = text;
  // Remove bare URLs (not part of a markdown link)
  if (aliasMode === "removeUrls") {
    return result.replace(/(?<!\])\(https?:\/\/\S+\)|(?<!\]\()https?:\/\/\S+/g, "").trim();
  }
  // Matches [label](url) — label may contain any char except ], url any non-whitespace non-)
  return result.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) => {
    if (aliasMode === "keepAlias") return label;
    if (aliasMode === "keepUrl") return url;
    if (aliasMode === "aliasWithStar") return `${label}*`;
    return _match;
  });
}

/******************************************************************************************
/*	Per-block callbacks
/******************************************************************************************/

export const styleBlockContent = async (node, styleMode) => {
  const uid = node.uid;
  const original = node.content;
  const result = applyStyleChange(original, styleMode).trim();
  if (result === original) return;
  if (!state.modifiedBlocksCopy.some((b) => b.uid === uid))
    state.modifiedBlocksCopy.push({ uid, content: original, open: node.open, page: node.page });
  await updateBlock(uid, result, node.open);
  node.content = result;
  state.changesNb++;
};

export const aliasBlockContent = async (node, aliasMode) => {
  const uid = node.uid;
  const original = node.content;
  const result = applyAliasChange(original, aliasMode).trim();
  if (result === original) return;
  if (!state.modifiedBlocksCopy.some((b) => b.uid === uid))
    state.modifiedBlocksCopy.push({ uid, content: original, open: node.open, page: node.page });
  await updateBlock(uid, result, node.open);
  node.content = result;
  state.changesNb++;
};

// cleanMode values: "pageRefs" | "blockRefs" | "buttons" | "all"
function applyCleanContent(text, cleanMode) {
  let result = text;
  const all = cleanMode === "all";

  // Resolve ((uid)) block references — replace with their content
  if (all || cleanMode === "blockRefs") {
    result = resolveBlockRefs(result);
  }

  // Remove buttons {{...}} — skip Roam components starting with {{[[
  // non-greedy so each button is removed individually
  if (all || cleanMode === "buttons") {
    result = result.replace(/\{\{(?!\[\[)[^{}]*?\}\}/g, "");
  }

  // Remove page ref syntax [[ and ]] and standalone #tag / #[[tag]]
  // Keep inner text for [[page]] and #[[page]]
  if (all || cleanMode === "pageRefs") {
    result = result.replace(/#\[\[([^\]]+)\]\]/g, "$1");
    result = result.replace(/#([^\s#\[\]]+)/g, "$1");
    result = result.replace(/\[\[([^\]]+)\]\]/g, "$1");
  }

  // Collapse extra whitespace left by removals, then trim
  result = result.replace(/  +/g, " ").trim();

  return result;
}

/******************************************************************************************
/*	Task marker transformation
/******************************************************************************************/

// taskMode values: "parseRef" | "checkboxIcon" | "markdown" | "removeTask"
// Handles both {{[[TODO]]}} and {{TODO}}, and same for DONE
function applyTaskChange(text, taskMode) {
  // Match {{[[TODO]]}}, {{[[DONE]]}}, {{TODO}}, {{DONE}}
  return text.replace(/\{\{(?:\[\[)?(TODO|DONE)(?:\]\])?\}\}/g, (_match, status) => {
    const isDone = status === "DONE";
    if (taskMode === "parseRef") return isDone ? "{{DONE}}" : "{{TODO}}";
    if (taskMode === "checkboxIcon") return isDone ? "☑" : "☐";
    if (taskMode === "markdown") return isDone ? "[x]" : "[ ]";
    if (taskMode === "removeTask") return "";
    return _match;
  });
}

export const taskBlockContent = async (node, taskMode) => {
  const uid = node.uid;
  const original = node.content;
  const result = applyTaskChange(original, taskMode).trim();
  if (result === original) return;
  if (!state.modifiedBlocksCopy.some((b) => b.uid === uid))
    state.modifiedBlocksCopy.push({ uid, content: original, open: node.open, page: node.page });
  await updateBlock(uid, result, node.open);
  node.content = result;
  state.changesNb++;
};

export const cleanBlockContent = async (node, cleanMode) => {
  const uid = node.uid;
  const original = node.content;
  const cleaned = applyCleanContent(original, cleanMode);
  if (cleaned === original) return;
  if (!state.modifiedBlocksCopy.some((b) => b.uid === uid))
    state.modifiedBlocksCopy.push({ uid, content: original, open: node.open, page: node.page });
  await updateBlock(uid, cleaned, node.open);
  node.content = cleaned;
  state.changesNb++;
};

export const deleteBlankChildlessBlock = async (node) => {
  const uid = node.uid;
  // node.content is kept current by every preceding operation (updated after each write).
  if (node.content.trim() !== "") return;
  const pullResult = window.roamAlphaAPI.pull(
    "[:block/string :block/order {:block/children [:block/uid]} {:block/parents [:block/uid]}]",
    [":block/uid", uid]
  );
  if (!pullResult) return; // block no longer exists
  const children = pullResult[":block/children"];
  if (children && children.length > 0) return;
  // Capture parent uid and order so undo can recreate the block at the same position.
  const parents = pullResult[":block/parents"];
  const parentUid = parents && parents.length > 0 ? parents[parents.length - 1][":block/uid"] : node.page;
  const order = pullResult[":block/order"] ?? 0;
  if (!state.modifiedBlocksCopy.some((b) => b.uid === uid))
    state.modifiedBlocksCopy.push({
      uid,
      content: node.content,
      open: node.open,
      page: node.page,
      deleted: true,
      parentUid,
      order,
    });
  state.changesNb++;
  await window.roamAlphaAPI.deleteBlock({ block: { uid } });
};

/**
 * Called by the panel's onFormatChange callback.
 * Applies heading/alignment/view/case changes to all selected nodes.
 */
export const doFormatChange = async (h, a, v, caseChange, cleanMode, styleMode, aliasMode, taskMode, removeBlank) => {
  state.changesNb = 0;
  state.formatChange = false;
  // Clear once before all sub-operations so modifiedBlocksCopy accumulates the pre-run
  // originals across every step — undo can then restore everything in one pass.
  while (state.modifiedBlocksCopy.length > 0) state.modifiedBlocksCopy.pop();

  // Build a label describing all active operations for the undo toast
  const ops = [];
  if (h !== "noChange" || a !== "noChange" || v !== "noChange") ops.push("format");
  if (caseChange !== "noChange") ops.push("case");
  if (cleanMode !== "noChange") ops.push("clean");
  if (styleMode !== "noChange") ops.push("style");
  if (aliasMode !== "noChange") ops.push("alias");
  if (taskMode !== "noChange") ops.push("task");
  if (removeBlank) ops.push("remove blank");
  state.lastOperation = ops.length > 1 ? "Format: " + ops.join(", ") : (ops[0] ?? "Format");

  if (h != "noChange" || a != "noChange" || v != "noChange") {
    state.formatChange = true;
    await _selectedNodesProcessing(
      state.expandedNodesUid,
      [h, a, v],
      changeBlockFormat,
    );
    state.formatChange = false;
  }
  if (caseChange != "noChange") {
    await caseBulkChange(caseChange, true);
  }
  if (cleanMode !== "noChange") {
    await _selectedNodesProcessing(state.expandedNodesUid, [cleanMode], cleanBlockContent);
  }
  if (styleMode !== "noChange") {
    await _selectedNodesProcessing(state.expandedNodesUid, [styleMode], styleBlockContent);
  }
  if (aliasMode !== "noChange") {
    await _selectedNodesProcessing(state.expandedNodesUid, [aliasMode], aliasBlockContent);
  }
  if (taskMode !== "noChange") {
    await _selectedNodesProcessing(state.expandedNodesUid, [taskMode], taskBlockContent);
  }
  // removeBlank runs last: other operations may have created blank blocks
  if (removeBlank) {
    await _selectedNodesProcessing(state.expandedNodesUid, [], deleteBlankChildlessBlock);
  }
  state.selectedBlocks = [];
  state.seletionBlue = false;
  _initializeGlobalVar(true);
  state.changesNbBackup = state.changesNb;
};

export const caseBulkChange = async (change, isPartOfMultiStep = false) => {
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

  // When called standalone, own the backup; when part of doFormatChange, don't wipe it.
  if (!isPartOfMultiStep)
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
  if (!isPartOfMultiStep)
    state.changesNbBackup = state.changesNb;
};
