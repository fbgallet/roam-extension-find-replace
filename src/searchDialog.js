import iziToast from "izitoast";
import {
  normalizeInputRegex,
  getNextPositionIcon,
  getNextPosition,
  isRegex,
  removeDuplicateBlocks,
} from "./utils";
import { copyMatchingUidsToClipboard } from "./copyResults";
import { infoToast } from "./notifications";
import {
  onKeyArrows,
  actualizeHighlights,
  highlightCurrentSearch,
  highlightNextMatch,
  removeHighlightedNodes,
} from "./highlighting";
import { displayResultsInPlainText } from "./wholeGraph";
import { getNodes } from "./nodeTraversal";
import state from "./state";

// Dependencies injected from index.js to avoid circular imports
let _initializeGlobalVar,
  _findAndReplace,
  _selectedNodesProcessing,
  _replaceOpened,
  _displayMatchCountInTitle,
  _getCurrentToastLabel;

export function setSearchDialogDeps({
  initializeGlobalVar,
  findAndReplace,
  selectedNodesProcessing,
  replaceOpened,
  displayMatchCountInTitle,
  getCurrentToastLabel,
}) {
  _initializeGlobalVar = initializeGlobalVar;
  _findAndReplace = findAndReplace;
  _selectedNodesProcessing = selectedNodesProcessing;
  _replaceOpened = replaceOpened;
  _displayMatchCountInTitle = displayMatchCountInTitle;
  _getCurrentToastLabel = getCurrentToastLabel;
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
  position = state.iziToastPosition,
  refresh = true,
  label = "Search in page or workspace",
) {
  let checkCase = "";
  if (caseInsensitive) checkCase = "checked";
  let checkWord = "";
  if (wordOnly) checkWord = "checked";
  let checkIncludeCollapsed = "";
  if (expandToHighlight) checkIncludeCollapsed = "checked";
  let checkWorkspace = "";
  if (workspaceArg != null) state.workspace = workspaceArg;
  if (state.workspace) checkWorkspace = "checked";
  if (findInput === null) findInput = "";
  let positionIcon = getNextPositionIcon(position);
  let inputChanges = 0;
  let switchToFindAndReplace = false;
  let searchLogic = "";
  if (refresh) _initializeGlobalVar();
  iziToast.show({
    id: "searchBox",
    title: label,
    maxWidth: 400,
    position: position,
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
        '<select style="color:#FFFFFFB3" title="Search logic: search for the full string, or for words separated by a space - one OR the other, one AND the other in the block"><option value="" title="full string, including spaces">full str.</option><option value="OR">OR</option><option value="AND">AND</option><option value="AND+" title="Include first children (experimental)">AND+1</option></select>',
        "change",
        function (instance, toast, select, e) {
          searchLogic = select.value;
          if (searchLogic === "AND+") {
            state.ANDwithChildren = true;
            searchLogic = "AND";
          } else state.ANDwithChildren = false;
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
          '" placeholder="Find... (support /regex/g)" style="width:100%; color:#FFFFFFB3">',
        "keydown",
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
        "<button title='Open Find & Replace Box with current input'>⇆</button>",
        function (instance, toast, button, e, inputs) {
          window.removeEventListener("keydown", onKeyArrows);
          switchToFindAndReplace = true;
          if (state.matchingTotal != 0)
            label = _displayMatchCountInTitle(toast);
          else label = "Find & Replace in page or workspace";
          _findAndReplace(
            label,
            findInput,
            "",
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            state.workspace,
            position,
            false,
          );
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
      ],
      [
        "<button title='See in plain text blocks containing matching strings (or the strings only), in a dialog box'>🔎︎</button>",
        async function (instance, toast, button, e) {
          let promptParameters = normalizeInputRegex(
            findInput,
            "",
            caseInsensitive,
            wordOnly,
            searchLogic,
          );
          displaySearchResustsInPlainText(promptParameters, findInput);
        },
      ],
      [
        "<button title='Copy in Clipboard block refs of blocks containing matching strings (or only them)'>((📋))</button>",
        async function (instance, toast, button, e) {
          let promptParameters = normalizeInputRegex(
            findInput,
            "",
            caseInsensitive,
            wordOnly,
            searchLogic,
          );
          let searchString = promptParameters[0];
          if (!isRegex(findInput)) searchString = findInput;
          //console.log(state.matchArray);
          state.changesNbBackup = state.changesNb;
          let matchArrayBackup = state.matchArray;
          await getFullMatchArrayInPage(promptParameters);

          copyMatchingUidsToClipboard(
            state.matchArray,
            searchString,
            caseInsensitive,
            state.showPath,
            "",
            "page",
            isRegex(findInput) && state.extractMatchesOnly,
          );
          if (state.matchArray.length > 0)
            infoToast(
              state.matchArray.length +
                " blocks or strings copied in the clipboard. Paste them anywhere in your graph!",
            );
          state.changesNb = state.changesNbBackup;
          state.matchArray = matchArrayBackup;
        },
      ],
      [
        "<button title='Move search box to the next position'>" +
          positionIcon +
          "</button>",
        function (instance, toast, button, e, inputs) {
          window.removeEventListener("keydown", onKeyArrows);
          position = getNextPosition(position);

          searchOnly(
            findInput,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            state.workspace,
            position,
            false,
            _getCurrentToastLabel(toast),
          );
        },
      ],
      [
        "<button>Close</button>",
        function (instance, toast, button, e) {
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
      ],
    ],
    onOpened: function (instance, toast) {
      state.currentToast = toast;
      window.addEventListener("keydown", onKeyArrows);
      if (findInput != null && findInput.length > 1 && refresh) {
        actualizeHighlights(
          findInput,
          caseInsensitive,
          wordOnly,
          expandToHighlight,
        );
      }
    },
    onClosing: function (instance, toast, closedBy) {},
    onClosed: function (instance, toast, closedBy) {
      if (closedBy == "esc" || closedBy == "button") {
        state.lastOperation = "Search";
        state.inputBackup = [
          findInput,
          caseInsensitive,
          wordOnly,
          expandToHighlight,
          state.workspace,
        ];
        state.currentToast = null;
        if (!switchToFindAndReplace) {
          state.workspace = false;
          state.selectedBlocks = [];
          //state.seletionBlue = false;
          removeHighlightedNodes();
          window.removeEventListener("keydown", onKeyArrows);
        }
      }
    },
  });
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
) => {
  state.changesNbBackup = state.changesNb;
  let matchArrayBackup = state.matchArray;

  await getFullMatchArrayInPage(promptParameters);

  displayResultsInPlainText(
    state.matchArray.length +
      " blocks in this page or workspace containing matching strings",
    promptParameters,
    findInput,
  );
  state.changesNb = state.changesNbBackup;
  state.matchArray = matchArrayBackup;
};
