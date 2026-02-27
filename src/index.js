import React from "react";
import ReactDOM from "react-dom";
import { normalizeMention, getPageNameByPageUid } from "./utils";

import { insertChangedBlocks } from "./copyResults";
import state from "./state";
import { openPanel } from "./panelBridge";
import {
  findAndReplaceInWholeGraph,
  openPageBlockConversionPanel,
  setWholeGraphDeps,
  doGraphReplace,
  doGraphReplacePageNames,
  doGraphBlockToPage,
  doGraphPageToBlock,
  doGraphDisplayResults,
  doGraphDisplayResultsSidebar,
  doGraphCopyRefs,
  doPageTitlesReplace,
  doPageTitlesDisplayResults,
  doPageBlockDisplayResults,
} from "./wholeGraph";
import {
  onKeydown,
  getSelection,
  getWorkspaceNodes,
  getSelectionFromMsContextMenuArgs,
} from "./nodeTraversal";
import {
  highlightAllMatches,
  expandPathBeforeHighlight,
  findAndHighlight,
  highlightString,
  highlightNextMatch,
  actualizeHighlights,
  removeHighlightedNodes,
  setHighlightingDeps,
} from "./highlighting";
import {
  undoLastBulkOperation,
  undoPopup,
  redoPopup,
  setUndoRedoDeps,
} from "./undoRedo";
import {
  appendPrepend,
  appendPrependDialog,
  doAppendPrepend,
  doFormatChange,
  changeBlockFormat,
  setBlockOperationsDeps,
} from "./blockOperations";
import {
  extractContentFromPageOrSelectionByRegex,
  setExtractContentDeps,
} from "./extractContent";
import {
  searchOnly,
  setSearchDialogDeps,
  onSearchClose,
  displaySearchResustsInPlainText,
} from "./searchDialog";
import {
  findAndReplace,
  replaceOpened,
  setFindReplaceDeps,
  doReplace,
  doReplaceAll,
  onFindReplaceClose,
} from "./findReplaceDialog";
import {
  helpToast,
  initializeGlobalVar,
  displayMatchCountInTitle,
  setHelpersDeps,
} from "./helpers";
import { normalizeInputRegex } from "./utils";
import { copyMatchingUidsToClipboard } from "./copyResults";
import UnifiedSearchPanel from "./components/UnifiedSearchPanel";

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
// Persistent React root for the unified search panel
let _panelRoot = null;
let _panelContainer = null;

const selectedNodesProcessing = async (
  nodesArray,
  parameters,
  bulkFunction,
  displayUndoPopup = true,
) => {
  for (let k = 0; k < nodesArray.length; k++) {
    await nodeProcessing(nodesArray[k], parameters, bulkFunction);
  }
  if (
    bulkFunction != findAndHighlight &&
    bulkFunction != expandPathBeforeHighlight
  )
    if (displayUndoPopup)
      undoPopup(
        state.changesNb,
        parameters.length && parameters[0],
        parameters.length > 1 && parameters[1],
      );
};

const nodeProcessing = async (node, parameters, bulkFunction) => {
  let args = [node];
  for (let i = 0; i < parameters.length; i++) {
    args.push(parameters[i]);
  }
  await bulkFunction.apply(this, args);
};

/******************************************************************************************      
/*	Load / Unload
/******************************************************************************************/

const panelConfig = {
  tabTitle: "Find and replace",
  settings: [
    {
      id: "panelPositionSetting",
      name: "Search panel default position",
      description:
        "Initial position of the search/replace panel when no saved position exists (or saved position is off-screen):",
      action: {
        type: "select",
        items: [
          "top right",
          "top left",
          "bottom right",
          "bottom left",
          "center",
          "center left",
          "center right",
        ],
        onChange: (evt) => {
          state.panelPosition = evt;
        },
      },
    },
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
      id: "expandSetting",
      name: "Include collapsed blocks",
      description:
        "Always include matches in collapsed blocks when clicking on 'Replace all':",
      action: {
        type: "switch",
        onChange: (evt) => {
          state.includeCollapsed = !state.includeCollapsed;
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
          state.includeEmbeds = !state.includeEmbeds;
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
          state.excludeDuplicate = !state.excludeDuplicate;
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
          state.displayBefore = !state.displayBefore;
        },
      },
    },
    {
      id: "sortSetting",
      name: "Sort results",
      description:
        "Sort global search results by page name or date (last edit time, most recent first):",
      action: {
        type: "select",
        items: ["page", "date"],
        onChange: (evt) => {
          state.matchesSortedBy = evt;
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
          state.showPath = !state.showPath;
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
          state.extractMatchesOnly = !state.extractMatchesOnly;
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
          state.codeBlockLimit = evt.target.value;
        },
      },
    },
  ],
};

function setHighlightColor(color) {
  switch (color) {
    case "Orange":
      state.highlightColor = "#FFA500";
      break;
    case "Blue":
      state.highlightColor = "#87CEEB";
      break;
    case "Fuschia":
      state.highlightColor = "#FF00FF";
      break;
    case "Green":
      state.highlightColor = "#00FF00";
      break;
    case "Silver":
      state.highlightColor = "#C0C0C0";
      break;
    case "Yellow":
      state.highlightColor = "#FFFF00";
      break;
  }
}

// Wire up dependencies for extracted modules
setWholeGraphDeps({
  initializeGlobalVar,
  replaceOpened,
  highlightString,
  highlightAllMatches,
  undoPopup,
});

setHighlightingDeps({
  selectedNodesProcessing,
  displayMatchCountInTitle,
  referencesRegex,
});

setUndoRedoDeps({
  findAndReplace,
  searchOnly,
  appendPrepend,
  replaceOpened,
  changeBlockFormat,
  selectedNodesProcessing,
});

setBlockOperationsDeps({
  selectedNodesProcessing,
  initializeGlobalVar,
  replaceOpened,
  referencesRegexStr,
});

setExtractContentDeps({
  initializeGlobalVar,
  selectedNodesProcessing,
  replaceOpened,
});

setSearchDialogDeps({
  initializeGlobalVar,
  selectedNodesProcessing,
  replaceOpened,
});

setFindReplaceDeps({
  initializeGlobalVar,
  displayMatchCountInTitle,
  selectedNodesProcessing,
  undoPopup,
  referencesRegex,
});

setHelpersDeps({
  examplesOfRegex,
});

export default {
  onload: async ({ extensionAPI }) => {
    extensionAPI.settings.panel.create(panelConfig);
    if (extensionAPI.settings.get("colorSetting") == null)
      await extensionAPI.settings.set("colorSetting", "Orange");
    setHighlightColor(extensionAPI.settings.get("colorSetting"));
    if (extensionAPI.settings.get("expandSetting") == null)
      await extensionAPI.settings.set("expandSetting", true);
    state.includeCollapsed = extensionAPI.settings.get("expandSetting");
    if (extensionAPI.settings.get("embedSetting") == null)
      await extensionAPI.settings.set("embedSetting", false);
    state.includeEmbeds = extensionAPI.settings.get("embedSetting");
    if (extensionAPI.settings.get("duplicateSetting") == null)
      await extensionAPI.settings.set("duplicateSetting", false);
    state.excludeDuplicate = extensionAPI.settings.get("duplicateSetting");
    if (extensionAPI.settings.get("beforeSetting") == null)
      await extensionAPI.settings.set("beforeSetting", false);
    state.displayBefore = extensionAPI.settings.get("beforeSetting");
    if (extensionAPI.settings.get("sortSetting") == null)
      await extensionAPI.settings.set("sortSetting", "page");
    state.matchesSortedBy = extensionAPI.settings.get("sortSetting");
    if (extensionAPI.settings.get("pathSetting") == null)
      await extensionAPI.settings.set("pathSetting", false);
    state.showPath = extensionAPI.settings.get("pathSetting");
    if (extensionAPI.settings.get("matchSetting") == null)
      await extensionAPI.settings.set("matchSetting", false);
    state.extractMatchesOnly = extensionAPI.settings.get("matchSetting");
    if (extensionAPI.settings.get("truncateSetting") == null)
      await extensionAPI.settings.set("truncateSetting", 150);
    state.codeBlockLimit = extensionAPI.settings.get("truncateSetting");

    if (extensionAPI.settings.get("panelPositionSetting") == null)
      await extensionAPI.settings.set("panelPositionSetting", "top right");
    state.panelPosition = extensionAPI.settings.get("panelPositionSetting");

    // Initialize input history storage
    if (extensionAPI.settings.get("historyFind") == null)
      await extensionAPI.settings.set("historyFind", {
        history: [],
        favorites: [],
      });
    if (extensionAPI.settings.get("historyReplace") == null)
      await extensionAPI.settings.set("historyReplace", {
        history: [],
        favorites: [],
      });
    if (extensionAPI.settings.get("historyPrefixSuffix") == null)
      await extensionAPI.settings.set("historyPrefixSuffix", {
        history: [],
        favorites: [],
      });

    // Load last saved panel XY position (persisted across sessions)
    const savedXY = extensionAPI.settings.get("panelLastXY");
    if (
      savedXY &&
      typeof savedXY.x === "number" &&
      typeof savedXY.y === "number" &&
      savedXY.x >= 0 &&
      savedXY.x < window.innerWidth - 50 &&
      savedXY.y >= 0 &&
      savedXY.y < window.innerHeight - 50
    ) {
      state.panelInitialXY = savedXY;
    }

    // Wire up the save callback so the panel can persist its position
    state.savePanelXY = (x, y) => {
      extensionAPI.settings.set("panelLastXY", { x, y });
    };

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
        state.workspace = true;
        await getWorkspaceNodes();
        findAndReplace(
          "Find & Replace in page or workspace",
          "",
          "",
          "",
          "",
          "",
          true,
        );
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: formLabel,
      callback: () => {
        state.changesNb = 0;
        state.formatChange = false;
        openPanel({
          mode: "format",
          label: "Bulk change format of selected blocks",
        });
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: " + swgLabel,
      callback: async () => {
        state.wholeGraph = true;
        await findAndReplaceInWholeGraph(swgLabel, "search");
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: frgLabel,
      callback: async () => {
        state.wholeGraph = true;
        await findAndReplaceInWholeGraph(
          "Whole graph Find & Replace",
          "replace",
        );
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: frpPageLabel,
      callback: async () => {
        state.wholeGraph = true;
        await findAndReplaceInWholeGraph(
          "[[Page Names]] bulk change",
          "replace page names",
        );
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: " + ptobLabel,
      callback: async () => {
        state.wholeGraph = true;
        let mention = normalizeMention(
          await navigator.clipboard.readText(),
          "page",
          true,
        );
        if (mention === null) mention = "";
        openPageBlockConversionPanel("pageToBlock", mention);
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: " + btopLabel,
      callback: async () => {
        state.wholeGraph = true;
        let mention = normalizeMention(
          await navigator.clipboard.readText(),
          "block",
          true,
        );
        if (mention === null) mention = "";
        openPageBlockConversionPanel("blockToPage", mention);
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
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
      label: "Find & Replace: Prepend or append content to selected blocks",
      callback: () => {
        state.isPrepending = true;
        getSelection();
        if (state.expandedNodesUid.length == 0) {
          ("Some blocks have to be selected to apply bulk prepend or append.");
          return;
        }
        appendPrependDialog();
        state.isPrepending = false;
      },
    });

    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: Insert last changed blocks (references)",
      callback: async () => {
        let startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
        insertChangedBlocks(
          startUid,
          state.modifiedBlocksCopy,
          "Last changed blocks:",
        );
      },
    });

    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: Extract highlights in selection or page",
      callback: async () => {
        await extractContentFromPageOrSelectionByRegex(
          `/\\^\\^([^\\^]*)\\^\\^/g`,
          "highlighted text",
        );
      },
    });

    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: Extract bold text in selection or page",
      callback: async () => {
        await extractContentFromPageOrSelectionByRegex(
          `/\\*\\*([^\\*]*)\\*\\*/g`,
          "bold text",
        );
      },
    });

    window.roamAlphaAPI.ui.blockContextMenu.addCommand({
      label: "Convert this block => [[Page]]",
      "display-conditional": (e) => e["block-string"].length > 0,
      callback: (e) => {
        state.wholeGraph = true;
        openPageBlockConversionPanel(
          "blockToPage",
          normalizeMention(e["block-uid"], "block"),
          normalizeMention(e["block-string"], "page"),
        );
      },
    });
    window.roamAlphaAPI.ui.blockContextMenu.addCommand({
      label: "Convert some [[page]] => this block",
      "display-conditional": (e) => e["block-string"].length == 0,
      callback: (e) => {
        state.wholeGraph = true;
        openPageBlockConversionPanel(
          "pageToBlock",
          "",
          normalizeMention(e["block-uid"], "block"),
        );
      },
    });

    // Multiselect context menu commands
    window.roamAlphaAPI.ui.msContextMenu.addCommand({
      label: "Find & Replace: Find & Replace in selection",
      callback: (args) => {
        getSelectionFromMsContextMenuArgs(args);
        findAndReplace("Find & Replace in page or workspace", "");
      },
    });
    window.roamAlphaAPI.ui.msContextMenu.addCommand({
      label: "Find & Replace: Prepend or append to selection",
      callback: (args) => {
        state.changesNb = 0;
        getSelectionFromMsContextMenuArgs(args);
        openPanel({
          mode: "appendPrepend",
          label: "Prepend or append to selected blocks",
        });
      },
    });
    window.roamAlphaAPI.ui.msContextMenu.addCommand({
      label: "Find & Replace: Bulk change format of selection",
      callback: (args) => {
        state.changesNb = 0;
        state.formatChange = false;
        getSelectionFromMsContextMenuArgs(args);
        openPanel({
          mode: "format",
          label: "Bulk change format of selected blocks",
        });
      },
    });

    // Page context menu commands
    window.roamAlphaAPI.ui.pageContextMenu.addCommand({
      label: "Find & Replace: Page ⇒ Block conversion",
      callback: (args) => {
        state.wholeGraph = true;
        const pageName = args["page-title"] ?? "";
        openPageBlockConversionPanel(
          "pageToBlock",
          normalizeMention(pageName, "page"),
        );
      },
    });

    // Page reference context menu commands
    window.roamAlphaAPI.ui.pageRefContextMenu.addCommand({
      label: "Find & Replace: Page ⇒ Block conversion",
      callback: (args) => {
        state.wholeGraph = true;
        const pageName = getPageNameByPageUid(args["ref-uid"]) ?? "";
        openPageBlockConversionPanel(
          "pageToBlock",
          normalizeMention(pageName, "page"),
        );
      },
    });

    // Mount the persistent UnifiedSearchPanel React tree
    _panelContainer = document.createElement("div");
    _panelContainer.id = "fr-unified-panel-root";
    document.body.appendChild(_panelContainer);
    const root = ReactDOM.createRoot(_panelContainer);
    _panelRoot = root;

    const callbacks = {
      extensionAPI,
      // Page/workspace/selection search
      onActualizeHighlights: (findInput, ci, wo, expand, sl, scope) => {
        state.frozenNodes = scope === "selection";
        actualizeHighlights(findInput, ci, wo, expand, sl);
      },
      onHighlightNext: (shift) => highlightNextMatch(shift),
      onRefresh: (findInput, ci, wo, expand, sl, scope) => {
        state.frozenNodes = scope === "selection";
        actualizeHighlights(findInput, ci, wo, expand, sl);
      },
      onRemoveHighlights: () => removeHighlightedNodes(),
      onCopyRefs: (findInput, replaceInput, ci, sl, mode) =>
        copyMatchingUidsToClipboard(findInput, replaceInput, ci, sl, mode),
      onDisplayResults: (findInput, replaceInput, ci, wo, sl) => {
        const promptParams = normalizeInputRegex(
          findInput,
          replaceInput,
          ci,
          wo,
          sl,
        );
        if (promptParams)
          displaySearchResustsInPlainText(promptParams, findInput);
      },
      onHelp: () => helpToast(),
      // Page find & replace
      onReplace: (findInput, replaceInput, ci, wo, sl) =>
        doReplace(findInput, replaceInput, ci, wo, sl),
      onReplaceAll: (findInput, replaceInput, ci, wo, sl) =>
        doReplaceAll(findInput, replaceInput, ci, wo, sl),
      // Lifecycle
      onSearchClose: (findInput, ci, wo, expand, workspace) => {
        state.frozenNodes = false;
        onSearchClose(findInput, ci, wo, expand, workspace);
      },
      onFindReplaceClose: (
        findInput,
        replaceInput,
        ci,
        wo,
        expand,
        workspace,
      ) => {
        state.frozenNodes = false;
        onFindReplaceClose(findInput, replaceInput, ci, wo, expand, workspace);
      },
      // Graph actions
      onGraphReplace: (findInput, replaceInput, ci, wo, sl) =>
        doGraphReplace(findInput, replaceInput, ci, wo, sl),
      onGraphReplacePageNames: (findInput, replaceInput) =>
        doGraphReplacePageNames(findInput, replaceInput),
      onGraphDisplayResults: (
        findInput,
        ci,
        wo,
        sl,
        graphSubMode,
        replaceInput,
      ) =>
        doGraphDisplayResults(
          findInput,
          ci,
          wo,
          sl,
          graphSubMode,
          replaceInput,
        ),
      onGraphDisplayResultsSidebar: (findInput, ci, wo, sl, graphSubMode) =>
        doGraphDisplayResultsSidebar(findInput, ci, wo, sl, graphSubMode),
      onGraphCopyRefs: (findInput, replaceInput, ci, wo, sl, graphSubMode) =>
        doGraphCopyRefs(findInput, replaceInput, ci, wo, sl, graphSubMode),
      // Page titles scope
      onPageTitlesReplace: (findInput, replaceInput) =>
        doPageTitlesReplace(findInput, replaceInput),
      onPageTitlesDisplayResults: (findInput, replaceInput) =>
        doPageTitlesDisplayResults(findInput, replaceInput),
      // Append/Prepend tab — detect current selection, populate state, return block count
      onCheckSelection: () => {
        // If nodes were pre-populated from a context menu (frozenNodes), return count directly
        if (state.frozenNodes && state.expandedNodesUid.length > 0) {
          return state.expandedNodesUid.length;
        }
        // Check both multiselect APIs before calling getSelection()
        const dragSelected = document.querySelectorAll(".block-highlight-blue");
        const cmdSelected =
          window.roamAlphaAPI.ui.individualMultiselect.getSelectedUids?.() ??
          [];
        const multiSelected =
          window.roamAlphaAPI.ui.multiselect.getSelected?.() ?? [];
        if (
          dragSelected.length === 0 &&
          cmdSelected.length === 0 &&
          multiSelected.length === 0
        ) {
          state.expandedNodesUid = [];
          return 0;
        }
        getSelection();
        return state.expandedNodesUid.length;
      },
      onClearFrozenNodes: () => {
        state.frozenNodes = false;
      },
      onAppendPrepend: (prefix, suffix) => doAppendPrepend(prefix, suffix),
      onFormatChange: (h, a, v, caseChange) =>
        doFormatChange(h, a, v, caseChange),
      // Page⇔Block conversion tab
      onPageToBlock: (findInput, replaceInput, moveContent) =>
        doGraphPageToBlock(findInput, replaceInput, moveContent),
      onBlockToPage: (findInput, replaceInput, moveContent) =>
        doGraphBlockToPage(findInput, replaceInput, moveContent),
      onPageBlockDisplayResults: (
        findInput,
        replaceInput,
        direction,
        moveContent,
      ) =>
        doPageBlockDisplayResults(
          findInput,
          replaceInput,
          direction,
          moveContent,
        ),
    };

    root.render(React.createElement(UnifiedSearchPanel, { callbacks }));

    console.log("Find & replace loaded.");
  },
  onunload: () => {
    window.removeEventListener("keydown", onKeydown);

    if (_panelRoot) {
      _panelRoot.unmount();
      _panelRoot = null;
    }
    if (_panelContainer && _panelContainer.parentNode) {
      _panelContainer.parentNode.removeChild(_panelContainer);
      _panelContainer = null;
    }

    window.roamAlphaAPI.ui.blockContextMenu.removeCommand({
      label: "Convert some [[page]] => this block",
    });
    window.roamAlphaAPI.ui.blockContextMenu.removeCommand({
      label: "Convert this block => [[Page]]",
    });
    window.roamAlphaAPI.ui.msContextMenu.removeCommand({
      label: "Find & Replace: Find & Replace in selection",
    });
    window.roamAlphaAPI.ui.msContextMenu.removeCommand({
      label: "Find & Replace: Prepend or append to selection",
    });
    window.roamAlphaAPI.ui.msContextMenu.removeCommand({
      label: "Find & Replace: Bulk change format of selection",
    });
    window.roamAlphaAPI.ui.pageContextMenu.removeCommand({
      label: "Find & Replace: Page ⇒ Block conversion",
    });
    window.roamAlphaAPI.ui.pageRefContextMenu.removeCommand({
      label: "Find & Replace: Page ⇒ Block conversion",
    });
    console.log("Find & replace unloaded.");
  },
};
