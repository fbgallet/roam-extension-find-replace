import iziToast from "izitoast";
import "../node_modules/izitoast/dist/css/iziToast.css";
import getBlockUidsReferencingBlock from "roamjs-components/queries/getBlockUidsReferencingBlock";
//import getPageTitleByBlockUid from "roamjs-components/queries/getPageTitleByBlockUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getUrl from "roamjs-components/dom/getRoamUrl";
import {
  updateBlock,
  simulateClick,
  getBlockAttributes,
  getTreeByUid,
  getPageUidByPageName,
  getBlockContentByUid,
  getParentTreeUids,
  removeDuplicateBlocks,
  getUniqueUidsArray,
  normalizeInputRegex,
  getNextPositionIcon,
  getNextPosition,
  normalizeMention,
  moveChildBlocks,
  getPageUidByNameOrCreateIt,
  groupMatchesByPage,
  resolveReferences,
  sortByPageTitle,
  sortByEditTime,
  getNowDateAndTime,
  isRegex,
  getMatchesNbInBlock,
  createBlockOnDNP,
  getArrayExcludingAnotherArray,
  getPageNameByPageUid,
  getAllBlockData,
  getPageTitleByBlockUid,
  getPlainTextOfChildren,
  getChildrenUid,
  uidRegex,
  getPagesNamesMatchingRegex,
  replaceSubstringOrCaptureGroup,
} from "./utils";
import { displayForm } from "./formDialog";

const referencesRegexStr =
  "/\\(\\([^\\)]{9}\\)\\)|#?\\[\\[[^[\\]]*\\]\\]|#[^\\s]*|.*::/";
// matches [[page]] (only one level) & ((uid)) to exclude them
// & #tag #[[tag]] attribut::
//"/\\(\\([^\\)]{9}\\)\\)|\\[\\[((?>[^\\[\\]]+)|(?R))*\\]\\]/" doesn't work: no recursive groups in Javascript :-( !
const referencesRegex = new RegExp(referencesRegexStr, "g");

const sipLabel =
  "Find & Replace: Search in page, blocks selection or workspace (sip)";
const frpLabel = "Find & Replace: in Page zoom or selection of blocks (frp)";
const frwLabel =
  "Find & Replace: in Workspace (Page + Sidebar + references) (frw)";
const frgLabel = "Find & Replace: Whole Graph Replace (wgr)";
const frpPageLabel = "Find & Replace: Bulk change of [[page names]]";
const swgLabel = "Whole Graph search (wgs)";
const ptobLabel = "Page ⇒ Block conversion (pbc)";
const btopLabel = "Block ⇒ Page conversion (bpc)";
const formLabel = "Find & Replace: Bulk change format of selected blocks (bcf)";
const examplesOfRegex =
  "Regex have to be written between /slashes/ with simple \\backslash before special character to escape. /g flag for global search is set by default.<br><br>" +
  "<strong>In Find field:</strong><br>" +
  "- <code>/words?/</code>, matches all 'word' (singular) or 'words' (plural) occurences, <br>" +
  "- <code>/sk(y|ies)/</code>, matches all 'sky' (singular) or 'skies' (plural) occurences, <br>" +
  "- <code>/cheese|cake/</code>, matches all 'cheese' OR 'cake',<br>" +
  "- <code>/[A-Z]\\w+/</code>, matches all words beginning with a capital letter,<br>" +
  "- <code>/.*/</code> matches all text,<br>" +
  "- <code>/\\(\\([^\\)]{9}\\)\\)/</code> matches all block references,<br>" +
  "- <code>/\\[\\[([^\\[^\\]]*)\\]\\]/</code> matches all page references (not nested) and capture page name,<br>" +
  "- <code>/\\[([^\\]]*)\\]\\(\\(\\([^\\)]{9}\\)\\)\\)/</code> matches [alias](((refs))) and capture alias." +
  "<br><br>" +
  "<strong>In Replace field:</strong><br>" +
  "- <code>$RegEx</code> is the placeholder corresponding to the machting strings (pay attention to the case),<br>" +
  "- <code>$REGEX</code> capitalizes all letters of the mathcing strings,<br>" +
  "- <code>$regex</code> set to lower case all letters,<br>" +
  "- <code>$Regex</code> capitalize first letter,<br>" +
  "- <code>[$RegEx]([[page]])</code> make each machting string as an alias of [[page]],<br>" +
  "- <code>$1</code> replace each matching string (e.g. page references) by the first capture group (e.g. the page name),<br>" +
  "- <code>**$1** n°$2</code> insert two capture groups in a new formated string";
const pageBlockConversionInstructions =
  "<strong>This operation is dangerous, it can have unintended consequences.</strong><br>" +
  "Before pressing on 'Confirm', you should make a quick review of the blocks that will be concerned by a change, by pressing the 🔎︎ button.<br><br>" +
  "<strong>Block => Page</strong><br>" +
  "  - All block ((reference)) mentions will be replaced by the [[page]] mention.<br><br>" +
  "<strong>Page => Block</strong><br>" +
  "  - All [[page]] mentions will be replaced by the block ((reference)).<br>" +
  "  - If 'DNP' or nothing is entered in block field, a the block will be created at the end of the Today's page.<br>" +
  "  - All forms of page mention are concerned: #page, #[[page]] and 'page::'.<br><br>" +
  "If 'Move source content' is checked, all blocks in the source page or all child blocks of the source block will be moved to the target block or page.";

// Variables for panel settings
let includeEmbeds = true;
let includeCollapsed = false;
let excludeDuplicate = false;
let displayBefore = false;
let iziToastPosition;
let showPath = true;
let wholeGraph;
let highlightColor;
let matchesSortedBy = "page";
let extractMatchesOnly = true;
let codeBlockLimit = 150;

// Other global variables
let selectionBlue;
let lastOperation = "";
let changesNb = 0;
let changesNbBackup;
let isPrepending;
let workspace;
let formatChange = false;
let expandedNodesUid = [];
let collapsedNodesUid = [];
let referencedNodesUid = [];
let uniqueReferences = [];
let notExpandedNodesUid = [];
let selectedBlocks = [];
let modifiedBlocksCopy = [];
let inputBackup = [];
let refsUids = [];
let eltFound;
let currentToast = null;
let scrollIndex = 0;
let matchIndex = 0;
let matchArray = [];
let matchingStringsArray = [];
let matchRefsArray;
let matchingTotal = 0;
let matchingHidden = 0;
let ANDwithChildren = false;
export let textToCopy;

let iziToastColor = "#262626F0";

let Node = function (uid, attr, embeded = false) {
  this.uid = uid;
  this.content = attr.string;
  this.page = attr.page;
  this.open = attr.open;
  this.collapsedParents = attr.collapsedParents;
  this.reopened = 0;
  this.refs = attr.refs;
  this.embeded = embeded;
  this.isEmbeded = () => {
    if (
      (this.content.includes("{{embed") ||
        this.content.includes("{{[[embed")) &&
      this.refs.length != 0
    ) {
      this.embeded = true;
    } else this.embeded = false;
    return this.embeded;
  };
  this.pushRefs = () => {
    let skip = false;
    if (this.refs.length > 0) {
      this.refs.forEach((ref) => {
        let refContent = getBlockContentByUid(ref);
        if (refContent != undefined) {
          if (this.content.includes("](((" + ref + ")))")) skip = true;
          //if (this.content === "((" + ref + "))") skip = true;
          if (isPrepending && !skip) {
            if (this.content === "((" + ref + "))") {
              //expandedNodesUid.pop();
              referencedNodesUid.push(new Node(ref, getBlockAttributes(ref)));
              skip = true;
            }
          }
          if (!skip)
            referencedNodesUid.push(new Node(ref, getBlockAttributes(ref)));
        }
      });
    }
  };
  this.pushEmbedTree = (tree = []) => {
    if (tree.length === 0) {
      if (this.refs.length === 1) tree = getTreeByUid(this.refs[0]);
      else tree = getTreeByUid(this.refs[1]);
    }
    /*if (this.embeded && this.refs.length != 0) {
      if (tree.string != undefined)
        referencedNodesUid.push(
          new Node(tree.uid, getBlockAttributes(tree.uid))
        );
      if (tree.children) {
        tree.children.forEach((subTree) => {
          this.pushEmbedTree(subTree);
        });
      }
    } else return null;
    */
    getNodesFromTree(tree, false, expandedNodesUid);
  };
};
Node.prototype.getAttributes = (uid) => {
  return getBlockAttributes(uid);
};

/******************************************************************************************
/*	Search and Highlight (supporting regular expressions)
*****************************************************************************************/
const searchOnly = async function (
  findInput = "",
  caseInsensitive = false,
  wordOnly = false,
  expandToHighlight = false,
  workspaceArg = false,
  position = iziToastPosition,
  refresh = true,
  label = "Search in page or workspace"
) {
  let checkCase = "";
  if (caseInsensitive) checkCase = "checked";
  let checkWord = "";
  if (wordOnly) checkWord = "checked";
  let checkIncludeCollapsed = "";
  if (expandToHighlight) checkIncludeCollapsed = "checked";
  let checkWorkspace = "";
  if (workspaceArg != null) workspace = workspaceArg;
  if (workspace) checkWorkspace = "checked";
  if (findInput === null) findInput = "";
  let positionIcon = getNextPositionIcon(position);
  let inputChanges = 0;
  let switchToFindAndReplace = false;
  let searchLogic = "";
  if (refresh) initializeGlobalVar();
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
            10,
            searchLogic
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
            10,
            searchLogic
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
            ANDwithChildren = true;
            searchLogic = "AND";
          } else ANDwithChildren = false;
          actualizeHighlights(
            findInput,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            10,
            searchLogic
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
                  10,
                  searchLogic
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
            10,
            searchLogic
          );
        },
        false,
      ],
      [
        '<label for="checkb4" title="Search in the whole workspace: Page + Linked references + Right sidebar">Workspace  </label>',
        "change",
        function (instance, toast, input, e) {},
        false,
      ],
      [
        '<input type="checkbox" id="checkb4"' + checkWorkspace + ">",
        "change",
        async function (instance, toast, input, e) {
          workspace = input.checked;
          actualizeHighlights(
            findInput,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            10,
            searchLogic
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
          displayMatchCountInTitle(toast);
        },
      ],
      [
        "<button>▼</button>",
        function (instance, toast, button, e) {
          highlightNextMatch(1, toast);
          displayMatchCountInTitle(toast);
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
            10,
            searchLogic
          );
        },
      ],
      [
        "<button title='Open Find & Replace Box with current input'>⇆</button>",
        function (instance, toast, button, e, inputs) {
          window.removeEventListener("keydown", onKeyArrows);
          switchToFindAndReplace = true;
          if (matchingTotal != 0) label = displayMatchCountInTitle(toast);
          else label = "Find & Replace in page or workspace";
          findAndReplace(
            label,
            findInput,
            "",
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            workspace,
            position,
            false
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
            searchLogic
          );
          displaySearchResustsInPlainText(promptParameters);
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
            searchLogic
          );
          let searchString = promptParameters[0];
          if (!isRegex(findInput)) searchString = findInput;
          //console.log(matchArray);
          let changesNbBackup = changesNb;
          let matchArrayBackup = matchArray;
          await getFullMatchArrayInPage(promptParameters);

          copyMatchingUidsToClipboard(
            matchArray,
            searchString,
            caseInsensitive,
            showPath,
            "",
            "page",
            isRegex(findInput) && extractMatchesOnly
          );
          if (matchArray.length > 0)
            infoToast(
              matchArray.length +
                " blocks or strings copied in the clipboard. Paste them anywhere in your graph!"
            );
          changesNb = changesNbBackup;
          matchArray = matchArrayBackup;
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
            workspace,
            position,
            false,
            getCurrentToastLabel(toast)
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
      currentToast = toast;
      window.addEventListener("keydown", onKeyArrows);
      if (findInput != null && findInput.length > 1 && refresh) {
        actualizeHighlights(
          findInput,
          caseInsensitive,
          wordOnly,
          expandToHighlight,
          10
        );
      }
    },
    onClosing: function (instance, toast, closedBy) {},
    onClosed: function (instance, toast, closedBy) {
      if (closedBy == "esc" || closedBy == "button") {
        lastOperation = "Search";
        inputBackup = [
          findInput,
          caseInsensitive,
          wordOnly,
          expandToHighlight,
          workspace,
        ];
        currentToast = null;
        if (!switchToFindAndReplace) {
          workspace = false;
          selectedBlocks = [];
          //selectionBlue = false;
          removeHighlightedNodes();
          window.removeEventListener("keydown", onKeyArrows);
        }
      }
    },
  });
};

const getFullMatchArrayInPage = async (promptParameters) => {
  matchArray = [];
  promptParameters.push(false);
  let nodesToProcess = expandedNodesUid
    .concat(collapsedNodesUid)
    .concat(referencedNodesUid);
  nodesToProcess = removeDuplicateBlocks(nodesToProcess);

  await selectedNodesProcessing(
    nodesToProcess,
    promptParameters,
    replaceOpened,
    false
  );
};

const displaySearchResustsInPlainText = async (promptParameters) => {
  let changesNbBackup = changesNb;
  let matchArrayBackup = matchArray;

  getFullMatchArrayInPage(promptParameters);

  displayResultsInPlainText(
    matchArray.length +
      " blocks in this page or workspace containing matching strings",
    promptParameters,
    promptParameters[0].source
  );
  changesNb = changesNbBackup;
  matchArray = matchArrayBackup;
};

// Other way to expand collapsed blocks...
//
/*const actualizeHighlights = (
  findInput,
  caseInsensitive,
  wordOnly,
  expandToHighlight = false,
  timeout
) => {
  setTimeout(() => {
    if (findInput.length > 1) {
      // for (let notAllExpanded = 3; notAllExpanded > 0; notAllExpanded--) {
      let promptParameters = normalizeInputRegex(
        findInput,
        "",
        caseInsensitive,
        wordOnly
      );
      if (timeout >= 0) {
        let timeoutForExpand = 10;

        if (expandToHighlight && matchingHidden > 0) {
          timeoutForExpand = 100 + Math.log10(collapsedNodesUid.length) * 10;
          //timeoutForExpand = 100;
          notExpandedNodesUid = [];
          selectedNodesProcessing(
            collapsedNodesUid,
            promptParameters,
            expandPathBeforeHighlight
          );
        }
        setTimeout(() => {
          if (notExpandedNodesUid.length > 0) {

            collapsedNodesUid = notExpandedNodesUid;
            //  setTimeout(() => {
            actualizeHighlights(
              findInput,
              caseInsensitive,
              wordOnly,
              expandToHighlight,
              timeout - 5
            );
            // }, 100);
          } else timeout = -1;
        }, timeout * timeoutForExpand);
      }
      getNodes();
      highlightCurrentSearch(promptParameters, expandToHighlight);
      return;
    }
  }, 10);
};*/

/******************************************************************************************
/*	Find and Replace (supporting regular expressions) (fre)
*****************************************************************************************/
const findAndReplace = async function (
  label,
  findInput = "",
  replaceInput = "",
  caseInsensitive = false,
  wordOnly = false,
  expandToHighlight = false,
  workspaceArg = false,
  position = iziToastPosition,
  refresh = true
) {
  let searchLogic = "";
  let inputChanges = 0;
  if (refresh) initializeGlobalVar();
  formatChange = false;
  let positionIcon = getNextPositionIcon(position);
  let excludeDuplicateBackup = excludeDuplicate;
  excludeDuplicate = true;
  let checkCase = "";
  if (caseInsensitive) checkCase = "checked";
  let checkWord = "";
  if (wordOnly) checkWord = "checked";
  let checkIncludeCollapsed = "";
  if (expandToHighlight) checkIncludeCollapsed = "checked";
  let checkWorkspace = "";
  if (workspaceArg != null) workspace = workspaceArg;
  if (workspace) checkWorkspace = "checked";
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
            10,
            searchLogic
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
            10,
            searchLogic
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
            10,
            searchLogic
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
                  10,
                  searchLogic
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
            10,
            searchLogic
          );
        },
        false,
      ],
      [
        '<label for="checkb4" title="Search in the whole workspace: Page + Linked references + Right sidebar">Workspace  </label>',
        "change",
        function (instance, toast, input, e) {},
        false,
      ],
      [
        '<input type="checkbox" id="checkb4"' + checkWorkspace + ">",
        "change",
        async function (instance, toast, input, e) {
          workspace = input.checked;
          actualizeHighlights(
            findInput,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            10,
            searchLogic
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
          displayMatchCountInTitle(toast);
        },
      ],
      [
        "<button>▼</button>",
        function (instance, toast, button, e) {
          highlightNextMatch(1, toast);
          displayMatchCountInTitle(toast);
        },
      ],
      [
        "<button>Replace</button>",
        function (instance, toast, button, e) {
          if (changesNb == 0 && changesNbBackup == 0) {
            while (modifiedBlocksCopy.length > 0) {
              modifiedBlocksCopy.pop();
            }
          }
          let nbElts = eltFound.length;
          let lastElt = eltFound[scrollIndex];
          let item = matchArray[scrollIndex];
          let promptParameters = normalizeInputRegex(
            findInput,
            replaceInput,
            caseInsensitive,
            wordOnly,
            searchLogic
          );
          let matchesInBlock = getMatchesNbInBlock(matchArray, item.uid);
          replaceSelectedMatches(
            [promptParameters[0], promptParameters[1]],
            scrollIndex
          );
          let replacingStr = item.strToReplace.replace(
            promptParameters[0],
            replaceInput
          );
          item.replaced = true;
          if (matchesInBlock > 1) {
            let backupSimpleChangesNb = changesNbBackup;
            actualizeHighlights(
              findInput,
              caseInsensitive,
              wordOnly,
              expandToHighlight,
              10,
              searchLogic
            );
            changesNbBackup = backupSimpleChangesNb;
          } else
            lastElt.parentNode.replaceChild(
              document.createTextNode(replacingStr),
              lastElt
            );
          displayMatchCountInTitle(toast);
          if (nbElts > 1) highlightNextMatch(1, toast);
          changesNb++;
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
            searchLogic
          );
          if (promptParameters != null) {
            lastOperation = "Find and Replace";

            console.log(modifiedBlocksCopy);
            if (changesNb == 0 && changesNbBackup == 0)
              while (modifiedBlocksCopy.length > 0) {
                modifiedBlocksCopy.pop();
              }
            changesNb = 0;
            let nodesToProcess = [];
            nodesToProcess = expandedNodesUid.concat(referencedNodesUid);
            if (includeCollapsed)
              nodesToProcess = nodesToProcess.concat(collapsedNodesUid);
            nodesToProcess = removeDuplicateBlocks(nodesToProcess);
            //  console.log("Nodes to process");
            //  console.log(nodesToProcess);
            changesNb += changesNbBackup;
            await selectedNodesProcessing(
              nodesToProcess,
              promptParameters,
              replaceOpened
            );
            // undoPopup(changesNb);
            changesNbBackup = changesNb;
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
            10,
            searchLogic
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
            searchLogic
          );
          displaySearchResustsInPlainText(promptParameters);
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
            searchLogic
          );
          let searchString = promptParameters[0];
          if (!findInput.includes("/")) searchString = findInput;
          let replaceString = promptParameters[1];
          if (!replaceInput.includes("/")) replaceString = replaceInput;
          copyMatchingUidsToClipboard(
            matchArray,
            searchString,
            caseInsensitive,
            showPath,
            replaceString,
            "page",
            isRegex(findInput) && extractMatchesOnly
          );
          if (matchArray.length > 0)
            infoToast(
              changesNb +
                " blocks or strings copied in the clipboard. Paste them anywhere in your graph!"
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
            getCurrentToastLabel(toast),
            findInput,
            replaceInput,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            workspace,
            position,
            false
          );
        },
      ],
      [
        "<button>❔</button>",
        function (instance, toast, button, e) {
          helpToast();
        },
      ],
    ],
    onOpened: function (instance, toast) {
      currentToast = toast;
      window.addEventListener("keydown", onKeyArrows);
      if (findInput != "" && findInput.length > 1 && refresh) {
        actualizeHighlights(
          findInput,
          caseInsensitive,
          wordOnly,
          expandToHighlight,
          10,
          searchLogic
        );
      }
    },
    onClosing: function (instance, toast, closedBy) {},
    onClosed: function (instance, toast, closedBy) {
      if (closedBy == "esc" || closedBy == "button") {
        inputBackup = [
          findInput,
          replaceInput,
          caseInsensitive,
          wordOnly,
          expandToHighlight,
          workspace,
        ];
        currentToast = null;
        changesNbBackup = changesNb;
        if (changesNb > 0) {
          undoPopup(changesNb);
        }
        workspace = false;
        selectedBlocks = [];

        excludeDuplicate = excludeDuplicateBackup;
        removeHighlightedNodes();
        window.removeEventListener("keydown", onKeyArrows);
        initializeGlobalVar(true);
      }
    },
  });
};

const helpToast = (
  title = "Examples of regular expressions that could be useful:",
  msg = examplesOfRegex
) => {
  iziToast.show({
    maxWidth: 630,
    title: title,
    position: "center",
    messageLineHeight: "22",
    message: msg,
    timeout: false,
  });
};

const initializeGlobalVar = (close) => {
  if (!close) changesNbBackup = 0;
  changesNb = 0;
  ANDwithChildren = false;
  scrollIndex = 0;
  matchIndex = 0;
  matchingTotal = 0;
  matchingHidden = 0;
  matchArray.length = 0;
  matchingStringsArray.length = 0;
  // selectionBlue = false;
};

const displayMatchCountInTitle = function (toast) {
  let toastTitle = toast.querySelector(".iziToast-title");
  let currentScroll = 0;
  let hiddenStr = "";
  if (matchingHidden > 0)
    hiddenStr = " (+" + matchingHidden + " in collapsed blocks)";
  let unhighlightableElts = matchingTotal - eltFound.length;
  let unhighlightableStr = "";
  if (unhighlightableElts > 0)
    unhighlightableStr =
      " (" +
      unhighlightableElts +
      " elements can't be highlighted, e.g. in code blocks)";
  if (matchArray.length != 0) currentScroll = scrollIndex + 1;
  let label =
    parseInt(currentScroll) +
    " / " +
    matchingTotal +
    hiddenStr +
    unhighlightableStr;
  toastTitle.innerText = label;
  return label;
};

const getCurrentToastLabel = function (toast) {
  return toast.querySelector(".iziToast-title").innerText;
};

const replaceSelectedMatches = function (param, i) {
  let find = param[0];
  let replace = param[1];
  let blockContent = "";
  let length = matchArray.length;
  let matches = [];
  let match = matchArray[i];
  let uid = match.uid;
  if (match.blockRef != null) uid = match.blockRef;
  let attr = getBlockAttributes(uid);
  blockContent = attr.string;

  modifiedBlocksCopy.push({
    uid: uid,
    content: blockContent,
    open: attr.open,
    page: attr.page,
  });
  //console.log(modifiedBlocksCopy);
  //let findLocal = new RegExp(param[0].source, param[0].flags);
  find.lastIndex = 0;
  matches = [...blockContent.matchAll(find)];
  let position;
  if (match.indexInBlock < matches.length)
    position = matches[match.indexInBlock].index;
  // In case of nested block ref in another blockref, only the first match can be changed currently
  else position = matches[0].index;
  let replacedContent;
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
      replacedContent = blockContent.substring(0, position);
    }
    replacedContent += regexVarInsert(
      matches[match.indexInBlock],
      replace,
      blockContent
    );
    let lastIndex = position + matches[match.indexInBlock][0].length;
    if (lastIndex < blockContent.length) {
      replacedContent += blockContent.substring(lastIndex);
    }
    blockContent = replacedContent;
  }
  let isAnotherUid = true;

  if (i < length - 1) {
    let nextMatch = matchArray[i + 1];
    isAnotherUid = uid != nextMatch.uid || !nextMatch.replaced;
  }
  if (i === length - 1 || isAnotherUid) {
    updateBlock(uid, blockContent, attr.open);
  }
};

const highlightNextMatch = function (shift, toast) {
  if (!toast || !eltFound) {
    window.removeEventListener("keydown", onKeyArrows);
    console.log(
      "keyArrow eventListener removed for Find & Replace extension removed"
    );
  }
  let lastElt = eltFound[scrollIndex];
  setNotCurrentHighlight(lastElt);
  let index = scrollIndex + shift;
  //let index = parseInt(lastElt.id) + shift;
  //let index = scrollIndex + shift;
  if (shift > 0 && index >= eltFound.length) index = 0;
  if (shift < 0 && index < 0) index = eltFound.length - 1;
  let loopExit = 0;
  while (matchArray[index].replaced && loopExit < eltFound.length) {
    if (shift > 0) {
      shift++;
      if (index + 1 < eltFound.length) index++;
      else index = 0;
    }
    if (shift < 0) {
      shift--;
      if (index > 0) index--;
      else index = eltFound.length - 1;
    }
    loopExit++;
  }
  scrollIndex = index;
  if (shift > 0 && scrollIndex >= eltFound.length)
    scrollIndex = -(eltFound.length - scrollIndex);
  if (shift < 0 && scrollIndex < 0) scrollIndex = eltFound.length + scrollIndex;
  let nextElt = eltFound[scrollIndex];
  if (nextElt != null) {
    setCurrentHighlight(nextElt);
    nextElt.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }
};

const replaceOpened = async (
  node,
  find,
  replace,
  searchLogic = "",
  makeChange = true,
  reverse = false
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
      changesNb += matchIterator.length;
      if (reverse) {
        changesNb -= matchIterator.length;
        changesNb++;
      }
      if (!makeChange) {
        // if (node.page == undefined)
        //   node.page = getPageTitleByBlockUid(node.uid);
        if (extractMatchesOnly) {
          for (let i = 0; i < matchIterator.length; i++) {
            let groups = [];
            let replaceStr = replace;
            for (let j = 1; j < matchIterator[i].length; j++) {
              let group = matchIterator[i][j];
              groups.push(group);
              let placeHolder = "$" + j;
              replaceStr = replaceStr.replace(placeHolder, group);
            }
            matchingStringsArray.push({
              uid: node.uid,
              content: matchIterator[i][0],
              groups: groups,
              replace: replaceStr,
              page: node.page,
            });
          }
        }
        matchArray.push({
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
              blockContent
            );
            stringArray.push(
              blockContent.substring(m.index, m.index + m[0].length)
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
      changesNb++;
    }
    let push = true;
    if (changesNbBackup > 0)
      push = modifiedBlocksCopy.filter((b) => b.uid === uid) == 0;
    if (push)
      modifiedBlocksCopy.push({
        uid: uid,
        content: blockContent,
        open: isOpened,
        page: node.page,
      });
    updateBlock(uid, replacedBlock, isOpened);
  } else if (reverse) {
    replaceOpened(node, /.*/g, replace);
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
        indexOfRegex + regexLength
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

const regexFormat = (regexW, strMatch) => {
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
          /[a-zA-ZÀ-ž\[\(][a-zA-ZÀ-ž\#\[\]\(\)\{\}\@\-\*\$:;=><\s]+?[\.\?\!\n]|[a-zA-ZÀ-ž\[\(][a-zA-ZÀ-ž\#\[\]\(\)\{\}\@\-\*\$:;=><\s]+$/g
        ),
      ];
      for (let i = 0; i < sentences.length; i++) {
        let sentence = sentences[i][0];
        const firstRefMatch = referencesRegex.exec(sentence);
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

/******************************************************************************************
/*	Functions for highlighting matches
/******************************************************************************************/
const actualizeHighlights = (
  findInput,
  caseInsensitive,
  wordOnly,
  expandToHighlight = false,
  timeout,
  searchLogic = ""
) => {
  setTimeout(() => {
    if (findInput.length > 0) {
      // for (let notAllExpanded = 3; notAllExpanded > 0; notAllExpanded--) {
      let promptParameters = normalizeInputRegex(
        findInput,
        "",
        caseInsensitive,
        wordOnly,
        searchLogic,
        expandToHighlight
      );
      if (timeout >= 0) {
        let timeoutForExpand = 10;

        if (expandToHighlight && matchingHidden > 0) {
          timeoutForExpand = 100 + Math.log10(collapsedNodesUid.length) * 10;
          //timeoutForExpand = 100;
          notExpandedNodesUid = [];
          selectedNodesProcessing(
            collapsedNodesUid,
            promptParameters,
            expandPathBeforeHighlight,
            false
          );
        }
        setTimeout(() => {
          //console.log("Still collapsed:");
          //console.log(notExpandedNodesUid);
          let addedTimeout = 10;
          if (notExpandedNodesUid.length > 0) {
            console.log(
              notExpandedNodesUid.length +
                " matching nodes not expanded properly!"
            );
            addedTimeout = 500;
            collapsedNodesUid = notExpandedNodesUid;
            selectedNodesProcessing(
              collapsedNodesUid,
              promptParameters,
              expandPathBeforeHighlight,
              false
            );
            notExpandedNodesUid = [];
          }
          setTimeout(() => {
            console.log("selectionBlue before getNodes:>> ", selectionBlue);
            getNodes();
            highlightCurrentSearch(promptParameters, expandToHighlight);
          }, addedTimeout);
        }, timeout * timeoutForExpand);
        changesNbBackup += changesNb;
      }
    }
  }, 10);
};

const highlightCurrentSearch = async (input, expand, toast = currentToast) => {
  //changesNb = 0;
  scrollIndex = 0;
  matchIndex = 0;
  matchingTotal = 0;
  matchingHidden = 0;
  formatChange = false;
  matchArray = [];
  if (input != null) {
    removeHighlightedNodes();
    setTimeout(async () => {
      input.push(expand);
      await selectedNodesProcessing(
        expandedNodesUid,
        input,
        findAndHighlight,
        false
      );
      //console.log(matchArray);
      input.push(true);
      await selectedNodesProcessing(
        collapsedNodesUid,
        input,
        findAndHighlight,
        false
      );
      highlightAllMatches();
      displayMatchCountInTitle(toast);
    }, 100);
  }
};

const highlightAllMatches = function (inDialog = false) {
  let ordererMatches = [];
  eltFound = document.querySelectorAll("fr-match");
  eltFound.forEach((item, index) => {
    item.style.color = "#000000";
    if (index === 0 && !inDialog) {
      item.style.backgroundColor = highlightColor;
    } else item.style.backgroundColor = highlightColor + "65";
    let id = parseInt(item.id);
    ordererMatches.push(matchArray[id]);
  });
  if (!inDialog) matchArray = ordererMatches;
  if (eltFound.length != 0 && !inDialog)
    eltFound[0].scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
};

const setCurrentHighlight = function (elt) {
  elt.style.backgroundColor = highlightColor;
};

const setNotCurrentHighlight = function (elt) {
  elt.style.backgroundColor = highlightColor + "65";
};

const onKeyArrows = function (e) {
  if (e.key == "ArrowUp") {
    document.activeElement.blur();
    highlightNextMatch(-1, currentToast);
    displayMatchCountInTitle(currentToast);
    e.preventDefault();
  }
  if (e.key == "ArrowDown") {
    document.activeElement.blur();
    highlightNextMatch(1, currentToast);
    displayMatchCountInTitle(currentToast);
    e.preventDefault();
  }
};

const expandPathBeforeHighlight = async (node, find, replace, searchLogic) => {
  let blockContent = node.content;
  let uid = node.uid;
  let collapsedParents = node.collapsedParents;
  refsUids = [];
  let hasMatches = false;
  let hasANDmatchesInChildren = false;
  let resolvedBlockContent = resolveReferences(blockContent, [uid]);

  if (searchLogic != "AND") {
    find.lastIndex = 0;
    hasMatches = find.test(resolvedBlockContent);
  } else {
    hasMatches = find.and.test(resolvedBlockContent);
    if (ANDwithChildren)
      hasMatches =
        hasMatches ||
        ANDmatchInChildren(
          node,
          blockContent,
          resolvedBlockContent,
          find,
          replace,
          true
        );
  }
  // if (
  //   find.test(blockContent) ||
  //   findInReferences(find, node.refs, blockContent) > 0
  // )
  if (hasMatches) {
    if (collapsedParents.length != 0) {
      await openParentNodes(collapsedParents);
    }
    let selector = "[id$='" + uid + "']";
    let elt = document.querySelector(selector);
    if (elt === null) {
      let parents = getParentTreeUids(uid);
      await expandWholeParentPath(parents, 5);
      elt = document.querySelector(`[id$=${uid}]`);
      if (elt === null) notExpandedNodesUid.push(node);
    }
  }
};

const expandWholeParentPath = async (parents) => {
  for (let i = 0; i < parents.length; i++) {
    await window.roamAlphaAPI.updateBlock({
      block: {
        uid: parents[i],
        open: true,
      },
    });
  }
};

const findInReferences = (find, refs, blockContent, count = 0) => {
  for (let i = 0; i < refs.length; i++) {
    if (!refsUids.includes(refs[i])) {
      let firstReference = false;
      if (!uniqueReferences.includes(refs[i])) {
        uniqueReferences.push(refs[i]);
        firstReference = true;
      }
      let refAttr = getBlockAttributes(refs[i]);
      let refNode = new Node(refs[i], refAttr);
      let refContent = refAttr.string;
      refsUids.push(refs[i]);
      if (refContent != undefined) {
        let originalIsPresent =
          expandedNodesUid.filter((node) => node.uid === refs[i]).length > 0;
        if (firstReference && originalIsPresent) uniqueReferences.pop();
        if (
          !blockContent.includes("{[[embed]]:") &&
          !blockContent.includes("](((" + refs[i] + ")))")
        ) {
          let regex = new RegExp(find.source, find.flags);
          if (
            regex.test(refContent) &&
            ((!originalIsPresent && firstReference) || !excludeDuplicate)
          ) {
            matchRefsArray.push(refs[i]);
            count += refContent.match(regex).length;
          }
          let nonRedundantRefsArray = getArrayExcludingAnotherArray(
            refNode.refs,
            refsUids
          );
          if (nonRedundantRefsArray.length != 0)
            count += findInReferences(find, nonRedundantRefsArray, refContent);
        }
      }
    }
  }
  return count;
};

const ANDmatchInChildren = (
  node,
  blockContent,
  resolvedBlockContent,
  find,
  replace,
  expandToHighlight
) => {
  let uid = node.uid;
  let matchInBlockContent = false;
  find.or.lastIndex = 0;
  let matchOR = find.or.test(blockContent);
  if (matchOR) {
    let childNodesToProcess = getChildrenUid(uid);
    if (childNodesToProcess != null) {
      let resolvedChildContent = getPlainTextOfChildren(uid);
      let resolvedBlockAndChildContent =
        resolvedBlockContent + " " + resolvedChildContent;
      find.and.lastIndex = 0;
      // console.log(find.and);
      matchInBlockContent = find.and.test(resolvedBlockAndChildContent);
      //  console.log(matchInBlockContent);
      if (matchInBlockContent) {
        if (expandToHighlight) updateBlock(uid, blockContent, true);
        let childMatches;
        childMatches = resolvedChildContent.match(find.or).length;
        if (node.open != true) matchingHidden += childMatches;
        else {
          childNodesToProcess = childNodesToProcess.map(
            (uid) => new Node(uid, getBlockAttributes(uid))
          );
          //matchingTotal -= childMatches;
          selectedNodesProcessing(
            childNodesToProcess,
            [find.or, replace, "OR", true],
            findAndHighlight
          );
        }
      }
    }
  }
  return matchInBlockContent;
};

const findAndHighlight = async (
  node,
  find,
  replace,
  searchLogic,
  expandToHighlight = false,
  collapsed = false
) => {
  let blockContent = node.content;
  let uid = node.uid;
  let matchInBlockContent;
  if (searchLogic != "AND") {
    find.lastIndex = 0;
    matchInBlockContent = find.test(blockContent);
  } else {
    let resolvedBlockContent = resolveReferences(blockContent, [uid]);
    find.and.lastIndex = 0;
    matchInBlockContent = find.and.test(resolvedBlockContent);
    if (ANDwithChildren && !matchInBlockContent) {
      matchInBlockContent = ANDmatchInChildren(
        node,
        blockContent,
        resolvedBlockContent,
        find,
        replace,
        expandToHighlight
      );
    }
    if (matchInBlockContent) find = find.or;
  }
  let matchesInRefs = 0;
  matchRefsArray = [];
  if (node.refs.length != 0)
    // && !(searchLogic == "AND"))
    matchesInRefs = findInReferences(find, node.refs, blockContent);
  let selector = "[id$='" + uid + "']";
  let elt = document.querySelector(selector);
  if (
    expandToHighlight &&
    elt === null &&
    (matchInBlockContent || matchesInRefs > 0)
  ) {
    expandPathBeforeHighlight(node, find, replace, searchLogic);
    elt = document.querySelector(selector);
  }
  if (matchInBlockContent || matchesInRefs > 0) {
    let nbMatchesInBlock = 0;
    let matches = blockContent.match(find);
    if (matches != null) {
      nbMatchesInBlock = matches.length;
    }
    nbMatchesInBlock += matchesInRefs;
    if (!collapsed) matchingTotal += nbMatchesInBlock;
    else matchingHidden += nbMatchesInBlock;
    if (elt != null && !collapsed)
      highlightInHtmlElement(elt, find, replace, uid);
  }
};

const highlightInHtmlElement = (el, find, replace, uid, bref = null) => {
  if (el.innerHTML.includes("fr-match") == false) {
    let nodes = el.firstChild.childNodes;
    if (nodes.length != 0) {
      if (nodes[0].parentNode.nodeName == "BLOCKQUOTE")
        nodes = nodes[0].childNodes;
      for (let j = 0; j < nodes.length; j++) {
        highlightString(nodes[j], find, replace, uid, bref);
      }
    }
  }
};
const highlightString = (
  node,
  find,
  replace = null,
  uid = null,
  bref = null
) => {
  if (node.nodeType == 3) {
    // nodeType 3 is Text
    let foundChild = processTextNode(node.nodeValue, find, replace, uid, bref);
    node.parentNode.replaceChild(foundChild, node);
  } else {
    let className = node.className;
    //console.log(className);
    switch (className) {
      case "rm-bold":
      case "rm-highlight":
      case "rm-italics":
      case "rm-page-ref rm-page-ref--tag": // tag
        node = node.childNodes[0];
        break;
      case "bp3-popover-wrapper": // block ref or alias
        node = node.childNodes[0].childNodes[0].childNodes[0];
        if (node.nodeType != 3) {
          // block ref
          let blockRef = node.parentNode.dataset.uid;
          if (excludeDuplicate && !matchRefsArray.includes(blockRef)) {
            if (uniqueReferences.includes(blockRef)) {
              let index = uniqueReferences.indexOf(blockRef);
              uniqueReferences.splice(index, 1);
            } else return;
          }
          node = node.childNodes;
          for (let i = 0; i < node.length; i++) {
            highlightString(node[i], find, replace, uid, blockRef);
          }
          return;
        }
        break;
      case "rm-block-ref dont-focus-block ": // block ref 2nd level
        node = node.childNodes[0].childNodes[0];
        let upperLevelRef = new Node(bref, getBlockAttributes(bref));
        if (upperLevelRef.refs.length === 1) bref = upperLevelRef.refs[0];
        else bref = getNestedRef(upperLevelRef, node.nodeValue);
        break;
      case "rm-inline-code-block": // code block // TODO ?
        node = node.childNodes[0];
        break;
      /* let r = node.querySelector(".cm-line");
        for (let x = 0; x < r.childNodes.length; x++) {
          let c = r.childNodes[x];
          if (find.test(c.innerHTML)) {
            let p = c.parentNode;
            node = c;
            let newChild = document.createElement("span");
            newChild.className = "cm-searchMatch";
            newChild.appendChild(c);
            //replaceChild(newChild, c);
            c.insertBefore(newChild, c);
            return;
          }
        }
        break;*/
      default:
        //inline code
        if (node.outerHTML.includes("<code>")) {
          // TODO
        }
        if (node.childNodes) {
          className = node.childNodes[0].className;
          switch (className) {
            case "bp3-popover-wrapper": // alias
              node = node.childNodes[0];
              break;
            case "rm-page-ref rm-page-ref--link": // page ref
              node = node.childNodes[0].childNodes[0];
              break;
            case "rm-page-ref__brackets": // page ref inside brackets
              node = node.childNodes[1].childNodes[0];
              break;
            default:
              if (node.parentElement.className == "rm-bq")
                node = node.childNodes[0]; // quote
              else return;
          }
        } else return;
    }
    highlightString(node, find, replace, uid, bref);
  }
};

const getNestedRef = (node, content) => {
  for (let i = 0; i < node.refs.length; i++) {
    let blockContent = getBlockContentByUid(node.refs[i]);
    if (blockContent == content) return node.refs[i];
  }
};

const processTextNode = (text, find, replace, uid = null, bref = null) => {
  let node = document.createElement("fr-node");
  let shiftedIndex = 0;
  let t;
  //let findLocal = new RegExp(find.source, find.flags);
  find.lastIndex = 0;
  let matchIterator = [...text.matchAll(find)];
  let nbInBlock = 0;
  if (uid != null && matchIndex > 0) {
    if (matchArray[matchIndex - 1].uid === uid)
      nbInBlock = matchArray[matchIndex - 1].indexInBlock + 1;
  }

  matchIterator.forEach((i, indexInNode) => {
    if (i.index != 0) {
      let split = i.input.slice(shiftedIndex, i.index);
      t = document.createTextNode(split);
      node.appendChild(t);
    }
    let e = document.createElement("fr-match");
    e.setAttribute("id", matchIndex++);
    if (uid != null)
      if (extractMatchesOnly) {
        let groups = [];
        let replaceStr = replace;
        for (let j = 1; j < i.length; j++) {
          groups.push(i[j]);
          replaceStr = replaceStr.replace("$" + j, i[j]);
        }
        matchingStringsArray.push({
          uid: uid,
          content: i[0],
          groups: groups,
          replace: replaceStr,
        });
      }
    if (replace != null)
      matchArray.push({
        uid: uid,
        strToReplace: i[0],
        indexInBlock: indexInNode + nbInBlock,
        replaced: false,
        blockRef: bref,
        matchIndex: matchIndex - 1,
      });
    t = document.createTextNode(i[0]);
    e.appendChild(t);
    node.appendChild(e);
    shiftedIndex = i.index + i[0].length;
  });
  if (shiftedIndex < text.length) {
    let split = text.slice(shiftedIndex);
    t = document.createTextNode(split);
    node.appendChild(t);
  }
  return node;
};

function removeHighlightedNodes(e = document) {
  let highlightedElt = e.querySelectorAll("fr-node");
  for (let i = 0; i < highlightedElt.length; i++) {
    let originalTxt = highlightedElt[i].innerText;
    let eTxt = document.createTextNode(originalTxt);
    highlightedElt[i].replaceWith(eTxt);
  }
}

/******************************************************************************************
/*	Append and/or Prepend
/******************************************************************************************/

const appendPrepend = async (node, stringBefore, stringAfter) => {
  let uid = node.uid;
  let blockContent = node.content;
  let isOpened = node.open;
  modifiedBlocksCopy.push({
    uid: uid,
    content: blockContent,
    open: isOpened,
    page: node.page,
  });
  updateBlock(uid, stringBefore + blockContent + stringAfter, isOpened);
  changesNb++;
};

const appendPrependDialog = async function () {
  changesNb = 0;
  formatChange = false;
  iziToast.question({
    maxWidth: 360,
    layout: 2,
    timeout: false,
    close: false,
    overlay: true,
    id: "question",
    title: "Text to prepend or/and to append to each selected blocks:",
    message: "(Do not forget space if needed.)",
    inputs: [
      [
        '<input type="text" placeholder="to prepend" style="width:100%; color:#FFFFFFB3">',
        "keyup",
        function (instance, toast, input, e) {},
        true,
      ],
      [
        '<input type="text" placeholder="to append" style="width:100%; color:#FFFFFFB3">',
        "keydown",
        function (instance, toast, input, e) {},
      ],
    ],
    buttons: [
      [
        "<button><b>Confirm</b></button>",
        function (instance, toast, button, e, inputs) {
          let prefixe = inputs[0].value;
          let suffixe = inputs[1].value;
          lastOperation = "Append and/or Prepend";
          while (modifiedBlocksCopy.length > 0) {
            modifiedBlocksCopy.pop();
          }
          selectedNodesProcessing(
            expandedNodesUid,
            [prefixe, suffixe],
            appendPrepend
          );

          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
        false,
      ],
      [
        "<button>Cancel</button>",
        function (instance, toast, button, e) {
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
      ],
    ],
    onClosing: function (instance, toast, closedBy) {},
    onClosed: function (instance, toast, closedBy) {
      if (closedBy == "esc" || closedBy == "button") {
        selectedBlocks = [];
        selectionBlue = false;
        initializeGlobalVar(true);
      }
    },
  });
};

/******************************************************************************************
/*	Change format
/******************************************************************************************/
const changeBlockFormat = async (node, headingLevel, alignment, view) => {
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
      window.roamAlphaAPI.updateBlock({ block: { uid: uid, heading: h } });
    }
  }
  if (alignment != "noChange") {
    if (blockTree["text-align"] != null) {
      aOld = blockTree["text-align"];
    } else {
      aOld = "left";
    }
    window.roamAlphaAPI.updateBlock({
      block: { uid: uid, "text-align": alignment },
    });
  }
  if (view != "noChange") {
    if (blockTree["view-type"] != null) {
      vOld = blockTree["view-type"];
    } else {
      vOld = "bullet";
    }
    window.roamAlphaAPI.updateBlock({
      block: { uid: uid, "children-view-type": view },
    });
  }
  changesNb++;
  modifiedBlocksCopy.push({
    uid: uid,
    content: blockContent,
    open: isOpened,
    page: node.page,
    h: hOld,
    a: aOld,
    v: vOld,
  });
};

const changeBlockFormatPrompt = async function () {
  changesNb = 0;
  let caseOptions =
    '<option value="noChange">Case</option>' +
    '<option value="toUpper">UPPER case</option>' +
    '<option value="toLower">lower case</option>' +
    '<option value="capitalizeB" title="Capitalize first letter of the block">Cap. block</option>' +
    '<option value="capitalizeW" title="Capitalize Each Word">Cap. Words</option>' +
    '<option value="capitalizeS" title="Capitalize each sentence.">Cap. sentences</option>';
  iziToast.show({
    maxWidth: 500,
    timeout: false,
    close: false,
    progressBar: false,
    title: "Format changes to apply to the selected blocks:",
    inputs: [
      [
        '<select style="color:#FFFFFFB3"><option value="noChange">Heading</option><option value="1">H1</option><option value="2">H2</option><option value="3">H3</option><option value="0">Normal</option></select>',
        "change",
        function (instance, toast, select, e) {},
        true,
      ],
      [
        '<select style="color:#FFFFFFB3"><option value="noChange">Alignment</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select>',
        "change",
        function (instance, toast, select, e) {},
      ],
      [
        '<select style="color:#FFFFFFB3"><option value="noChange">View as...</option><option value="document">Document</option><option value="numbered">Numbered List</option><option value="bullet">Bulleted List</option></select>',
        "change",
        function (instance, toast, select, e) {},
      ],
      [
        '<select style="color:#FFFFFFB3">' + caseOptions + "</select>",
        "change",
        function (instance, toast, select, e) {},
      ],
    ],
    buttons: [
      [
        "<button><b>Apply</b></button>",
        function (instance, toast, button, e, inputs) {
          initializeGlobalVar();
          let h = inputs[0].options[inputs[0].selectedIndex].value;
          let a = inputs[1].options[inputs[1].selectedIndex].value;
          let v = inputs[2].options[inputs[2].selectedIndex].value;
          let caseChange = inputs[3].options[inputs[3].selectedIndex].value;

          if (h != "noChange" || a != "noChange" || v != "noChange") {
            lastOperation = "Change format";
            formatChange = true;
            let promptParameters = [h, a, v];
            while (modifiedBlocksCopy.length > 0) {
              modifiedBlocksCopy.pop();
            }
            selectedNodesProcessing(
              expandedNodesUid,
              promptParameters,
              changeBlockFormat
            );
          }
          if (caseChange != "noChange") {
            caseBulkChange(caseChange);
          }

          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
        false,
      ], // true to focus
      [
        "<button>Cancel</button>",
        function (instance, toast, button, e) {
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
      ],
    ],
    onClosing: function (instance, toast, closedBy) {
      // console.info('Closing | closedBy: ' + closedBy);
    },
    onClosed: function (instance, toast, closedBy) {
      if (closedBy == "esc" || closedBy == "button") {
        selectedBlocks = [];
        selectionBlue = false;
        initializeGlobalVar(true);
        changesNbBackup = changesNb;
      }
    },
  });
};

const caseBulkChange = (change) => {
  let replace;
  let input = referencesRegexStr; // not simply /.*/, because we have to exclude blocks and page references!
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

  while (modifiedBlocksCopy.length > 0) {
    modifiedBlocksCopy.pop();
  }
  let promptParameters = normalizeInputRegex(input, replace);
  promptParameters.push(true);
  if (change == "capitalizeS") promptParameters[0] = /.*/g;
  else promptParameters.push(true);
  selectedNodesProcessing(expandedNodesUid, promptParameters, replaceOpened);
  changesNbBackup = changesNb;
};

/******************************************************************************************      
/*	Whole graph Find & Replace
/******************************************************************************************/
export let resultsJSX, dialogTitle, submitParams, handleSubmit;

const findAndReplaceInWholeGraph = async function (
  label,
  mode = "search",
  findInput = "",
  replaceInput = "",
  caseInsensitive = false,
  wordOnly = false,
  moveContent = false,
  position = iziToastPosition,
  refresh = true
) {
  if (refresh) initializeGlobalVar();
  // changesNb = 0;
  // matchingTotal = 0;
  // matchArray = [];
  formatChange = false;
  let positionIcon = getNextPositionIcon(position);
  let excludeDuplicateBackup = excludeDuplicate;
  excludeDuplicate = true;
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
          initializeGlobalVar();
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
          initializeGlobalVar();
        },
        false,
      ],
      [
        '<select style="color:#FFFFFFB3" title="Search logic: search for the full string, or for words separated by a space - one OR the other, one AND the other in the block"><option value="" title="full string, including spaces">full str.</option><option value="OR">OR</option>' +
          ANDsearchOption +
          "</select>",
        "change",
        function (instance, toast, select, e) {
          initializeGlobalVar();
          searchLogic = select.value;
          if (searchLogic === "AND+") {
            ANDwithChildren = true;
            searchLogic = "AND";
          } else ANDwithChildren = false;
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
            initializeGlobalVar();
            if (mode == "block to page") {
              let uid = normalizeMention(findInput, "block");
              if (uid != null) {
                let blockContent =
                  "[[" + getBlockContentByUid(uid.slice(2, -2)) + "]]";
                document.querySelectorAll(
                  "input.iziToast-inputs-child"
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
            initializeGlobalVar();
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
            mode === "replace page names" ? false : true
          );
          if (findInput.length > 0) {
            if (mode === "replace page names") {
              wholeGraphPageNameProcessing(promptParameters, false, toast);
              label = displayWholeGraphCountInTitle(
                toast,
                changesNb + " matching [[page names]]"
              );
              if (matchArray.length > 0)
                displayPageNamesResults(...promptParameters, toast);
            } else {
              wholeGraphProcessing(promptParameters, false, toast);
              label = displayWholeGraphCountInTitle(toast);
              if (matchArray.length > 0) {
                displayResultsInPlainText(
                  matchArray.length +
                    " blocks in your graph containing matching strings",
                  promptParameters,
                  findInput
                );
              }
            }
          }
        },
      ],
      [
        "<button title='Open in sidebar the list of blocks containing matching strings'>🔎︎◨</button>",
        function (instance, toast, button, e) {
          let promptParameters = normalizeInputRegex(
            findInput,
            replaceInput,
            caseInsensitive,
            wordOnly,
            searchLogic,
            false,
            mode === "replace page names" ? false : true
          );
          if (findInput.length > 0) {
            if (mode === "replace page names") {
              wholeGraphPageNameProcessing(promptParameters, false, toast);
              label = displayWholeGraphCountInTitle(
                toast,
                changesNb + " matching [[page names]]"
              );
            } else {
              wholeGraphProcessing(promptParameters, false, toast);
              label = displayWholeGraphCountInTitle(toast);
            }
            let searchString = promptParameters[0];
            if (!findInput.includes("/")) searchString = findInput;
            let replaceString = promptParameters[1];
            if (!replaceInput.includes("/")) replaceString = replaceInput;
            let title = "Matching blocks for search on: `" + searchString + "`";
            if (mode === "replace page names")
              title = title.replace("blocks", "page names");
            if (matchArray.length > 0)
              if (matchArray.length < 200)
                displayChangedBlocks(true, title, mode, false);
              else {
                errorToast(
                  "More than 200 results, narrow down your search! Click on 🔎︎ to see the list in plain text."
                );
              }
          }
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
            false,
            mode === "replace page names" ? false : true
          );
          if (findInput.length > 0) {
            if (mode === "replace page names") {
              wholeGraphPageNameProcessing(promptParameters, false, toast);
              label = displayWholeGraphCountInTitle(
                toast,
                changesNb + " matching [[page names]]"
              );
            } else {
              wholeGraphProcessing(promptParameters, false);
              label = displayWholeGraphCountInTitle(toast);
            }
            let searchString = promptParameters[0];
            if (!findInput.includes("/")) searchString = findInput;
            let replaceString = promptParameters[1];
            if (!replaceInput.includes("/")) replaceString = replaceInput;
            if (matchArray.length < 200) {
              if (mode === "replace page names") {
                copyMatchingPagesToClipbard();
              } else
                copyMatchingUidsToClipboard(
                  matchArray,
                  searchString,
                  caseInsensitive,
                  showPath,
                  replaceString,
                  "whole graph",
                  isRegex(findInput) && extractMatchesOnly
                );
              if (matchArray.length > 0)
                infoToast(
                  matchArray.length +
                    " items copied in the clipboard. Paste them anywhere in your graph!"
                );
            } else {
              errorToast(
                "More than 200 block references to copy, narrow down your search! Click on 🔎︎ to see the list in plain text."
              );
              console.log(matchArray);
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
            mode === "replace page names" ? false : true
          );
          if (findInput.length > 0)
            switch (mode) {
              case "replace page names":
                wholeGraphPageNameProcessing(promptParameters, false, toast);
                if (matchArray.length > 0) {
                  displayPageNamesResults(...promptParameters, toast);
                }
                break;
              case "replace":
                lastOperation = "Find and Replace";
                warningPopupWholeGraph(
                  promptParameters[0],
                  promptParameters[1],
                  mode,
                  false,
                  thisToast
                );
                break;
              case "block to page":
                let normalizedFind = normalizeMention(findInput, "block");
                if (normalizedFind === null) {
                  errorToast(
                    "Incorrect block reference. Copy/past it from the original block by pressing Ctrl+Shift+c."
                  );
                  return;
                } else findInput = normalizedFind;
                lastOperation = mode;
                warningPopupWholeGraph(
                  findInput,
                  replaceInput,
                  mode,
                  moveContent,
                  thisToast
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
                      "The converted block will be created as the last block of Today's page."
                    );
                  } else {
                    errorToast(
                      "Incorrect block reference. Copy/past it from the original block by pressing Ctrl+Shift+c."
                    );
                    return;
                  }
                } else replaceInput = normalizedReplace;
                lastOperation = mode;
                warningPopupWholeGraph(
                  findInput,
                  replaceInput,
                  mode,
                  moveContent,
                  thisToast
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
            false
          );
        },
      ],
      [
        "<button>❔</button>",
        function (instance, toast, button, e) {
          if (mode == "block to page" || mode == "page to block")
            helpToast("Warning!", pageBlockConversionInstructions);
          else helpToast();
        },
      ],
    ],
    onOpened: function (instance, toast) {},
    onClosing: function (instance, toast, closedBy) {},
    onClosed: function (instance, toast, closedBy) {
      if (closedBy == "esc" || closedBy == "button") {
        initializeGlobalVar();
        inputBackup = [
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

const displayResultsInPlainText = (
  dialogCaption,
  promptParameters,
  findInput
) => {
  let treeArray;
  if (extractMatchesOnly && isRegex) {
    if (matchingStringsArray[0].groups.length > 0) {
      matchingStringsArray.forEach((match) => {
        match.content = match.replace;
      });
    }
    treeArray = groupMatchesByPage(matchingStringsArray);
    dialogCaption = "matching strings in your graph";
  } else {
    treeArray = groupMatchesByPage(matchArray);
  }
  resultsJSX = getResultsDisplayJSX(treeArray);
  dialogTitle = <h4>{dialogCaption}:</h4>;
  handleSubmit = (toCopy) => {
    navigator.clipboard.writeText(toCopy);
  };
  submitParams = [textToCopy];
  displayForm("Copy to clipboard", ".block-list");
  let dialog = document.querySelector(".bp3-dialog:has(.block-list)");
  let liIterator = dialog.querySelectorAll("li");
  if (promptParameters.length >= 3 && promptParameters[2] == "AND") {
    promptParameters[0] = promptParameters[0].or;
  }
  if (!extractMatchesOnly || !isRegex(findInput)) {
    for (const node of liIterator) {
      highlightString(node.firstChild, promptParameters[0]);
    }
    highlightAllMatches(true);
  }
};

const getResultsDisplayJSX = (treeArray) => {
  textToCopy = "";

  let url = getUrl() + "/page/";
  return (
    <div className="block-list">
      <ul>
        {treeArray.map((node) => {
          let pageMention = "[[" + getPageNameByPageUid(node.page) + "]]"; // getPageTitleByPage
          textToCopy += pageMention + "\n";
          return (
            <li
              style={{
                listStyle: "none",
              }}
            >
              {pageMention}
              {node.blocks.map((block) => {
                let blockRef = "((" + block.uid + "))";
                //let blockUrl = url + block.uid;
                let display = block.content + "\n";
                if (display.includes("```"))
                  display = display.substring(0, codeBlockLimit) + " (...)";
                else {
                  display = resolveReferences(display, [block.uid]);
                  textToCopy += "  - " + display + "\n";
                }
                return (
                  <ul
                    style={{
                      marginTop: "3px",
                    }}
                  >
                    <li
                      title={blockRef}
                      style={{
                        listStyleType: "disc",
                      }}
                    >
                      {display}
                      <button
                        class="add-to-sidebar"
                        title="Open this block in the right sidebar"
                        onClick={() =>
                          window.roamAlphaAPI.ui.rightSidebar.addWindow({
                            window: { type: "block", "block-uid": block.uid },
                          })
                        }
                      >
                        ➕
                      </button>
                    </li>
                  </ul>
                );
              })}
              <br />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const displayPageNamesResults = (find, replace, toast) => {
  let selectedElts = matchArray;
  submitParams = [selectedElts];

  let isAllSelected = selectedElts.length === matchArray.length;

  const handleSelectElt = (evt, element) => {
    selectedElts = selectedElts.includes(element)
      ? selectedElts.filter((e) => e !== element)
      : [...selectedElts, element];
    submitParams = [selectedElts];
  };

  const handleSelectAll = (e, force) => {
    const checkboxes = document
      .querySelector(".page-list")
      .querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb) => {
      let newState = e?.target?.checked || force;
      cb.checked = newState;
    });
    selectedElts = !force && isAllSelected ? [] : [...matchArray];
    isAllSelected = selectedElts.length === matchArray.length;
    submitParams = [selectedElts];
  };

  resultsJSX = (
    <div className="page-list">
      <div>
        <label className="select-all-pages">
          <input type="checkbox" onChange={handleSelectAll} />
          Select All/None
        </label>
      </div>
      <ul>
        {matchArray.map((match) => (
          <li>
            <input
              type="checkbox"
              onChange={(e) => handleSelectElt(e, match)}
              className="page-checkbox"
            />
            {"[[" +
              match.title +
              "]] ➡︎ [[" +
              replaceSubstringOrCaptureGroup(match.title, find, replace) +
              "]]"}
          </li>
        ))}
      </ul>
    </div>
  );
  dialogTitle = <h4>{matchArray.length} matching page names</h4>;
  handleSubmit = () => {
    warningPopupWholeGraph(
      find,
      replace,
      "replace page names",
      false,
      toast,
      selectedElts
    );
    //wholeGraphPageNameProcessing([find, replace], true, toast, selectedElts);
  };
  displayForm("Replace", ".page-list");

  handleSelectAll(null, true);
};

const errorToast = (message) => {
  iziToast.warning({
    timeout: 4000,
    id: "warning",
    position: iziToastPosition,
    zindex: 999,
    title: "Input error",
    message: message,
  });
};
const infoToast = async (
  message,
  timeout = 4000,
  position = iziToastPosition,
  title = null
) => {
  iziToast.info({
    timeout: timeout,
    title: title,
    id: "info",
    position: position,
    zindex: 999,
    title: message,
    onOpened: function (instance, toast) {},
  });
};

const displayWholeGraphCountInTitle = async (toast, msg = "") => {
  const toastTitle = toast.querySelector(".iziToast-title");
  let totalStr = "";
  let label = "";
  if (msg == "") {
    totalStr = " " + changesNb + " matches";
    label = "In whole graph:" + totalStr;
  } else label = msg;
  toastTitle.firstChild.data = label;
  return label;
};

const warningPopupWholeGraph = (
  find,
  replace,
  mode = "search",
  moveContent = false,
  mainToast = null,
  arrayToProcess
) => {
  let title = "Replace a given string in the whole graph ";
  let findRegex = find;
  let inputs;
  switch (mode) {
    case "replace page names":
      title = "Replacing patterns in [[page names]] ";
      changesNb = arrayToProcess.length;
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
    wholeGraphProcessing([findRegex, replace], false);
  if (mode === "block to page" || mode === "page to block") changesNb++;
  if (changesNb === 0) {
    errorToast(
      "0 matching block in the graph, try again with another block or page reference"
    );
    return;
  }
  iziToast.warning({
    timeout: 20000,
    id: "warning",
    zindex: 999,
    maxWidth: 500,
    title: changesNb + " matches have been found !",
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
        (instance, toast) => {
          while (modifiedBlocksCopy.length > 0) {
            modifiedBlocksCopy.pop();
          }
          switch (mode) {
            case "replace page names":
              wholeGraphPageNameProcessing(
                [find, replace],
                true,
                toast,
                arrayToProcess
              );
              break;
            case "block to page":
              changeBlockToPage(find, replace, moveContent);
              break;
            case "page to block":
              changePageToBlock(find, replace, moveContent);
              break;
            default:
              wholeGraphProcessing([find, replace], true);
          }
          changesNbBackup = changesNb;
          mainToast?.instance?.hide(
            { transitionOut: "fadeOut" },
            mainToast.toast,
            "button"
          );
          undoPopup(changesNb);
          changesNb;
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

const wholeGraphProcessing = (
  promptParameters,
  makeChanges = true,
  toast = null
) => {
  let find = promptParameters[0];
  let replace = promptParameters[1];
  let searchLogic = "";
  if (promptParameters.length > 2) {
    searchLogic = promptParameters[2];
  }
  if (matchArray.length == 0) {
    initializeGlobalVar();
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
        replaceOpened(node, find, replace, searchLogic, makeChanges);
      }
    }
    //toast.instance.hide({ transitionOut: "fadeOut" }, toast.toast);
  } else if (makeChanges) {
    changesNb = 0;
    // toast = infoToast(
    //   "Processing the whole graph (it can takes a few seconds if there is a lot of blocks)..."
    // );
    matchArray.forEach((match) => {
      let node = new Node(match.uid, {
        string: match.content,
        open: match.open,
      });
      replaceOpened(node, find, replace, "", makeChanges);
    });
    //toast.instance.hide({ transitionOut: "fadeOut" }, toast.toast, "button");
  }
  //console.log(matchArray);
};

const wholeGraphPageNameProcessing = (
  promptParameters,
  makeChanges = true,
  toast = null,
  arrayToProcess
) => {
  let findRegex = promptParameters[0];
  let replace = promptParameters[1];
  let searchLogic = "";
  if (promptParameters.length > 2) {
    searchLogic = promptParameters[2];
  }
  if (matchArray.length == 0) {
    initializeGlobalVar();
    const matchingPages = getPagesNamesMatchingRegex(findRegex);
    for (let i = 0; i < matchingPages.length; i++) {
      matchArray.push(matchingPages[i][0]);
      changesNb++;
    }
  } else if (makeChanges) {
    if (arrayToProcess === undefined) arrayToProcess = matchArray;
    arrayToProcess.forEach((match) => {
      modifiedBlocksCopy.push(match);
      roamAlphaAPI.data.page.update({
        page: {
          uid: match.uid,
          title: replaceSubstringOrCaptureGroup(
            match.title,
            findRegex,
            replace
          ),
        },
      });
    });
    lastOperation = "Find and Replace page names";
    //toast.hide({ transitionOut: "fadeOut" }, toast.toast, "button");
  }
  //console.log(matchArray);
};

/******************************************************************************************      
/*	Page <=> Block conversion
/******************************************************************************************/

const changeBlockToPage = async (
  blockUid,
  pageName = "",
  moveContent = false
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
        "doesn't exist, so you can't change it in a page!"
    );
    return null;
  }
  if (pageName == "") pageName = blockContent;
  let pageMention = normalizeMention(pageName, "page");
  if (pageMention === null) return null;
  pageName = pageMention.slice(2, -2);

  let promptParameters = normalizeInputRegex(blockMention, pageMention);
  wholeGraphProcessing(promptParameters, true);
  let pageUid = await getPageUidByNameOrCreateIt(pageName);

  if (moveContent) moveChildBlocks(blockUid, pageUid);
  updateBlock(blockUid, pageMention);
  changesNbBackup = ++changesNb;
};

const changePageToBlock = (pageName, blockUid = "", moveContent = false) => {
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
  wholeGraphProcessing([pageMentionsRegex, blockMention], true);
  if (moveContent) moveChildBlocks(pageUid, blockUid);
  updateBlock(blockUid, pageName);
  changesNbBackup = changesNb;
};

const getPageMentionRegex = (pageName) => {
  return new RegExp(
    pageName + "::|[#]{0,1}\\[\\[" + pageName + "\\]\\]|#" + pageName,
    "g"
  );
};

/******************************************************************************************      
/*	Undo last bulk operation
/******************************************************************************************/

const undoLastBulkOperation = async function (matchesNb) {
  if (lastOperation === "block to page") {
    lastOperation = "page to block";
    changePageToBlock(inputBackup[1], inputBackup[0], inputBackup[4]);
    let temp = inputBackup[1];
    inputBackup[1] = inputBackup[0];
    inputBackup[0] = temp;
  } else if (lastOperation === "page to block") {
    lastOperation = "block to page";
    changeBlockToPage(inputBackup[1], inputBackup[0], inputBackup[4]);
    let temp = inputBackup[1];
    inputBackup[1] = inputBackup[0];
    inputBackup[0] = temp;
  } else if (lastOperation === "Find and Replace page names") {
    let backupArray = [];
    if (modifiedBlocksCopy.length) {
      modifiedBlocksCopy.forEach((match) => {
        backupArray.push({
          uid: match.uid,
          title: getPageTitleByPageUid(match.uid),
        });
        roamAlphaAPI.data.page.update({
          page: {
            uid: match.uid,
            title: match.title,
          },
        });
      });
      modifiedBlocksCopy = [...backupArray];
    }
  } else {
    for (let index = 0; index < modifiedBlocksCopy.length; index++) {
      let uid = modifiedBlocksCopy[index].uid;
      let blockContent = modifiedBlocksCopy[index].content;
      let blockState = modifiedBlocksCopy[index].open;
      updateBlock(uid, blockContent, blockState);
      let block = getBlockAttributes(uid);
      if (formatChange) {
        if (
          block.heading != modifiedBlocksCopy[index].h &&
          modifiedBlocksCopy[index].h != "noChange"
        ) {
          window.roamAlphaAPI.updateBlock({
            block: { uid: uid, heading: modifiedBlocksCopy[index].h },
          });
        }
        if (modifiedBlocksCopy[index].a != "noChange") {
          window.roamAlphaAPI.updateBlock({
            block: { uid: uid, "text-align": modifiedBlocksCopy[index].a },
          });
        }
        if (modifiedBlocksCopy[index].v != "noChange") {
          window.roamAlphaAPI.updateBlock({
            block: {
              uid: uid,
              "children-view-type": modifiedBlocksCopy[index].v,
            },
          });
        }
        let hOld;
        if (block.heading != null) {
          hOld = block.heading;
        } else {
          hOld = 0;
        }
        modifiedBlocksCopy[index] = {
          uid: block.uid,
          content: block.string,
          open: block.open,
          h: hOld,
          a: block["text-align"],
          v: block["view-type"],
        };
      } else {
        modifiedBlocksCopy[index] = {
          uid: block.uid,
          content: block.string,
          open: block.open,
        };
      }
    }
  }
  await undoPopup(matchesNb, 5000, "replace");
};

const undoPopup = async function (
  matchesNb = changesNbBackup,
  timeout = 8000,
  display = "once"
) {
  iziToast.warning({
    timeout: timeout,
    displayMode: display,
    id: "undo",
    color: "#CC6600C0",
    zindex: 999,
    title:
      matchesNb +
      " match(es) replaced! <br>" +
      "Click to undo this '" +
      lastOperation +
      "' operation. Do not use Ctrl + z.",
    close: true,
    buttons: [
      [
        "<button>UNDO</button>",
        (instance, toast) => {
          //lastOperation = "Undo";
          undoLastBulkOperation(matchesNb);
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
        false,
      ],
      [
        "<button>Display changed blocks in sidebar</button>",
        (instance, toast) => {
          displayChangedBlocks(
            false,
            "",
            lastOperation === "Find and Replace page names"
              ? "replace page names"
              : "",
            true
          );
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
        true,
      ],
    ],
  });
};

/******************************************************************************************      
/*	Redo last bulk operation
/******************************************************************************************/
const redoPopup = async function () {
  if (lastOperation === "block to page" || lastOperation === "page to block")
    return;
  if (lastOperation === "Find and Replace")
    findAndReplace(
      lastOperation,
      inputBackup[0],
      inputBackup[1],
      inputBackup[2],
      inputBackup[3],
      inputBackup[4],
      inputBackup[5]
    );
  else if (lastOperation === "Search")
    searchOnly(
      inputBackup[0],
      inputBackup[1],
      inputBackup[2],
      inputBackup[3],
      inputBackup[4]
    );
  else
    iziToast.warning({
      timeout: 20000,
      maxWidth: 420,
      displayMode: "replace",
      id: "undo",
      color: "#CC6600C0",
      zindex: 999,
      position: iziToastPosition,
      title:
        "Are you sure you want to do another time last bulk '" +
        lastOperation +
        "' operation?",
      overlay: true,
      drag: false,
      close: true,
      buttons: [
        [
          "<button>Yes</button>",
          (instance, toast) => {
            let callback;
            switch (lastOperation) {
              case "":
                Alert("No bulk operation has been run.");
                return;
              case "Undo":
                undoLastBulkOperation();
                break;
              case "Append and/or Prepend":
                callback = appendPrepend;
                break;
              case "Find and Replace":
                callback = replaceOpened;
                break;
              case "Change format":
              default:
                callback = changeBlockFormat;
                break;
            }
            while (modifiedBlocksCopy.length > 0) {
              modifiedBlocksCopy.pop();
            }
            selectedNodesProcessing(expandedNodesUid, inputBackup, callback);
            instance.hide({ transitionOut: "fadeOut" }, toast, "button");
          },
          true,
        ],
        [
          "<button>No</button>",
          (instance, toast) => {
            instance.hide({ transitionOut: "fadeOut" }, toast, "button");
          },
        ],
      ],
    });
};

/******************************************************************************************      
/*	Extracting data
/******************************************************************************************/

async function extractContentFromPageOrSelectionByRegex(strRegex, title) {
  initializeGlobalVar();
  getSelection();
  await getNodes();

  let promptParameters = normalizeInputRegex(strRegex, "$1");
  promptParameters.push(false);
  let varBackup = extractMatchesOnly;
  extractMatchesOnly = true;
  selectedNodesProcessing(
    expandedNodesUid,
    promptParameters,
    replaceOpened,
    false
  );

  matchingStringsArray.forEach((match) => {
    match.content = match.replace;
  });

  copyMatchingUidsToClipboard(
    matchingStringsArray,
    `extract ${title}`,
    false,
    false,
    "",
    "page",
    true,
    `${title} extracted`
  );
  infoToast(
    changesNb +
      ` ${title} copied in the clipboard. Paste them anywhere in your graph!`
  );

  displayChangedBlocks(true, `Extracted ${title} on `, "only matching");
  extractMatchesOnly = varBackup;
  initializeNodesArrays();
}
//

/******************************************************************************************      
/*	Generic functions to get the blocks to process
/******************************************************************************************/
const onKeydown = async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key == "s") {
    // let selection = getSelection();
    // await getNodes();
    // if (selection === null) selection = "";
    // searchOnly(selection);
    e.preventDefault();
    return;
  }
};

function getSelectedNodes(selection, inCollapsed = false) {
  // let uniqueUids = [];
  selection.forEach((block) => {
    let inputBlock = block.querySelector(".rm-block__input");
    if (!inputBlock) return;
    let uid = inputBlock.id.slice(-9);
    // if (!uniqueUids.includes(uid)) {
    // uniqueUids.push(uid);
    getNodesFromTree(getTreeByUid(uid), false, expandedNodesUid, inCollapsed);
    // }
  });

  expandedNodesUid = removeDuplicateBlocks(expandedNodesUid);
}

function getCheckedNodes(checkedBlocks) {
  checkedBlocks.forEach((uid) => {
    let node = new Node(uid, getBlockAttributes(uid));
    if (node.content != undefined) {
      expandedNodesUid.push(node);
      node.pushRefs();
    }
  });
}

function getSelection() {
  initializeNodesArrays();
  selectionBlue = false;
  let startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
  let selection = document.querySelectorAll(".block-highlight-blue");

  let checkSelection = roamAlphaAPI.ui.individualMultiselect.getSelectedUids();
  if (!selection.length) selection = null;
  if (startUid || selection || checkSelection.length) {
    if (startUid) {
      let start = document.activeElement.selectionStart;
      let end = document.activeElement.selectionEnd;
      if (start != end)
        selection = getBlockContentByUid(startUid).slice(start, end);
      else selection = null;
    }
    setTimeout(() => {
      simulateClick(document.body);
    }, 50);
    if (!startUid && selection) {
      console.log("Selection !");

      selectedBlocks = selection;
      getSelectedNodes(selectedBlocks);
      selection = null;
      selectionBlue = true;
    }
    if (!startUid && checkSelection.length) {
      selectedBlocks = checkSelection;
      getCheckedNodes(checkSelection);
      selection = null;
      selectionBlue = false;
    }
  }
  // console.log(expandedNodesUid);
  return selection;
}

async function getNodes() {
  if (!selectionBlue) {
    getSelection();
    if (selectedBlocks.length != 0 && !workspace) {
      if (selectedBlocks[0].length == 9)
        getCheckedNodes(selectedBlocks); // checked blocks with ctrl + m
      else getSelectedNodes(selectedBlocks); // classic multiselect
    } else {
      if (workspace) await getWorkspaceNodes();
      else await getNodesInPage();
    }
  }
  if (excludeDuplicate) {
    expandedNodesUid = removeDuplicateBlocks(expandedNodesUid);
    collapsedNodesUid = removeDuplicateBlocks(collapsedNodesUid);
  }
  // console.log("Expanded:");
  // console.log(expandedNodesUid);
  // console.log("Collapsed:");
  // console.log(collapsedNodesUid);
}

function initializeNodesArrays() {
  expandedNodesUid = [];
  collapsedNodesUid = [];
  referencedNodesUid = [];
  uniqueReferences = [];
  refsUids = [];
  selectedBlocks = [];
}

async function getNodesInPage() {
  let zoomUid = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
  if (!zoomUid) getNodesFromDailyNotes();
  else getNodesFromPageZoomAndReferences(zoomUid);
}

function getNodesFromDailyNotes() {
  let dailyNotes = document.querySelectorAll(
    "div.roam-log-page:not(.roam-log-preview)"
  );
  dailyNotes.forEach((dnp) => {
    let blocks = dnp.querySelectorAll(".rm-block-main");
    getSelectedNodes(blocks, true);
  });
}

function getNodesFromPageZoomAndReferences(zoomUid) {
  getNodesFromTree(getTreeByUid(zoomUid), true, expandedNodesUid);

  if (workspace) {
    let mentions = getBlockUidsReferencingBlock(zoomUid);
    getNodesFromLinkedReferences(mentions);
  }
}

async function getWorkspaceNodes() {
  await getNodesInPage();
  getNodesFromSidebarWindows();
}

function getNodesFromLinkedReferences(mentions) {
  mentions.forEach((mentionUid) => {
    let node = new Node(mentionUid, getBlockAttributes(mentionUid));
    if (node.content != undefined) {
      expandedNodesUid.push(node);
      node.pushRefs();

      // Doesn't work currently <= limitation in the API, :block/open doesn't affect
      // blocks in the Linked references section
      // getNodesFromTree(getTreeByUid(mentionUid), false, expandedNodesUid);
    }
  });
}

function getNodesFromSidebarWindows() {
  let sidebarUids = window.roamAlphaAPI.ui.rightSidebar.getWindows();
  sidebarUids.forEach((page) => {
    let uid = "";
    if (!page["collapsed?"]) {
      if (page.type == "block") uid = page["block-uid"];
      if (page.type == "outline" || page.type == "mentions")
        uid = page["page-uid"];
      if (uid != "") {
        if (page.type != "mentions")
          getNodesFromTree(getTreeByUid(uid), false, expandedNodesUid);
        else {
          let mentions = getBlockUidsReferencingBlock(uid);
          getNodesFromLinkedReferences(mentions);
        }
      }
    }
  });
}

const selectedNodesProcessing = async (
  nodesArray,
  parameters,
  bulkFunction,
  displayUndoPopup = true
) => {
  for (let k = 0; k < nodesArray.length; k++) {
    nodeProcessing(nodesArray[k], parameters, bulkFunction);
  }
  if (
    bulkFunction != findAndHighlight &&
    bulkFunction != expandPathBeforeHighlight
  )
    if (displayUndoPopup) undoPopup(changesNb);
};

const nodeProcessing = async (node, parameters, bulkFunction) => {
  let args = [node];
  for (let i = 0; i < parameters.length; i++) {
    args.push(parameters[i]);
  }
  bulkFunction.apply(this, args);
};

const openParentNodes = async (collapsed, forced = false) => {
  for (let i = 0; i < collapsed.length; i++) {
    if (!collapsed[i].open || forced) {
      //setTimeout(() => {
      await window.roamAlphaAPI.updateBlock({
        block: {
          uid: collapsed[i].uid,
          open: true,
        },
      });
      collapsed[i].open = true;
      //}, 20);
    }
  }
};

function getNodesFromTree(
  tree,
  first,
  nodeArray,
  inCollapsedtree = false,
  collapsedParents = []
) {
  if (first) nodeArray.length = 0;
  let attr;
  let node;
  let children = tree[":block/children"];
  let isOpen = tree[":block/open"];
  let string = tree[":block/string"];
  let isPage = ":block/order" in tree ? false : true;
  let refs =
    tree[":block/refs"] == undefined
      ? []
      : tree[":block/refs"].map((a) => a[":block/uid"]);
  if (!isPage) {
    attr = {
      string: string,
      open: isOpen,
      collapsedParents: collapsedParents,
      refs: refs,
      page: tree[":block/page"][":block/uid"], // TODO : page est parfois un tableau ????
    };
    node = new Node(tree[":block/uid"], attr);
    node.pushRefs();
    if (node.isEmbeded() && includeEmbeds) node.pushEmbedTree();
    else {
      nodeArray.push(node);
    }
  }
  if (children) {
    let newCollapsedParentsArray = Array.from(collapsedParents);
    if (!isOpen && !first) {
      newCollapsedParentsArray.push(node);
    }
    for (let j = 0; j < children.length; j++) {
      if (
        inCollapsedtree ||
        (tree[":block/string"] != undefined && !isOpen && !first)
      )
        getNodesFromTree(
          children[j],
          false,
          collapsedNodesUid,
          true,
          newCollapsedParentsArray
        );
      else
        getNodesFromTree(
          children[j],
          false,
          expandedNodesUid,
          false,
          newCollapsedParentsArray
        );
    }
  }
}

async function copyMatchingUidsToClipboard(
  array,
  find,
  caseInsensitive,
  embed = false,
  replace = "",
  range = "page",
  matches = extractMatchesOnly,
  title = ""
) {
  let embStr1 = "";
  let embStr2 = "";
  if (embed) {
    embStr1 = "{{embed-path: ";
    embStr2 = "}}";
  }
  if (matches) {
    array = matchingStringsArray;
    if (array.length > 0 && array[0].groups.length > 0) {
      array.forEach((match) => {
        match.content = match.replace;
      });
    }
  }
  if (matchesSortedBy === "page") array = sortByPageTitle(array);
  else if (matchesSortedBy === "date") array = sortByEditTime(array);
  let uids = getUniqueUidsArray(array);

  if (caseInsensitive) find += " (case insensitive)";
  if (title === "") {
    title =
      "Search results[*]([[roam/depot/find & replace]]) on: `" + find + "`";
    if (matches) title += " (only strings matching the regex)";
    if (replace != "") title += ", to replace by `" + replace + "`";
  }
  let pageStr = " in the whole graph, ";
  if (range != "whole graph") {
    let zoomUid =
      await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
    let pageTitle = getPageTitleByBlockUid(zoomUid);
    if (pageTitle === "") pageTitle = getPageTitleByPageUid(zoomUid);
    pageStr = " in `" + pageTitle + "` page, ";
  }
  title += pageStr + getNowDateAndTime();

  let displayArray = [];
  if (!matches) {
    for (let i = 0; i < uids.length; i++) {
      displayArray.push("  - " + embStr1 + "((" + uids[i] + "))" + embStr2);
    }
  } else {
    for (let i = 0; i < array.length; i++) {
      displayArray.push(
        "  - " + array[i].content + " [*](((" + array[i].uid + ")))"
      );
    }
  }
  let stringToPaste = title + "\n" + displayArray.join("\n");

  navigator.clipboard.writeText(stringToPaste);
}

const copyMatchingPagesToClipbard = () => {
  let stringToPaste = "";
  if (matchArray.length) {
    for (let i = 0; i < matchArray.length; i++) {
      stringToPaste += `[[${matchArray[i].title}]]\n\n`;
    }
  }
  navigator.clipboard.writeText(stringToPaste.trim());
};

function insertChangedBlocks(startUid, blocksArray, title, mode, isChanged) {
  if (blocksArray.length == 0) return null;

  let parentUid = window.roamAlphaAPI.util.generateUID();
  let shift = 0;
  window.roamAlphaAPI.createBlock({
    location: { "parent-uid": startUid, order: 0 },
    block: {
      uid: parentUid,
      string: title,
    },
  });
  if (displayBefore && isChanged) {
    let blockUid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createBlock({
      location: { "parent-uid": parentUid, order: 0 },
      block: { uid: blockUid, string: "{{table}}", open: false },
    });
    parentUid = blockUid;
    let afterUid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createBlock({
      location: { "parent-uid": blockUid, order: 0 },
      block: { uid: afterUid, string: "After Replace" },
    });
    window.roamAlphaAPI.createBlock({
      location: { "parent-uid": afterUid, order: 0 },
      block: { string: "Before Replace" },
    });
    shift = shift + 1;
  }
  let embStr1 = "";
  let embStr2 = "";
  if (showPath) {
    embStr1 = "{{embed-path: ";
    embStr2 = "}}";
  }
  blocksArray.forEach((block, i) => {
    let blockUid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createBlock({
      location: { "parent-uid": parentUid, order: i + shift },
      block: {
        uid: blockUid,
        string:
          mode === "replace page names"
            ? "[[" +
              (isChanged ? getPageTitleByPageUid(block.uid) : block.title) +
              "]]"
            : mode === "only matching"
            ? block.content + ` [*](((${block.uid})))`
            : embStr1 + "((" + block.uid + "))" + embStr2,
      },
    });
    if (displayBefore && isChanged && mode !== "only matching")
      window.roamAlphaAPI.createBlock({
        location: { "parent-uid": blockUid, order: 0 },
        block: {
          string:
            mode !== "replace page names"
              ? block.content
              : "`[[" + block.title + "]]`",
        },
      });
  });
  return parentUid;
}

function displayChangedBlocks(onlySearch = false, title = "", mode, isChanged) {
  let pageUid, parentUid;
  pageUid = getExtensionPageUidOrCreateIt();
  let timestamp = getNowDateAndTime();
  let array = [];
  if (!onlySearch) {
    title =
      "List of blocks changed by last Find & Replace operation on " + timestamp;
    array = modifiedBlocksCopy;
  } else {
    title += timestamp;
    if (
      extractMatchesOnly &&
      (isRegex || title.toLowerCase().includes("extract"))
    )
      array = matchingStringsArray;
    else array = matchArray;
  }

  if (matchesSortedBy === "page") array = sortByPageTitle(array);
  else if (matchesSortedBy === "date") array = sortByEditTime(array);
  parentUid = insertChangedBlocks(pageUid, array, title, mode, isChanged);
  window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: { type: "block", "block-uid": parentUid },
  });
}

function getExtensionPageUidOrCreateIt() {
  let pageUid = getPageUidByPageName("roam/depot/find & replace");
  if (pageUid === undefined) {
    pageUid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createPage({
      page: { title: "roam/depot/find & replace", uid: pageUid },
    });
  }
  return pageUid;
}

/******************************************************************************************      
/*	Load / Unload
/******************************************************************************************/

const panelConfig = {
  tabTitle: "Find and replace",
  settings: [
    {
      id: "colorSetting",
      name: "Highlights color",
      description: "Color of the highlights of matching strings:",
      action: {
        type: "select",
        items: ["Orange", "Blue", "Fuschia", "Green", "Silver", "Yellow"],
        onChange: (evt) => {
          setHighlightColor(evt);
        },
      },
    },
    {
      id: "positionSetting",
      name: "Dialog box position",
      description: "Default position of the dialog box:",
      action: {
        type: "select",
        items: ["topRight", "bottomRight", "bottomLeft", "topLeft"],
        onChange: (evt) => {
          iziToastPosition = evt;
        },
      },
    },
    {
      id: "expandSetting",
      name: "Include collapsed blocks",
      description:
        "Always include matches in collapsed blocks when clicking on 'Replace all':",
      action: {
        type: "switch",
        onChange: (evt) => {
          includeCollapsed = !includeCollapsed;
        },
      },
    },
    {
      id: "embedSetting",
      name: "Include embeded blocks",
      description:
        "Include embeded blocks (and their children) in Find & Replace operation on page:",
      action: {
        type: "switch",
        onChange: (evt) => {
          includeEmbeds = !includeEmbeds;
        },
      },
    },
    {
      id: "duplicateSetting",
      name: "Highlight only once",
      description:
        "In 'Search on page', do not highlight duplicates matches, only original block or first reference (automatic in Find & Replace):",
      action: {
        type: "switch",
        onChange: (evt) => {
          excludeDuplicate = !excludeDuplicate;
        },
      },
    },
    {
      id: "beforeSetting",
      name: "Compare to previous state",
      description:
        "Display changed blocks in a table where the new state is compared to previous state:",
      action: {
        type: "switch",
        onChange: (evt) => {
          displayBefore = !displayBefore;
        },
      },
    },
    // {
    //   id: "wholeSetting",
    //   name: "Display 'Whole Graph' commands",
    //   description:
    //     "Display 'Whole Graph' Find & Replace and Block <=> Page conversion command in command palette (Danger Zone)",
    //   action: {
    //     type: "switch",
    //     onChange: (evt) => {
    //       allowWhole = !allowWhole;
    //       loadWholeGraphCommand(allowWhole);
    //     },
    //   },
    // },
    {
      id: "sortSetting",
      name: "Sort results",
      description:
        "Sort global search results by page name or date (last edit time, most recent first):",
      action: {
        type: "select",
        items: ["page", "date"],
        onChange: (evt) => {
          matchesSortedBy = evt;
        },
      },
    },
    {
      id: "pathSetting",
      name: "Show path of search results",
      description:
        "Result of whole graph search are, when copied or opened is sidebar, are rendered as 'embed path' references:",
      action: {
        type: "switch",
        onChange: (evt) => {
          showPath = !showPath;
        },
      },
    },
    {
      id: "matchSetting",
      name: "Extract only matching strings, not blocks",
      description:
        "Extract only strings matching the regular expression (or replacing string if defined) when results are displayed or copied to clipboard:",
      action: {
        type: "switch",
        onChange: (evt) => {
          extractMatchesOnly = !extractMatchesOnly;
        },
      },
    },
    {
      id: "truncateSetting",
      name: "Truncate code blocks",
      description:
        "Number of characters beyond which to truncate the code blocks in the plain text overview of search result:",
      action: {
        type: "input",
        onChange: (evt) => {
          codeBlockLimit = evt.target.value;
        },
      },
    },
  ],
};

function setHighlightColor(color) {
  switch (color) {
    case "Orange":
      highlightColor = "#FFA500";
      break;
    case "Blue":
      highlightColor = "#87CEEB";
      break;
    case "Fuschia":
      highlightColor = "#FF00FF";
      break;
    case "Green":
      highlightColor = "#00FF00";
      break;
    case "Silver":
      highlightColor = "#C0C0C0";
      break;
    case "Yellow":
      highlightColor = "#FFFF00";
      break;
  }
}

// function loadWholeGraphCommand(load = true) {
//   if (!load) {
//     window.roamAlphaAPI.ui.commandPalette.removeCommand({
//       label: frgLabel,
//     });
//     window.roamAlphaAPI.ui.commandPalette.removeCommand({
//       label: "Find & Replace: " + ptobLabel,
//     });
//     window.roamAlphaAPI.ui.commandPalette.removeCommand({
//       label: "Find & Replace: " + btopLabel,
//     });
//     wholeGraph = false;
//     return;
//   }
// }

export default {
  onload: async ({ extensionAPI }) => {
    extensionAPI.settings.panel.create(panelConfig);
    if (extensionAPI.settings.get("colorSetting") == null)
      await extensionAPI.settings.set("colorSetting", "Orange");
    setHighlightColor(extensionAPI.settings.get("colorSetting"));
    if (extensionAPI.settings.get("positionSetting") == null)
      await extensionAPI.settings.set("positionSetting", "topRight");
    iziToastPosition = extensionAPI.settings.get("positionSetting");
    if (extensionAPI.settings.get("expandSetting") == null)
      await extensionAPI.settings.set("expandSetting", true);
    includeCollapsed = extensionAPI.settings.get("expandSetting");
    if (extensionAPI.settings.get("embedSetting") == null)
      await extensionAPI.settings.set("embedSetting", false);
    includeEmbeds = extensionAPI.settings.get("embedSetting");
    if (extensionAPI.settings.get("duplicateSetting") == null)
      await extensionAPI.settings.set("duplicateSetting", false);
    excludeDuplicate = extensionAPI.settings.get("duplicateSetting");
    if (extensionAPI.settings.get("beforeSetting") == null)
      await extensionAPI.settings.set("beforeSetting", false);
    displayBefore = extensionAPI.settings.get("beforeSetting");
    // if (extensionAPI.settings.get("wholeSetting") == null)
    //   extensionAPI.settings.set("wholeSetting", false);
    // allowWhole = extensionAPI.settings.get("wholeSetting");
    if (extensionAPI.settings.get("sortSetting") == null)
      await extensionAPI.settings.set("sortSetting", "page");
    matchesSortedBy = extensionAPI.settings.get("sortSetting");
    if (extensionAPI.settings.get("pathSetting") == null)
      await extensionAPI.settings.set("pathSetting", false);
    showPath = extensionAPI.settings.get("pathSetting");
    if (extensionAPI.settings.get("matchSetting") == null)
      await extensionAPI.settings.set("matchSetting", false);
    extractMatchesOnly = extensionAPI.settings.get("matchSetting");
    if (extensionAPI.settings.get("truncateSetting") == null)
      await extensionAPI.settings.set("truncateSetting", 150);
    codeBlockLimit = extensionAPI.settings.get("truncateSetting");

    window.addEventListener("keydown", onKeydown);

    extensionAPI.ui.commandPalette.addCommand({
      label: sipLabel,
      callback: () => {
        let selection = getSelection();
        if (selection === null) selection = "";
        //await getNodes();
        searchOnly(selection);
      },
      "default-hotkey": "ctrl-s",
    });

    extensionAPI.ui.commandPalette.addCommand({
      label: frpLabel,
      callback: () => {
        let selection = getSelection();
        if (selection === null) selection = "";
        //await getNodes();
        findAndReplace("Find & Replace in page or workspace", selection);
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: frwLabel,
      callback: async () => {
        workspace = true;
        await getWorkspaceNodes();
        findAndReplace(
          "Find & Replace in page or workspace",
          "",
          "",
          "",
          "",
          "",
          true
        );
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: formLabel,
      callback: () => {
        getSelection();
        if (expandedNodesUid.length == 0) {
          infoToast(
            "Some blocks have to be selected to apply bulk change format."
          );
          return;
        }
        changeBlockFormatPrompt(formLabel);
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: " + swgLabel,
      callback: async () => {
        wholeGraph = true;
        await findAndReplaceInWholeGraph(swgLabel, "search");
      },
    });
    //    if (allowWhole) loadWholeGraphCommand();
    extensionAPI.ui.commandPalette.addCommand({
      label: frgLabel,
      callback: async () => {
        wholeGraph = true;
        await findAndReplaceInWholeGraph(
          "Whole graph Find & Replace",
          "replace"
        );
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: frpPageLabel,
      callback: async () => {
        wholeGraph = true;
        await findAndReplaceInWholeGraph(
          "[[Page Names]] bulk change",
          "replace page names"
        );
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: " + ptobLabel,
      callback: async () => {
        wholeGraph = true;
        let mention = normalizeMention(
          await navigator.clipboard.readText(),
          "page",
          true
        );
        if (mention === null) mention = "";
        await findAndReplaceInWholeGraph(ptobLabel, "page to block", mention);
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: " + btopLabel,
      callback: async () => {
        wholeGraph = true;
        let mention = normalizeMention(
          await navigator.clipboard.readText(),
          "block",
          true
        );
        if (mention === null) mention = "";
        await findAndReplaceInWholeGraph(btopLabel, "block to page", mention);
      },
    });
    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: Undo last operation",
      callback: async () => {
        await undoLastBulkOperation();
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: Redo last operation",
      callback: async () => {
        await redoPopup();
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Prepend or append content to selected blocks",
      callback: () => {
        isPrepending = true;
        getSelection();
        if (expandedNodesUid.length == 0) {
          ("Some blocks have to be selected to apply bulk prepend or append.");
          return;
        }
        appendPrependDialog();
        isPrepending = false;
      },
    });

    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: Insert last changed blocks (references)",
      callback: async () => {
        let startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
        insertChangedBlocks(
          startUid,
          modifiedBlocksCopy,
          "Last changed blocks:"
        );
      },
    });

    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: Extract highlights in selection or page",
      callback: async () => {
        await extractContentFromPageOrSelectionByRegex(
          `/\\^\\^([^\\^]*)\\^\\^/g`,
          "highlighted text"
        );
      },
    });

    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: Extract bold text in selection or page",
      callback: async () => {
        await extractContentFromPageOrSelectionByRegex(
          `/\\*\\*([^\\*]*)\\*\\*/g`,
          "bold text"
        );
      },
    });

    roamAlphaAPI.ui.blockContextMenu.addCommand({
      label: "Convert this block => [[Page]]",
      "display-conditional": (e) => e["block-string"].length > 0,
      callback: (e) => {
        wholeGraph = true;
        findAndReplaceInWholeGraph(
          btopLabel,
          "block to page",
          normalizeMention(e["block-uid"], "block"),
          normalizeMention(e["block-string"], "page"),
          false,
          false,
          true
        );
      },
    });
    roamAlphaAPI.ui.blockContextMenu.addCommand({
      label: "Convert some [[page]] => this block",
      "display-conditional": (e) => e["block-string"].length == 0,
      callback: (e) => {
        wholeGraph = true;
        findAndReplaceInWholeGraph(
          btopLabel,
          "page to block",
          "",
          normalizeMention(e["block-uid"], "block"),
          false,
          false,
          true
        );
      },
    });

    iziToast.settings({
      theme: "dark",
      class: "fr-toast",
      color: iziToastColor,
      position: iziToastPosition,
      maxWidth: 375,
      layout: 2,
      zindex: 9,
      drag: false,
      timeout: false,
      closeOnEscape: true,
      closeOnClick: false,
      overlay: false,
      overlayClose: false,
      displayMode: 2,
      animateInside: false,
    });

    console.log("Find & replace loaded.");
  },
  onunload: () => {
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("keydown", onKeyArrows);

    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: "Find & Replace: Undo last operation",
    });
    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: "Find & Replace: Insert last changed blocks (references)",
    });
    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: "Find & Replace: Extract highlights in selection or page",
    });
    roamAlphaAPI.ui.blockContextMenu.removeCommand({
      label: "Convert some [[page]] => this block",
    });
    roamAlphaAPI.ui.blockContextMenu.removeCommand({
      label: "Convert this block => [[Page]]",
    });
    console.log("Find & replace unloaded.");
  },
};
