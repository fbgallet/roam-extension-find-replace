import iziToast from "izitoast";
import {
  updateBlock,
  getBlockContentByUid,
  getPageUidByPageName,
  normalizeInputRegex,
  getNextPositionIcon,
  getNextPosition,
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
import React from "react";
import BlockResultsList from "./components/BlockResultsList";
import PageNamesList from "./components/PageNamesList";

// Dependencies injected from index.js to avoid circular imports
let _initializeGlobalVar,
  _helpToast,
  _replaceOpened,
  _highlightString,
  _highlightAllMatches,
  _undoPopup,
  _pageBlockConversionInstructions;

export function setWholeGraphDeps({
  initializeGlobalVar,
  helpToast,
  replaceOpened,
  highlightString,
  highlightAllMatches,
  undoPopup,
  pageBlockConversionInstructions,
}) {
  _initializeGlobalVar = initializeGlobalVar;
  _helpToast = helpToast;
  _replaceOpened = replaceOpened;
  _highlightString = highlightString;
  _highlightAllMatches = highlightAllMatches;
  _undoPopup = undoPopup;
  _pageBlockConversionInstructions = pageBlockConversionInstructions;
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
  moveContent = false,
  position = state.iziToastPosition,
  refresh = true,
) {
  if (refresh) _initializeGlobalVar();
  // state.changesNb = 0;
  // state.matchingTotal = 0;
  // state.matchArray = [];
  state.formatChange = false;
  let positionIcon = getNextPositionIcon(position);
  let excludeDuplicateBackup = state.excludeDuplicate;
  state.excludeDuplicate = true;
  let searchLogic = "";
  let checkCase = "";
  if (caseInsensitive) checkCase = "checked";
  let checkWord = "";
  if (wordOnly) checkWord = "checked";
  let checkMove = "";
  if (moveContent) checkMove = "checked";
  let inputField = "text";
  let caseField = "checkbox";
  let wordField = "checkbox";
  let hideCaseLabel = "";
  let hideWordLabel = "";
  let hideButton = "";
  let moveField = "hidden";
  let hideMoveLabel = "hidden";
  let inputPlaceholder = "Find... (support /regex/g, '?' for examples)";
  let replacePlaceholder = "Replace by... blank=delete, $RegEx=match";
  if (mode.includes("block")) {
    caseField = wordField = hideCaseLabel = hideWordLabel = "hidden";
    moveField = "checkbox";
    hideMoveLabel = "";
  }
  let msg = "Danger zone! Check the affected blocks first 🔎︎";
  let msgColor = "#ff7878"; // red
  let ANDsearchOption = "";
  switch (mode) {
    case "replace page names":
      inputPlaceholder = "Pattern as string or /regex(capture gr.)/";
      replacePlaceholder = "String replacing pattern or capture group";
      break;
    case "page to block":
      inputPlaceholder = "Page name: [[page]] or page";
      replacePlaceholder = "Block ref: ((uid)) or uid, or DNP";
      break;
    case "block to page":
      inputPlaceholder = "Source block reference: ((uid)) or uid";
      replacePlaceholder = "Target page name: [[page]] or page";
      break;
    case "search":
      inputField = "hidden";
      hideButton = "display:none;";
      ANDsearchOption = '<option value="AND">AND</option>';
      msg =
        "🔎︎ to show results as plain text, 🔎︎◨ to open them in sidebar, ((📋)) to copy block refences to clipboard.";
      msgColor = "#ffffffb3";
      break;
    case "replace":
      break;
  }
  iziToast.show({
    id: "frBox",
    message: msg,
    messageColor: msgColor,
    position: position,
    title: label,
    maxWidth: 420,
    inputs: [
      [
        '<label for="checkb1"' + hideCaseLabel + ">Case Insensitive  </label>",
        "change",
        function (instance, toast, input, e) {},
        false,
      ],
      [
        '<input type="' + caseField + '" id="checkb1"' + checkCase + ">",
        "change",
        function (instance, toast, input, e) {
          caseInsensitive = input.checked;
          _initializeGlobalVar();
        },
        false,
      ],
      [
        '<label for="checkb2"' + hideWordLabel + ">Only words  </label>",
        "change",
        function (instance, toast, input, e) {},
        false,
      ],
      [
        '<input type="' + wordField + '" id="checkb2"' + checkWord + ">",
        "change",
        function (instance, toast, input, e) {
          wordOnly = input.checked;
          _initializeGlobalVar();
        },
        false,
      ],
      [
        '<select style="color:#FFFFFFB3" title="Search logic: search for the full string, or for words separated by a space - one OR the other, one AND the other in the block"><option value="" title="full string, including spaces">full str.</option><option value="OR">OR</option>' +
          ANDsearchOption +
          "</select>",
        "change",
        function (instance, toast, select, e) {
          _initializeGlobalVar();
          searchLogic = select.value;
          if (searchLogic === "AND+") {
            state.ANDwithChildren = true;
            searchLogic = "AND";
          } else state.ANDwithChildren = false;
        },
        false,
      ],
      [
        '<input type="text" value="' +
          findInput +
          '" placeholder="' +
          inputPlaceholder +
          '" style="width:100%; color:#FFFFFFB3">',
        "keyup",
        function (instance, toast, input, e) {
          setTimeout(() => {
            findInput = input.value;
            _initializeGlobalVar();
            if (mode == "block to page") {
              let uid = normalizeMention(findInput, "block");
              if (uid != null) {
                let blockContent =
                  "[[" + getBlockContentByUid(uid.slice(2, -2)) + "]]";
                document.querySelectorAll(
                  "input.iziToast-inputs-child",
                )[3].value = blockContent;
                replaceInput = blockContent;
              }
            }
          }, 10);
        },
        true,
      ],
      [
        '<input type="' +
          inputField +
          '" value="' +
          replaceInput +
          '" placeholder="' +
          replacePlaceholder +
          '" style="width:100%; color:#FFFFFFB3">',
        "keydown",
        function (instance, toast, input, e) {
          setTimeout(() => {
            replaceInput = input.value;
            _initializeGlobalVar();
          }, 10);
        },
      ],
      [
        '<label for="checkb3" title="Move child blocks from source to target"' +
          hideMoveLabel +
          ">Move source content  </label>",
        "change",
        function (instance, toast, input, e) {},
        false,
      ],
      [
        '<input type="' + moveField + '" id="checkb3"' + checkMove + ">",
        "change",
        async function (instance, toast, input, e) {
          moveContent = input.checked;
          console.log(moveContent);
        },
        false,
      ],
    ],
    buttons: [
      [
        "<button title='See the list of blocks containing matching strings (or the strings only) in plain text, in a dialog box.'>🔎︎</button>",
        async function (instance, toast, button, e) {
          let promptParameters = normalizeInputRegex(
            findInput,
            replaceInput,
            caseInsensitive,
            wordOnly,
            searchLogic,
            false,
            mode === "replace page names" ? false : true,
          );
          if (findInput.length > 0) {
            if (mode === "replace page names") {
              wholeGraphPageNameProcessing(promptParameters, false, toast);
              label = displayWholeGraphCountInTitle(
                toast,
                state.changesNb + " matching [[page names]]",
              );
              if (state.matchArray.length > 0)
                displayPageNamesResults(...promptParameters, toast);
            } else {
              await wholeGraphProcessing(promptParameters, false, toast);
              label = displayWholeGraphCountInTitle(toast);
              if (state.matchArray.length > 0) {
                displayResultsInPlainText(
                  state.matchArray.length +
                    " blocks in your graph containing matching strings",
                  promptParameters,
                  findInput,
                );
              }
            }
          }
        },
      ],
      [
        "<button title='Open in sidebar the list of blocks containing matching strings'>🔎︎◨</button>",
        async function (instance, toast, button, e) {
          let promptParameters = normalizeInputRegex(
            findInput,
            replaceInput,
            caseInsensitive,
            wordOnly,
            searchLogic,
            false,
            mode === "replace page names" ? false : true,
          );
          if (findInput.length > 0) {
            if (mode === "replace page names") {
              wholeGraphPageNameProcessing(promptParameters, false, toast);
              label = displayWholeGraphCountInTitle(
                toast,
                state.changesNb + " matching [[page names]]",
              );
            } else {
              await wholeGraphProcessing(promptParameters, false, toast);
              label = displayWholeGraphCountInTitle(toast);
            }
            let searchString = promptParameters[0];
            if (!findInput.includes("/")) searchString = findInput;
            let replaceString = promptParameters[1];
            if (!replaceInput.includes("/")) replaceString = replaceInput;
            let title = "Matching blocks for search on: `" + findInput + "`";
            if (mode === "replace page names")
              title = title.replace("blocks", "page names");
            if (state.matchArray.length > 0)
              if (state.matchArray.length < 200)
                displayChangedBlocks(true, title, mode, false, findInput);
              else {
                errorToast(
                  "More than 200 results, narrow down your search! Click on 🔎︎ to see the list in plain text.",
                );
              }
          }
        },
      ],
      [
        "<button title='Copy in Clipboard block refs of blocks containing matching strings (or only them)'>((📋))</button>",
        async function (instance, toast, button, e) {
          let promptParameters = normalizeInputRegex(
            findInput,
            replaceInput,
            caseInsensitive,
            wordOnly,
            searchLogic,
            false,
            mode === "replace page names" ? false : true,
          );
          if (findInput.length > 0) {
            if (mode === "replace page names") {
              wholeGraphPageNameProcessing(promptParameters, false, toast);
              label = displayWholeGraphCountInTitle(
                toast,
                state.changesNb + " matching [[page names]]",
              );
            } else {
              await wholeGraphProcessing(promptParameters, false);
              label = displayWholeGraphCountInTitle(toast);
            }
            let searchString = promptParameters[0];
            if (!findInput.includes("/")) searchString = findInput;
            let replaceString = promptParameters[1];
            if (!replaceInput.includes("/")) replaceString = replaceInput;
            if (state.matchArray.length < 200) {
              if (mode === "replace page names") {
                copyMatchingPagesToClipbard();
              } else
                copyMatchingUidsToClipboard(
                  state.matchArray,
                  searchString,
                  caseInsensitive,
                  state.showPath,
                  replaceString,
                  "whole graph",
                  isRegex(findInput) && state.extractMatchesOnly,
                );
              if (state.matchArray.length > 0)
                infoToast(
                  state.matchArray.length +
                    " items copied in the clipboard. Paste them anywhere in your graph!",
                );
            } else {
              errorToast(
                "More than 200 block references to copy, narrow down your search! Click on 🔎︎ to see the list in plain text.",
              );
              console.log(state.matchArray);
            }
          }
        },
      ],
      [
        "<button style='color:red; " + hideButton + "'><b>Replace</b></button>",
        async function (instance, toast, button, e, inputs) {
          let thisToast = { instance: instance, toast: toast };
          let promptParameters = normalizeInputRegex(
            findInput,
            replaceInput,
            caseInsensitive,
            wordOnly,
            searchLogic,
            false,
            mode === "replace page names" ? false : true,
          );
          if (findInput.length > 0)
            switch (mode) {
              case "replace page names":
                wholeGraphPageNameProcessing(promptParameters, false, toast);
                if (state.matchArray.length > 0) {
                  displayPageNamesResults(...promptParameters, toast);
                }
                break;
              case "replace":
                state.lastOperation = "Find and Replace";
                warningPopupWholeGraph(
                  promptParameters[0],
                  promptParameters[1],
                  mode,
                  false,
                  thisToast,
                );
                break;
              case "block to page":
                let normalizedFind = normalizeMention(findInput, "block");
                if (normalizedFind === null) {
                  errorToast(
                    "Incorrect block reference. Copy/past it from the original block by pressing Ctrl+Shift+c.",
                  );
                  return;
                } else findInput = normalizedFind;
                state.lastOperation = mode;
                warningPopupWholeGraph(
                  findInput,
                  replaceInput,
                  mode,
                  moveContent,
                  thisToast,
                );
                break;
              case "page to block":
                let normalizedReplace = normalizeMention(replaceInput, "block");
                if (normalizedReplace === null) {
                  if (
                    replaceInput == "" ||
                    replaceInput.toLocaleLowerCase() == "dnp"
                  ) {
                    replaceInput = await createBlockOnDNP();
                    infoToast(
                      "The converted block will be created as the last block of Today's page.",
                    );
                  } else {
                    errorToast(
                      "Incorrect block reference. Copy/past it from the original block by pressing Ctrl+Shift+c.",
                    );
                    return;
                  }
                } else replaceInput = normalizedReplace;
                state.lastOperation = mode;
                warningPopupWholeGraph(
                  findInput,
                  replaceInput,
                  mode,
                  moveContent,
                  thisToast,
                );
            }
          //   }
          // instance.hide({ transitionOut: "fadeOut" }, toast, "button");
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
        "<button title='Move search box to the next position'>" +
          positionIcon +
          "</button>",
        function (instance, toast, button, e, inputs) {
          findAndReplaceInWholeGraph(
            label,
            mode,
            findInput,
            replaceInput,
            caseInsensitive,
            wordOnly,
            position,
            getNextPosition(position),
            false,
          );
        },
      ],
      [
        "<button>❔</button>",
        function (instance, toast, button, e) {
          if (mode == "block to page" || mode == "page to block")
            _helpToast("Warning!", _pageBlockConversionInstructions);
          else _helpToast();
        },
      ],
    ],
    onOpened: function (instance, toast) {},
    onClosing: function (instance, toast, closedBy) {},
    onClosed: function (instance, toast, closedBy) {
      if (closedBy == "esc" || closedBy == "button") {
        _initializeGlobalVar();
        state.inputBackup = [
          findInput,
          replaceInput,
          caseInsensitive,
          wordOnly,
          moveContent,
        ];
      }
    },
  });
};

export const displayResultsInPlainText = (
  dialogCaption,
  promptParameters,
  findInput,
) => {
  let treeArray;
  const isMatchesOnly = state.extractMatchesOnly && isRegex(findInput);

  if (isMatchesOnly) {
    if (state.matchingStringsArray[0].groups.length > 0) {
      state.matchingStringsArray.forEach((match) => {
        match.replace && (match.content = match.replace);
      });
    }

    treeArray = groupMatchesByPage(state.matchingStringsArray);

    dialogCaption = "matching strings in your graph";
  } else {
    treeArray = groupMatchesByPage(state.matchArray);
  }
  state.resultsJSX = (
    <BlockResultsList
      treeArray={treeArray}
      promptParameters={promptParameters}
      isMatchesOnly={isMatchesOnly}
      onHighlight={_highlightString}
      onHighlightAll={_highlightAllMatches}
    />
  );
  state.dialogTitle = <h4>{dialogCaption}:</h4>;
  state.handleSubmit = () => {
    navigator.clipboard.writeText(state.textToCopy);
  };
  state.submitParams = [];
  displayForm("Copy to clipboard");
};

const displayPageNamesResults = (find, replace, toast) => {
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
      toast,
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
  mainToast = null,
  arrayToProcess,
) => {
  let title = "Replace a given string in the whole graph ";
  let findRegex = find;
  let inputs;
  switch (mode) {
    case "replace page names":
      title = "Replacing patterns in [[page names]] ";
      state.changesNb = arrayToProcess.length;
      break;
    case "block to page":
      title = "Convert a block in a page ";
      inputs = normalizeInputRegex(find, replace);
      findRegex = inputs[0];
      replace = inputs[1];
      break;
    case "page to block":
      title = "Convert a page in a block ";
      findRegex = getPageMentionRegex(find);
  }
  if (mode !== "replace page names")
    await wholeGraphProcessing([findRegex, replace], false);
  if (mode === "block to page" || mode === "page to block") state.changesNb++;
  if (state.changesNb === 0) {
    errorToast(
      "0 matching block in the graph, try again with another block or page reference",
    );
    return;
  }
  iziToast.warning({
    timeout: 20000,
    id: "warning",
    zindex: 999,
    maxWidth: 520,
    title: state.changesNb + " matches have been found !",
    message:
      "<br>" +
      title +
      "is a very dangerous operation and can have unintended consequences. <br><br>" +
      "Do you confirm that you want to replace '" +
      find +
      "' by '" +
      replace +
      "' ?",
    position: "center",
    overlay: true,
    color: "rgb(255, 120, 120, 0.8)",
    drag: false,
    close: true,
    buttons: [
      [
        "<button>Yes I know what I do</button>",
        async (instance, toast) => {
          while (state.modifiedBlocksCopy.length > 0) {
            state.modifiedBlocksCopy.pop();
          }
          switch (mode) {
            case "replace page names":
              await wholeGraphPageNameProcessing(
                [find, replace],
                true,
                toast,
                arrayToProcess,
              );
              break;
            case "block to page":
              await changeBlockToPage(find, replace, moveContent);
              break;
            case "page to block":
              await changePageToBlock(find, replace, moveContent);
              break;
            default:
              await wholeGraphProcessing([find, replace], true);
          }
          state.changesNbBackup = state.changesNb;
          mainToast?.instance?.hide(
            { transitionOut: "fadeOut" },
            mainToast.toast,
            "button",
          );
          _undoPopup(state.changesNb, find, replace);
          state.changesNb;
          instance?.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
        false,
      ],
      [
        "<button>No, cancel and check more carefully</button>",
        (instance, toast) => {
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
        true,
      ],
    ],
  });
};

const wholeGraphProcessing = async (
  promptParameters,
  makeChanges = true,
  toast = null,
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
    //console.log(all);
    const totalBlocksNb = all.length;
    // infoToast(
    //   "Searching in the whole graph (it can takes a few seconds if there is a lot of blocks)...",
    //   totalBlocksNb / 15
    // );
    // console.log(totalBlocksNb + " blocks to process");
    let ratio = 10;
    for (let i = 0; i < totalBlocksNb; i++) {
      // TODO : progress indicator, needed for large graph
      // const ratioCst = ratio;
      // if (i > totalBlocksNb * (ratioCst / 100)) {
      //   if (toast != null)
      //     displayWholeGraphCountInTitle(
      //       toast,
      //       "Processing... (" + ratioCst + "%)"
      //     );
      //   console.log("Processing... (" + ratioCst + "%)");
      //   ratio = ratioCst + 10;
      // }
      if (all[i].text != "") {
        let node = new Node(all[i].uid, {
          string: all[i].text,
          page: all[i].page,
        });
        await _replaceOpened(node, find, replace, searchLogic, makeChanges);
      }
    }
    //toast.instance.hide({ transitionOut: "fadeOut" }, toast.toast);
  } else if (makeChanges) {
    state.changesNb = 0;
    // toast = infoToast(
    //   "Processing the whole graph (it can takes a few seconds if there is a lot of blocks)..."
    // );

    for (const match of state.matchArray) {
      let node = new Node(match.uid, {
        string: match.content,
        open: match.open,
        page: match.page,
      });
      await _replaceOpened(node, find, replace, "", makeChanges);
    }
    //toast.instance.hide({ transitionOut: "fadeOut" }, toast.toast, "button");
  }
  //console.log(state.matchArray);
};

const wholeGraphPageNameProcessing = async (
  promptParameters,
  makeChanges = true,
  toast = null,
  arrayToProcess,
) => {
  let findRegex = promptParameters[0];
  let replace = promptParameters[1];
  let searchLogic = "";
  if (promptParameters.length > 2) {
    searchLogic = promptParameters[2];
  }
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
    //toast.hide({ transitionOut: "fadeOut" }, toast.toast, "button");
  }
  //console.log(state.matchArray);
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
