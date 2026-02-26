import {
  updateBlock,
  getBlockAttributes,
  normalizeInputRegex,
  removeDuplicateBlocks,
  resolveReferences,
} from "./utils";
import { copyMatchingUidsToClipboard } from "./copyResults";
import { infoToast } from "./notifications";
import {
  highlightNextMatch,
  actualizeHighlights,
  removeHighlightedNodes,
} from "./highlighting";
import { displaySearchResustsInPlainText } from "./searchDialog";
import { openPanel, closePanel } from "./panelBridge";
import state from "./state";

// Dependencies injected from index.js to avoid circular imports
let _initializeGlobalVar,
  _displayMatchCountInTitle,
  _getCurrentToastLabel,
  _helpToast,
  _selectedNodesProcessing,
  _undoPopup,
  _referencesRegex;

export function setFindReplaceDeps({
  initializeGlobalVar,
  displayMatchCountInTitle,
  getCurrentToastLabel,
  helpToast,
  selectedNodesProcessing,
  undoPopup,
  referencesRegex,
}) {
  _initializeGlobalVar = initializeGlobalVar;
  _displayMatchCountInTitle = displayMatchCountInTitle;
  _getCurrentToastLabel = getCurrentToastLabel;
  _helpToast = helpToast;
  _selectedNodesProcessing = selectedNodesProcessing;
  _undoPopup = undoPopup;
  _referencesRegex = referencesRegex;
}

/******************************************************************************************
/*	Find and Replace (supporting regular expressions) (fre)
*****************************************************************************************/
export const findAndReplace = async function (
  label,
  findInput = "",
  replaceInput = "",
  caseInsensitive = false,
  wordOnly = false,
  expandToHighlight = false,
  workspaceArg = false,
  position,
  refresh = true,
) {
  if (refresh) _initializeGlobalVar();
  state.formatChange = false;
  let excludeDuplicateBackup = state.excludeDuplicate;
  state.excludeDuplicate = true;
  if (workspaceArg != null) state.workspace = workspaceArg;

  // Determine scope
  const scope = state.workspace ? "workspace" : "page";

  // Restore previous inputs if available
  let fi = findInput;
  let ri = replaceInput;
  let ci = caseInsensitive;
  let wo = wordOnly;
  let ex = expandToHighlight;
  let ws = state.workspace;

  openPanel({
    mode: "findReplace",
    scope,
    label: label || "Find & Replace",
    findInput: fi,
    replaceInput: ri,
    caseInsensitive: ci,
    wordOnly: wo,
    expandToHighlight: ex,
    searchLogic: "",
  });

  if (fi !== "" && fi.length > 1 && refresh) {
    actualizeHighlights(fi, ci, wo, ex, "");
  }
};

/**
 * Perform a single replacement at the current scroll index.
 * Called by UnifiedSearchPanel when "Replace" button is clicked.
 */
export const doReplace = async (findInput, replaceInput, caseInsensitive, wordOnly, searchLogic) => {
  if (!state.eltFound || state.eltFound.length === 0) return;

  if (state.changesNb == 0 && state.changesNbBackup == 0) {
    while (state.modifiedBlocksCopy.length > 0) state.modifiedBlocksCopy.pop();
  }

  let nbElts = state.eltFound.length;
  let lastElt = state.eltFound[state.scrollIndex];
  let item = state.matchArray[state.scrollIndex];
  let promptParameters = normalizeInputRegex(
    findInput,
    replaceInput,
    caseInsensitive,
    wordOnly,
    searchLogic,
  );

  let matchesInBlock = getMatchesNbInBlock(state.matchArray, item.uid);
  await replaceSelectedMatches(
    [promptParameters[0], promptParameters[1]],
    state.scrollIndex,
  );
  let replacingStr = item.strToReplace.replace(promptParameters[0], replaceInput);
  item.replaced = true;
  if (matchesInBlock > 1) {
    let backupSimpleChangesNb = state.changesNbBackup;
    actualizeHighlights(findInput, caseInsensitive, wordOnly, false, searchLogic);
    state.changesNbBackup = backupSimpleChangesNb;
  } else {
    lastElt.parentNode.replaceChild(document.createTextNode(replacingStr), lastElt);
  }
  _displayMatchCountInTitle();
  if (nbElts > 1) highlightNextMatch(1);
  state.changesNb++;
};

/**
 * Perform "Replace All" for all matches.
 * Called by UnifiedSearchPanel when "Replace all" button is clicked.
 */
export const doReplaceAll = async (findInput, replaceInput, caseInsensitive, wordOnly, searchLogic) => {
  let promptParameters = normalizeInputRegex(
    findInput,
    replaceInput,
    caseInsensitive,
    wordOnly,
    searchLogic,
  );
  if (promptParameters != null) {
    state.lastOperation = "Find and Replace";
    if (state.changesNb == 0 && state.changesNbBackup == 0) {
      while (state.modifiedBlocksCopy.length > 0) state.modifiedBlocksCopy.pop();
    }
    state.changesNb = 0;
    let nodesToProcess = state.expandedNodesUid.concat(state.referencedNodesUid);
    if (state.includeCollapsed)
      nodesToProcess = nodesToProcess.concat(state.collapsedNodesUid);
    nodesToProcess = removeDuplicateBlocks(nodesToProcess);
    state.changesNb += state.changesNbBackup;
    await _selectedNodesProcessing(nodesToProcess, promptParameters, replaceOpened);
    state.changesNbBackup = state.changesNb;
  }
};

/**
 * Handle panel close: save backup, run undo popup if changes were made.
 */
export const onFindReplaceClose = (findInput, replaceInput, caseInsensitive, wordOnly, expandToHighlight, workspace) => {
  state.inputBackup = [
    findInput,
    replaceInput,
    caseInsensitive,
    wordOnly,
    expandToHighlight,
    workspace,
  ];
  state.changesNbBackup = state.changesNb;
  if (state.changesNb > 0) {
    _undoPopup(state.changesNb, findInput, replaceInput);
  }
  state.workspace = false;
  state.selectedBlocks = [];
  removeHighlightedNodes();
  _initializeGlobalVar(true);
};

// Helper used by doReplace
function getMatchesNbInBlock(matchArray, uid) {
  return matchArray.filter((m) => m.uid === uid && !m.replaced).length;
}

export const replaceSelectedMatches = async function (param, i) {
  let find = param[0];
  let replace = param[1];
  let blockContent = "";
  let length = state.matchArray.length;
  let matches = [];
  let match = state.matchArray[i];
  let uid = match.uid;
  if (match.blockRef != null) uid = match.blockRef;
  let attr = getBlockAttributes(uid);
  blockContent = attr.string;

  state.modifiedBlocksCopy.push({
    uid: uid,
    content: blockContent,
    open: attr.open,
    page: attr.page,
  });
  find.lastIndex = 0;
  matches = [...blockContent.matchAll(find)];
  let position;
  if (match.indexInBlock < matches.length)
    position = matches[match.indexInBlock].index;
  else position = matches[0].index;
  let replacedContent = "";
  if (
    replace.search(/\$regex/i) == -1 &&
    replace.search(/\$1/) == -1 &&
    replace.search(/\$2/) == -1
  ) {
    replacedContent = blockContent
      .slice(position)
      .replace(match.strToReplace, replace);
    blockContent = blockContent.slice(0, position) + replacedContent;
  } else {
    if (position != 0) {
      replacedContent = blockContent.substring(0, position) || "";
    }
    replacedContent +=
      regexVarInsert(matches[match.indexInBlock], replace, blockContent) || "";
    let lastIndex = position + matches[match.indexInBlock][0].length;
    if (lastIndex < blockContent.length) {
      replacedContent += blockContent.substring(lastIndex) || "";
    }
    blockContent = replacedContent;
  }
  let isAnotherUid = true;
  if (i < length - 1) {
    let nextMatch = state.matchArray[i + 1];
    isAnotherUid = uid != nextMatch.uid || !nextMatch.replaced;
  }
  if (i === length - 1 || isAnotherUid) {
    await updateBlock(uid, blockContent, attr.open);
  }
};


export const replaceOpened = async (
  node,
  find,
  replace,
  searchLogic = "",
  makeChange = true,
  reverse = false,
) => {
  let replacedBlock = "";
  let lastIndex = 0;
  let stringArray = [];
  let blockContent = node.content;
  let uid = node.uid;
  let isOpened = node.open;
  if (searchLogic != "") {
    blockContent = resolveReferences(blockContent, [uid]);
    if (searchLogic == "AND") find = find.and;
  }

  if (find.test(blockContent)) {
    find.lastIndex = 0;
    if (find.global) {
      let matchIterator = [...blockContent.matchAll(find)];
      state.changesNb += matchIterator.length;
      if (reverse) {
        state.changesNb -= matchIterator.length;
        state.changesNb++;
      }
      if (!makeChange) {
        if (state.extractMatchesOnly) {
          for (let i = 0; i < matchIterator.length; i++) {
            let groups = [];
            let replaceStr = replace;
            for (let j = 1; j < matchIterator[i].length; j++) {
              let group = matchIterator[i][j];
              groups.push(group);
              let placeHolder = "$" + j;
              replaceStr = replaceStr.replace(placeHolder, group);
            }
            state.matchingStringsArray.push({
              uid: node.uid,
              content: matchIterator[i][0],
              groups: groups,
              replace: replaceStr,
              page: node.page,
            });
          }
        }
        state.matchArray.push({
          uid: uid,
          content: node.content,
          open: isOpened,
          page: node.page,
        });
        return;
      }

      if (
        replace.search(/\$regex/i) == -1 &&
        replace.search(/\$1/) == -1 &&
        replace.search(/\$2/) == -1
      ) {
        replacedBlock = blockContent.replace(find, replace);
      } else {
        for (const m of matchIterator) {
          if (m.index != 0 || reverse) {
            stringArray.push(blockContent.substring(lastIndex, m.index));
          }
          if (!reverse)
            stringArray.push(regexVarInsert(m, replace, blockContent));
          else {
            let last = stringArray.length - 1;
            stringArray[last] = regexVarInsert(
              [stringArray[last]],
              replace,
              blockContent,
            );
            stringArray.push(
              blockContent.substring(m.index, m.index + m[0].length),
            );
          }
          lastIndex = m.index + m[0].length;
        }
        if (lastIndex < blockContent.length - 1) {
          let end = blockContent.substring(lastIndex);
          if (!reverse) stringArray.push(end);
          else stringArray.push(regexVarInsert([end], replace, blockContent));
        }
        replacedBlock = stringArray.join("");
      }
    } else {
      const mFirst = blockContent.match(find);
      if (
        replace.search(/\$regex/i) == -1 &&
        replace.search(/\$1/) == -1 &&
        replace.search(/\$2/) == -1
      ) {
        replacedBlock = blockContent.replace(find, replace);
      } else {
        if (mFirst.index != 0) {
          replacedBlock = blockContent.substring(0, mFirst.index);
        }
        replacedBlock += regexVarInsert(mFirst, replace, blockContent);
        lastIndex = mFirst.index + mFirst[0].length;
        if (lastIndex < blockContent.length - 1) {
          replacedBlock += blockContent.substring(lastIndex);
        }
      }
      state.changesNb++;
    }
    let push = true;
    if (state.changesNbBackup > 0)
      push = state.modifiedBlocksCopy.filter((b) => b.uid === uid) == 0;
    if (push)
      state.modifiedBlocksCopy.push({
        uid: uid,
        content: blockContent,
        open: isOpened,
        page: node.page,
      });
    await updateBlock(uid, replacedBlock, isOpened);
  } else if (reverse) {
    await replaceOpened(node, /.*/g, replace);
  }
};

export const regexVarInsert = function (match, replace, blockContent) {
  let indexOfRegex = replace.search(/\$regexw?s?/i);
  let isWholeBlock = blockContent.length == match[0].length;

  if (
    isWholeBlock &&
    indexOfRegex == 0 &&
    (replace.length == 6 || replace == "$RegexW" || replace == "$RegexS")
  ) {
    return regexFormat(replace, blockContent);
  } else {
    let indexOfV1 = replace.search(/\$1/);
    let indexOfV2 = replace.search(/\$2/);
    let stringToInsert = replace;
    let replaceSplit = "";
    let regexWriting = "";

    if (indexOfRegex != -1) {
      let regexLength = 6;
      if (replace == "$RegexW" || replace == "$RegexS") regexLength++;
      regexWriting = replace.substring(
        indexOfRegex,
        indexOfRegex + regexLength,
      );
      replaceSplit = replace.split(regexWriting);
      stringToInsert = regexFormat(regexWriting, match[0]);
      stringToInsert = replaceSplit[0] + stringToInsert + replaceSplit[1];
    }
    if (indexOfV1 != -1) {
      replaceSplit = stringToInsert.split("$1");
      stringToInsert = replaceSplit[0];
      let i = 1;
      while (i < replaceSplit.length) {
        stringToInsert += match[1] + replaceSplit[i++];
      }
    }
    if (indexOfV2 != -1) {
      replaceSplit = stringToInsert.split("$2");
      stringToInsert = replaceSplit[0];
      let i = 1;
      while (i < replaceSplit.length) {
        stringToInsert += match[2] + replaceSplit[i++];
      }
    }
    return stringToInsert;
  }
};

export const regexFormat = (regexW, strMatch) => {
  let strIns = "";
  switch (regexW) {
    case "$RegEx":
      strIns = strMatch;
      break;
    case "$REGEX":
      strIns = strMatch.toUpperCase();
      break;
    case "$regex":
      strIns = strMatch.toLowerCase();
      break;
    case "$Regex":
      strIns = strMatch.charAt(0).toUpperCase() + strMatch.slice(1);
      break;
    case "$RegexW":
      let words = [...strMatch.matchAll(/[a-zA-ZÀ-ž]+/g)];
      for (let i = 0; i < words.length; i++) {
        let capitalizedWord =
          words[i][0].charAt(0).toUpperCase() + words[i][0].slice(1);
        strMatch = strMatch.replace(words[i][0], capitalizedWord);
      }
      strIns = strMatch;
      break;
    case "$RegexS":
      let sentences = [
        ...strMatch.matchAll(
          /[a-zA-ZÀ-ž\[\(][a-zA-ZÀ-ž\#\[\]\(\)\{\}\@\-\*\$:;=><\s]+?[\.\?\!\n]|[a-zA-ZÀ-ž\[\(][a-zA-ZÀ-ž\#\[\]\(\)\{\}\@\-\*\$:;=><\s]+$/g,
        ),
      ];
      for (let i = 0; i < sentences.length; i++) {
        let sentence = sentences[i][0];
        const firstRefMatch = _referencesRegex.exec(sentence);
        if (firstRefMatch != null && firstRefMatch.index == 0) continue;
        let capitalizedSentence =
          sentence.charAt(0).toUpperCase() + sentence.slice(1);
        strMatch =
          strMatch.substring(0, sentences[i].index) +
          capitalizedSentence +
          strMatch.substring(sentences[i].index + capitalizedSentence.length);
      }
      strIns = strMatch;
      break;
    default:
      strIns = strMatch;
      break;
  }
  return strIns;
};
