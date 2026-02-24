import iziToast from "izitoast";
import {
  updateBlock,
  getBlockAttributes,
  normalizeInputRegex,
  getNextPositionIcon,
  getNextPosition,
  isRegex,
  getMatchesNbInBlock,
  removeDuplicateBlocks,
  resolveReferences,
} from "./utils";
import { copyMatchingUidsToClipboard } from "./copyResults";
import { infoToast } from "./notifications";
import {
  highlightNextMatch,
  actualizeHighlights,
  onKeyArrows,
  removeHighlightedNodes,
} from "./highlighting";
import { displaySearchResustsInPlainText } from "./searchDialog";
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
  position = state.iziToastPosition,
  refresh = true,
) {
  let searchLogic = "";
  let inputChanges = 0;
  if (refresh) _initializeGlobalVar();
  state.formatChange = false;
  let positionIcon = getNextPositionIcon(position);
  let excludeDuplicateBackup = state.excludeDuplicate;
  state.excludeDuplicate = true;
  let checkCase = "";
  if (caseInsensitive) checkCase = "checked";
  let checkWord = "";
  if (wordOnly) checkWord = "checked";
  let checkIncludeCollapsed = "";
  if (expandToHighlight) checkIncludeCollapsed = "checked";
  let checkWorkspace = "";
  if (workspaceArg != null) state.workspace = workspaceArg;
  if (state.workspace) checkWorkspace = "checked";
  iziToast.show({
    id: "frBox",
    position: position,
    title: label,
    //    message: "(Support regex. Click (?) for details)",
    inputs: [
      [
        '<label for="checkb1" title="Take case into account or not to test matching words">Case Insensitive  </label>',
        "change",
        function (instance, toast, input, e) {},
        false,
      ],
      [
        '<input type="checkbox" id="checkb1"' + checkCase + ">",
        "change",
        function (instance, toast, input, e) {
          caseInsensitive = input.checked;
          actualizeHighlights(
            findInput,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            searchLogic,
          );
        },
        false,
      ],
      [
        '<label for="checkb2" title="Match only entire words, not part of words.">Only words  </label>',
        "change",
        function (instance, toast, input, e) {},
        false,
      ],
      [
        '<input type="checkbox" id="checkb2"' + checkWord + ">",
        "change",
        function (instance, toast, input, e) {
          wordOnly = input.checked;
          actualizeHighlights(
            findInput,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            searchLogic,
          );
        },
        false,
      ],
      [
        '<select style="color:#FFFFFFB3" title="Search logic: search for the full string, or for words separated by a space - one OR the other"><option value="" title="full string, including spaces">full str.</option><option value="OR">OR</option></select>',
        "change",
        function (instance, toast, select, e) {
          searchLogic = select.value;
          actualizeHighlights(
            findInput,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            searchLogic,
          );
        },
        false,
      ],
      [
        '<input type="text" value="' +
          findInput +
          '" placeholder="Find... (support /regex/g, (?) for examples)" style="width:100%; color:#FFFFFFB3">',
        "keyup",
        function (instance, toast, input, e) {
          let timeout = 800;
          inputChanges++;
          let currentChange = inputChanges;
          setTimeout(() => {
            findInput = input.value;
            let length = input.value.length;
            if (
              length > 1 &&
              (findInput.indexOf("/") != 0 || isRegex(findInput))
            ) {
              if (length > 2) timeout = 100;
              if (inputChanges === currentChange) {
                inputChanges++;
                actualizeHighlights(
                  findInput,
                  caseInsensitive,
                  wordOnly,
                  expandToHighlight,
                  searchLogic,
                );
              }
            }
          }, timeout);
        },
        true,
      ],
      [
        '<input type="text" value="' +
          replaceInput +
          '" placeholder="Replace by... blank=delete, $RegEx=match" style="width:100%; color:#FFFFFFB3">',
        "keydown",
        function (instance, toast, input, e) {
          setTimeout(() => {
            replaceInput = input.value;
            //promptParameters[1] = replaceInput;
          }, 300);
        },
      ],
      [
        '<label for="checkb3" title="Expand collapsed blocks with matching strings">Auto-expand blocks </label>',
        "change",
        function (instance, toast, input, e) {},
        false,
      ],
      [
        '<input type="checkbox" id="checkb3"' + checkIncludeCollapsed + ">",
        "change",
        async function (instance, toast, input, e) {
          expandToHighlight = input.checked;
          actualizeHighlights(
            findInput,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            searchLogic,
          );
        },
        false,
      ],
      [
        '<label for="checkb4" title="Search in the whole state.workspace: Page + Linked references + Right sidebar">Workspace  </label>',
        "change",
        function (instance, toast, input, e) {},
        false,
      ],
      [
        '<input type="checkbox" id="checkb4"' + checkWorkspace + ">",
        "change",
        async function (instance, toast, input, e) {
          state.workspace = input.checked;
          actualizeHighlights(
            findInput,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            searchLogic,
          );
        },
        false,
      ],
    ],
    buttons: [
      [
        "<button>▲</button>",
        function (instance, toast, button, e) {
          highlightNextMatch(-1, toast);
          _displayMatchCountInTitle(toast);
        },
      ],
      [
        "<button>▼</button>",
        function (instance, toast, button, e) {
          highlightNextMatch(1, toast);
          _displayMatchCountInTitle(toast);
        },
      ],
      [
        "<button>Replace</button>",
        async function (instance, toast, button, e) {
          if (state.changesNb == 0 && state.changesNbBackup == 0) {
            while (state.modifiedBlocksCopy.length > 0) {
              state.modifiedBlocksCopy.pop();
            }
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
          let replacingStr = item.strToReplace.replace(
            promptParameters[0],
            replaceInput,
          );
          console.log("replacingStr :>> ", replacingStr);
          item.replaced = true;
          if (matchesInBlock > 1) {
            let backupSimpleChangesNb = state.changesNbBackup;
            actualizeHighlights(
              findInput,
              caseInsensitive,
              wordOnly,
              expandToHighlight,
              searchLogic,
            );
            state.changesNbBackup = backupSimpleChangesNb;
          } else
            lastElt.parentNode.replaceChild(
              document.createTextNode(replacingStr),
              lastElt,
            );
          _displayMatchCountInTitle(toast);
          if (nbElts > 1) highlightNextMatch(1, toast);
          state.changesNb++;
        },
      ],
      [
        "<button><b>Replace all</b></button>",
        async function (instance, toast, button, e, inputs) {
          let promptParameters = normalizeInputRegex(
            findInput,
            replaceInput,
            caseInsensitive,
            wordOnly,
            searchLogic,
          );
          if (promptParameters != null) {
            state.lastOperation = "Find and Replace";

            if (state.changesNb == 0 && state.changesNbBackup == 0)
              while (state.modifiedBlocksCopy.length > 0) {
                state.modifiedBlocksCopy.pop();
              }
            state.changesNb = 0;
            let nodesToProcess = [];
            nodesToProcess = state.expandedNodesUid.concat(
              state.referencedNodesUid,
            );
            if (state.includeCollapsed)
              nodesToProcess = nodesToProcess.concat(state.collapsedNodesUid);
            nodesToProcess = removeDuplicateBlocks(nodesToProcess);
            //  console.log("Nodes to process");
            //  console.log(nodesToProcess);
            state.changesNb += state.changesNbBackup;
            await _selectedNodesProcessing(
              nodesToProcess,
              promptParameters,
              replaceOpened,
            );
            // undoPopup(state.changesNb);
            state.changesNbBackup = state.changesNb;
          }
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
        false,
      ],
      [
        "<button>Close</button>",
        function (instance, toast, button, e) {
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
      ],
      [
        "<button title='Refresh search on page'>↻</button>",
        function (instance, toast, button, e) {
          actualizeHighlights(
            findInput,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            searchLogic,
          );
        },
      ],
      [
        "<button title='See in plain text blocks containing matching strings (or the strings only), in a dialog box'>🔎︎</button>",
        function (instance, toast, button, e) {
          let promptParameters = normalizeInputRegex(
            findInput,
            replaceInput,
            caseInsensitive,
            wordOnly,
            searchLogic,
          );
          displaySearchResustsInPlainText(promptParameters, findInput);
        },
      ],
      [
        "<button title='Copy in Clipboard block refs of blocks containing matching strings (or only them)'>((📋))</button>",
        function (instance, toast, button, e) {
          let promptParameters = normalizeInputRegex(
            findInput,
            replaceInput,
            caseInsensitive,
            wordOnly,
            searchLogic,
          );
          let searchString = promptParameters[0];
          if (!findInput.includes("/")) searchString = findInput;
          let replaceString = promptParameters[1];
          if (!replaceInput.includes("/")) replaceString = replaceInput;
          copyMatchingUidsToClipboard(
            state.matchArray,
            searchString,
            caseInsensitive,
            state.showPath,
            replaceString,
            "page",
            isRegex(findInput) && state.extractMatchesOnly,
          );
          if (state.matchArray.length > 0)
            infoToast(
              (state.changesNb ||
                state.matchArray.length ||
                state.matchingStringsArray.length) +
                " blocks or strings copied in the clipboard. Paste them anywhere in your graph!",
            );
        },
      ],
      [
        "<button title='Move search box to the next position'>" +
          positionIcon +
          "</button>",
        function (instance, toast, button, e, inputs) {
          window.removeEventListener("keydown", onKeyArrows);
          position = getNextPosition(position);
          findAndReplace(
            _getCurrentToastLabel(toast),
            findInput,
            replaceInput,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            state.workspace,
            position,
            false,
          );
        },
      ],
      [
        "<button>❔</button>",
        function (instance, toast, button, e) {
          _helpToast();
        },
      ],
    ],
    onOpened: function (instance, toast) {
      state.currentToast = toast;
      window.addEventListener("keydown", onKeyArrows);
      if (findInput != "" && findInput.length > 1 && refresh) {
        actualizeHighlights(
          findInput,
          caseInsensitive,
          wordOnly,
          expandToHighlight,
          searchLogic,
        );
      }
    },
    onClosing: function (instance, toast, closedBy) {},
    onClosed: function (instance, toast, closedBy) {
      if (closedBy == "esc" || closedBy == "button") {
        state.inputBackup = [
          findInput,
          replaceInput,
          caseInsensitive,
          wordOnly,
          expandToHighlight,
          state.workspace,
        ];
        state.currentToast = null;
        state.changesNbBackup = state.changesNb;
        if (state.changesNb > 0) {
          _undoPopup(state.changesNb, findInput, replaceInput);
        }
        state.workspace = false;
        state.selectedBlocks = [];

        state.excludeDuplicate = excludeDuplicateBackup;
        removeHighlightedNodes();
        window.removeEventListener("keydown", onKeyArrows);
        _initializeGlobalVar(true);
      }
    },
  });
};

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
  //console.log(state.modifiedBlocksCopy);
  //let findLocal = new RegExp(param[0].source, param[0].flags);
  find.lastIndex = 0;
  matches = [...blockContent.matchAll(find)];
  let position;
  if (match.indexInBlock < matches.length)
    position = matches[match.indexInBlock].index;
  // In case of nested block ref in another blockref, only the first match can be changed currently
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
  // searchLogic != "" && node.refs != undefined
  //   ? (blockContent = resolveReferences(node.content, node.uid))
  //   : (blockContent = node.content);
  // = node.content;
  let uid = node.uid;
  let isOpened = node.open;
  if (searchLogic != "") {
    blockContent = resolveReferences(blockContent, [uid]);
    if (searchLogic == "AND") find = find.and;
  }

  // console.log(find);
  // console.log(replace);

  if (find.test(blockContent)) {
    find.lastIndex = 0;
    if (find.global) {
      let matchIterator = [...blockContent.matchAll(find)];
      // console.log(matchIterator);
      state.changesNb += matchIterator.length;
      if (reverse) {
        state.changesNb -= matchIterator.length;
        state.changesNb++;
      }
      if (!makeChange) {
        // if (node.page == undefined)
        //   node.page = getPageTitleByBlockUid(node.uid);
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
      // console.log(mFirst);
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
        if (firstRefMatch != null && firstRefMatch.index == 0) continue; // do not capitalize sentence begining by a reference
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
