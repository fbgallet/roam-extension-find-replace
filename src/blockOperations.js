import iziToast from "izitoast";
import { updateBlock, getBlockAttributes, normalizeInputRegex } from "./utils";
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
  updateBlock(uid, stringBefore + blockContent + stringAfter, isOpened);
  state.changesNb++;
};

export const appendPrependDialog = async function () {
  state.changesNb = 0;
  state.formatChange = false;
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
        async function (instance, toast, button, e, inputs) {
          let prefixe = inputs[0].value;
          let suffixe = inputs[1].value;
          state.lastOperation = "Append and/or Prepend";
          while (state.modifiedBlocksCopy.length > 0) {
            state.modifiedBlocksCopy.pop();
          }
          await _selectedNodesProcessing(
            state.expandedNodesUid,
            [prefixe, suffixe],
            appendPrepend,
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
        state.selectedBlocks = [];
        state.seletionBlue = false;
        _initializeGlobalVar(true);
      }
    },
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
  let caseOptions =
    '<option value="noChange">Case</option>' +
    '<option value="toUpper">UPPER case</option>' +
    '<option value="toLower">lower case</option>' +
    '<option value="capitalizeB" title="Capitalize first letter of the block">Cap. block</option>' +
    '<option value="capitalizeW" title="Capitalize Each Word">Cap. Words</option>' +
    '<option value="capitalizeS" title="Capitalize each sentence.">Cap. sentences</option>';
  iziToast.show({
    maxWidth: 520,
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
        async function (instance, toast, button, e, inputs) {
          _initializeGlobalVar();
          let h = inputs[0].options[inputs[0].selectedIndex].value;
          let a = inputs[1].options[inputs[1].selectedIndex].value;
          let v = inputs[2].options[inputs[2].selectedIndex].value;
          let caseChange = inputs[3].options[inputs[3].selectedIndex].value;

          if (h != "noChange" || a != "noChange" || v != "noChange") {
            state.lastOperation = "Change format";
            state.formatChange = true;
            let promptParameters = [h, a, v];
            while (state.modifiedBlocksCopy.length > 0) {
              state.modifiedBlocksCopy.pop();
            }
            await _selectedNodesProcessing(
              state.expandedNodesUid,
              promptParameters,
              changeBlockFormat,
            );
          }
          if (caseChange != "noChange") {
            state.lastOperation = "Change case";
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
        state.selectedBlocks = [];
        state.seletionBlue = false;
        _initializeGlobalVar(true);
        state.changesNbBackup = state.changesNb;
      }
    },
  });
};

export const caseBulkChange = async (change) => {
  let replace;
  let input = _referencesRegexStr; // not simply /.*/, because we have to exclude blocks and page references!
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

  while (state.modifiedBlocksCopy.length > 0) {
    state.modifiedBlocksCopy.pop();
  }
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
