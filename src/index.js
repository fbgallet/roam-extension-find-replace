import iziToast from "izitoast";
import "../node_modules/izitoast/dist/css/iziToast.css";
import { normalizeMention } from "./utils";

import { insertChangedBlocks } from "./copyResults";
import state from "./state";
import { infoToast } from "./notifications";
import { findAndReplaceInWholeGraph, setWholeGraphDeps } from "./wholeGraph";
import { onKeydown, getSelection, getWorkspaceNodes } from "./nodeTraversal";
import {
  highlightAllMatches,
  expandPathBeforeHighlight,
  findAndHighlight,
  highlightString,
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
  changeBlockFormat,
  changeBlockFormatPrompt,
  setBlockOperationsDeps,
} from "./blockOperations";
import {
  extractContentFromPageOrSelectionByRegex,
  setExtractContentDeps,
} from "./extractContent";
import { searchOnly, setSearchDialogDeps } from "./searchDialog";
import {
  findAndReplace,
  replaceOpened,
  setFindReplaceDeps,
} from "./findReplaceDialog";
import {
  helpToast,
  initializeGlobalVar,
  displayMatchCountInTitle,
  getCurrentToastLabel,
  setHelpersDeps,
} from "./helpers";

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

let iziToastColor = "#262626F0";

// Search dialog extracted to searchDialog.js
// Find & Replace dialog extracted to findReplaceDialog.js

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
          state.iziToastPosition = evt;
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
  helpToast,
  replaceOpened,
  highlightString,
  highlightAllMatches,
  undoPopup,
  pageBlockConversionInstructions,
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
  findAndReplace,
  selectedNodesProcessing,
  replaceOpened,
  displayMatchCountInTitle,
  getCurrentToastLabel,
});

setFindReplaceDeps({
  initializeGlobalVar,
  displayMatchCountInTitle,
  getCurrentToastLabel,
  helpToast,
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
    if (extensionAPI.settings.get("positionSetting") == null)
      await extensionAPI.settings.set("positionSetting", "topRight");
    state.iziToastPosition = extensionAPI.settings.get("positionSetting");
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
    // if (extensionAPI.settings.get("wholeSetting") == null)
    //   extensionAPI.settings.set("wholeSetting", false);
    // allowWhole = extensionAPI.settings.get("wholeSetting");
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
        getSelection();
        if (state.expandedNodesUid.length == 0) {
          infoToast(
            "Some blocks have to be selected to apply bulk change format.",
          );
          return;
        }
        changeBlockFormatPrompt(formLabel);
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: " + swgLabel,
      callback: async () => {
        state.wholeGraph = true;
        await findAndReplaceInWholeGraph(swgLabel, "search");
      },
    });
    //    if (allowWhole) loadWholeGraphCommand();
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
        await findAndReplaceInWholeGraph(ptobLabel, "page to block", mention);
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
        await findAndReplaceInWholeGraph(btopLabel, "block to page", mention);
      },
    });
    extensionAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: Undo last operation",
      callback: async () => {
        await undoLastBulkOperation(
          state.changesNbBackup,
          state.inputBackup.length > 1 && state.inputBackup[1],
          state.inputBackup.length && state.inputBackup[0],
        );
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

    roamAlphaAPI.ui.blockContextMenu.addCommand({
      label: "Convert this block => [[Page]]",
      "display-conditional": (e) => e["block-string"].length > 0,
      callback: (e) => {
        state.wholeGraph = true;
        findAndReplaceInWholeGraph(
          btopLabel,
          "block to page",
          normalizeMention(e["block-uid"], "block"),
          normalizeMention(e["block-string"], "page"),
          false,
          false,
          true,
        );
      },
    });
    roamAlphaAPI.ui.blockContextMenu.addCommand({
      label: "Convert some [[page]] => this block",
      "display-conditional": (e) => e["block-string"].length == 0,
      callback: (e) => {
        state.wholeGraph = true;
        findAndReplaceInWholeGraph(
          btopLabel,
          "page to block",
          "",
          normalizeMention(e["block-uid"], "block"),
          false,
          false,
          true,
        );
      },
    });

    iziToast.settings({
      theme: "dark",
      class: "fr-toast",
      color: iziToastColor,
      position: state.iziToastPosition,
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

    roamAlphaAPI.ui.blockContextMenu.removeCommand({
      label: "Convert some [[page]] => this block",
    });
    roamAlphaAPI.ui.blockContextMenu.removeCommand({
      label: "Convert this block => [[Page]]",
    });
    console.log("Find & replace unloaded.");
  },
};
