import iziToast from "izitoast";
import "../node_modules/izitoast/dist/css/iziToast.css";
import getBlockUidsReferencingBlock from "roamjs-components/queries/getBlockUidsReferencingBlock";
import getAllBlockUidsAndTexts from "roamjs-components/queries/getAllBlockUidsAndTexts";
import {
  getBlocksUidReferencedInThisBlock,
  updateBlock,
  simulateClick,
  getBlockAttributes,
  getTreeByUid,
  getPageUidByPageName,
} from "./utils";

const frsLabel = "Find & Replace: in block or Selection of blocks (frs)";
const frpLabel = "Find & Replace: in Page zoom (frp)";
const frwLabel =
  "Find & Replace: in Workspace (Page + Sidebar + references) (frw)";
const frgLabel =
  "Find & Replace: in whole Graph (Warning: dangerous operation!)";
var lastOperation = "";
var changesNb = 0;
var includeRefs = true;
var includeEmbeds = true;
var includeLinkedRefs = true;
var isPrepending = false;
var wholeGraph = false;
var displayBefore = false;
var allowWhole = false;
var selectedNodesUid = new Array(Node);
var modifiedBlocksCopy = new Array();
var promptParameters = new Array();
var Node = function (uid, attr, embeded = false) {
  this.uid = uid;
  this.content = attr.string;
  this.open = attr.open;
  this.refs =
    attr.refs == undefined ? [] : getBlocksUidReferencedInThisBlock(this.uid);
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
    let onlyFirst = false;
    if (!this.embeded)
      this.refs.forEach((ref) => {
        if (isPrepending && !onlyFirst) {
          if (this.content === "((" + ref + "))") {
            selectedNodesUid.pop();
            selectedNodesUid.push(new Node(ref, getBlockAttributes(ref)));
          }
          onlyFirst = true;
        }
        if (!onlyFirst)
          selectedNodesUid.push(new Node(ref, getBlockAttributes(ref)));
      });
  };
  this.pushEmbedTree = (tree = getTreeByUid(this.refs[0])) => {
    if (this.embeded && this.refs.length != 0) {
      if (tree.string != undefined)
        selectedNodesUid.push(new Node(tree.uid, getBlockAttributes(tree.uid)));
      if (tree.children) {
        tree.children.forEach((subTree) => {
          this.pushEmbedTree(subTree);
        });
      }
    } else return null;
  };
};
Node.prototype.getAttributes = (uid) => {
  return getBlockAttributes(uid);
};

/******************************************************************************************
/*	Find and Replace (supporting regular expressions) (fre)
*****************************************************************************************/
const findAndReplace = async function (label) {
  changesNb = 0;
  console.log(selectedNodesUid);
  iziToast.question({
    color: "blue",
    layout: 2,
    drag: false,
    timeout: 100000,
    close: false,
    overlay: true,
    displayMode: 2,
    id: "question",
    title: label,
    message:
      "(Support regular expressions. In replace box, variable $RegEx stands for matching strings)<br>(Click (?) for examples.)",
    position: "center",
    inputs: [
      [
        '<label for="checkb">Case INsensitive ?  </label><input type="checkbox" id="checkb">',
        "change",
        function (instance, toast, input, e) {
          //console.info(input.checked);
        },
        false,
      ],
      [
        '<input type="text" placeholder="Find...">',
        "keyup",
        function (instance, toast, input, e) {
          //console.info(input.value);
        },
        true,
      ],
      [
        '<input type="text" placeholder="Replace by...blank=remove">',
        "keydown",
        function (instance, toast, input, e) {
          //console.info(input.value);
        },
        true,
      ],
    ],
    buttons: [
      [
        "<button><b>Confirm</b></button>",
        function (instance, toast, button, e, inputs) {
          let toFindStr = inputs[2].value;
          let replacingStr = inputs[3].value;
          if (toFindStr != null) {
            if (replacingStr != null) {
              lastOperation = "Find and Replace";
              var regParts = toFindStr.match(/^\/(.*?)\/([gimsuy]*)$/);
              if (regParts) {
                if (!regParts[2].includes("i") && inputs[1].checked) {
                  regParts[2] += "i";
                }
                var toFindregexp = new RegExp(regParts[1], regParts[2]);
              } else {
                let regPar2 = "g";
                if (inputs[1].checked) {
                  regPar2 += "i";
                }
                toFindStr = toFindStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                var toFindregexp = new RegExp(toFindStr, regPar2);
              }

              promptParameters = [toFindregexp, replacingStr];
              while (modifiedBlocksCopy.length > 0) {
                modifiedBlocksCopy.pop();
              }

              if (wholeGraph) wholeGraphProcessing(toFindregexp, replacingStr);
              else
                selectedNodesProcessing(
                  [toFindregexp, replacingStr],
                  replaceOpened
                );
            }
          }
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
      [
        "<button>(?)</button>",
        function (instance, toast, button, e) {
          iziToast.show({
            theme: "dark",
            closeOnClick: true,
            title: "Examples:",
            message:
              "In Find field:<br>" +
              "- /.*/ matches all block text,<br>" +
              "- /blocks?/i matches first occurence of 'block(s)',<br>" +
              "- /[A-Z]\\w+/g, matches all words beginning with a capital letter.<br>" +
              "<br>" +
              "In Replace field:<br>" +
              "- [$regex](((pUmK-1wqt))) make each machting string as an alias.<br>" +
              "- $RegEx leaves the machting string in its initial state.<br>" +
              "- $REGEX capitalizes all letters.<br>" +
              "- $regex set to lower case all letters.<br>" +
              "- $Regex capitalize first letter.<br>" +
              "- **$1** n°$2 bold first capture group and use the second as a number",
            position: "center",
            timeout: false,
            // iconText: 'star',
          });
          //              instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
        },
      ],
    ],
    onClosing: function (instance, toast, closedBy) {},
    onClosed: function (instance, toast, closedBy) {},
  });
};

const replaceOpened = async (
  uid,
  blockContent,
  isOpened,
  find,
  replace,
  countOnly = false
) => {
  let replacedBlock = "";
  let lastIndex = 0;
  let stringArray = [];

  if (find.test(blockContent)) {
    if (!countOnly) {
      find.lastIndex = 0;
      if (find.global) {
        var matchIterator = [...blockContent.matchAll(find)];
        if (
          replace.search(/\$regex/i) == -1 &&
          replace.search(/\$1/) == -1 &&
          replace.search(/\$2/) == -1
        ) {
          replacedBlock = blockContent.replace(find, replace);
        } else {
          for (const m of matchIterator) {
            if (m.index != 0) {
              stringArray.push(blockContent.substring(lastIndex, m.index));
            }
            stringArray.push(regexVarInsert(m, replace, blockContent));
            lastIndex = m.index + m[0].length;
          }
          if (lastIndex < blockContent.length - 1) {
            stringArray.push(blockContent.substring(lastIndex));
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
      }
    }
    if (!countOnly) {
      modifiedBlocksCopy.push([uid, blockContent, isOpened]);
      updateBlock(uid, replacedBlock, isOpened);
    }
    changesNb++;
  }
};

const regexVarInsert = function (match, replace, blockContent) {
  let indexOfRegex = replace.search(/\$regex/i);
  let isWholeBlock = blockContent.length == match[0].length;

  if (isWholeBlock && indexOfRegex == 0 && replace.length == 6) {
    return regexFormat(replace, blockContent);
  } else {
    let indexOfV1 = replace.search(/\$1/);
    let indexOfV2 = replace.search(/\$2/);
    let stringToInsert = replace;
    let replaceSplit = "";
    let regexWriting = "";

    if (indexOfRegex != -1) {
      regexWriting = replace.substring(indexOfRegex, indexOfRegex + 6);
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

const regexFormat = function (regexW, strMatch) {
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
    default:
      strIns = strMatch;
      break;
  }
  return strIns;
};

/******************************************************************************************
/*	Append and/or Prepend
/******************************************************************************************/

const appendPrepend = async (
  uid,
  blockContent,
  isOpened,
  stringBefore,
  stringAfter
) => {
  modifiedBlocksCopy.push([uid, blockContent, isOpened]);
  updateBlock(uid, stringBefore + blockContent + stringAfter, isOpened);
  changesNb++;
};

const appendPrependDialog = async function () {
  changesNb = 0;
  iziToast.question({
    color: "blue",
    layout: 2,
    drag: false,
    timeout: false,
    close: false,
    overlay: true,
    displayMode: 1,
    id: "question",
    title: "Text to prepend or/and to append to each selected blocks:",
    message: "(Do not forget space if needed.)",
    position: "center",
    inputs: [
      [
        '<input type="text" placeholder="to prepend">',
        "keyup",
        function (instance, toast, input, e) {},
        true,
      ],
      [
        '<input type="text" placeholder="to append">',
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
          promptParameters = [prefixe, suffixe];
          while (modifiedBlocksCopy.length > 0) {
            modifiedBlocksCopy.pop();
          }
          selectedNodesProcessing([prefixe, suffixe], appendPrepend);

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
    onClosed: function (instance, toast, closedBy) {},
  });
};

/******************************************************************************************      
/*	Undo last bulk operation
/******************************************************************************************/

const undoLastBulkOperation = async function () {
  for (var index = 0; index < modifiedBlocksCopy.length; index++) {
    let uid = modifiedBlocksCopy[index][0];
    let blockContent = modifiedBlocksCopy[index][1];
    let blockState = modifiedBlocksCopy[index][2];
    updateBlock(uid, blockContent, blockState);

    let block = getBlockAttributes(uid);
    modifiedBlocksCopy[index] = [block.uid, block.string, block.open];
  }
  await undoPopup();
};

const undoPopup = async function () {
  iziToast.warning({
    timeout: 8000,
    displayMode: "replace",
    id: "undo",
    zindex: 999,
    title:
      changesNb +
      " matches replaced! " +
      "Click to undo this '" +
      lastOperation +
      "' operation. Do not use Ctrl + z.",
    position: "bottomRight",
    drag: false,
    close: true,
    buttons: [
      [
        "<button>UNDO</button>",
        (instance, toast) => {
          lastOperation = "Undo";
          undoLastBulkOperation();
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
        false,
      ],
      [
        "<button>Display changed blocks in sidebar</button>",
        (instance, toast) => {
          displayChangedBlocks();
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
        false,
      ],
    ],
  });
};

/******************************************************************************************      
/*	Redo last bulk operation
/******************************************************************************************/
const redoPopup = async function () {
  iziToast.warning({
    timeout: 20000,
    displayMode: "replace",
    id: "undo",
    zindex: 999,
    title:
      "Are you sure you want to do another time last bulk '" +
      lastOperation +
      "' operation?",
    position: "center",
    overlay: true,
    color: "blue",
    drag: false,
    close: true,
    buttons: [
      [
        "<button>Yes</button>",
        (instance, toast) => {
          switch (lastOperation) {
            case "":
              Alert("No bulk operation has been run.");
              return;
            case "Undo":
              undoLastBulkOperation();
              break;
            case "Append and/or Prepend":
              while (modifiedBlocksCopy.length > 0) {
                modifiedBlocksCopy.pop();
              }
              selectedNodesProcessing(promptParameters, appendPrepend);
              break;
            case "Find and Replace":
              while (modifiedBlocksCopy.length > 0) {
                modifiedBlocksCopy.pop();
              }
              selectedNodesProcessing(promptParameters, replaceOpened);
              break;
            default:
              break;
          }
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
/*	Processing a generic function defined above through all expanded blocks
/******************************************************************************************/
function getSelectedBlocksUid() {
  selectedNodesUid.length = 0;
  let selectedBlocks = document.querySelectorAll(".block-highlight-blue");
  selectedBlocks.forEach((block) => {
    let inputBlock = block.querySelector(".rm-block__input");
    let uid = inputBlock.id.slice(-9);
    let embeded = false;
    let node = new Node(uid, getBlockAttributes(uid));
    if (includeEmbeds)
      embeded =
        inputBlock.querySelector(":nth-child(1) > .rm-embed-container") != null;
    if (embeded) {
      node.embeded = embeded;
      node.pushEmbedTree();
    } else {
      selectedNodesUid.push(node);
      if (includeRefs) node.pushRefs();
    }
  });
}

const selectedNodesProcessing = async function (parameters, bulkFunction) {
  selectedNodesUid.forEach(async (node) => {
    await nodeProcessing(node, parameters, bulkFunction);
  });
  console.log(changesNb);
  await undoPopup();
};

const nodeProcessing = async (node, parameters, bulkFunction) => {
  let args = [node.uid, node.content, node.open];
  for (var i = 0; i < parameters.length; i++) {
    args.push(parameters[i]);
  }
  await bulkFunction.apply(this, args);
};

const wholeGraphProcessing = (find, replace) => {
  const all = getAllBlockUidsAndTexts();
  all.forEach((node) => {
    replaceOpened(node.uid, node.text, undefined, find, replace, true);
  });
  iziToast.warning({
    timeout: 20000,
    displayMode: "replace",
    id: "warning",
    zindex: 999,
    title:
      changesNb +
      " matches have been found ! " +
      "Replace a given string in the whole graph is a very dangerous operation and can have unintended consequences. " +
      "Do you confirm that you want to replace '" +
      find +
      "' by '" +
      replace +
      "' ?",
    position: "center",
    overlay: true,
    color: "red",
    drag: false,
    close: true,
    buttons: [
      [
        "<button>Yes I know what I do</button>",
        (instance, toast) => {
          changesNb = 0;
          all.forEach((node) => {
            replaceOpened(node.uid, node.text, undefined, find, replace);
          });
          undoPopup();
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
        false,
      ],
      [
        "<button>No</button>",
        (instance, toast) => {
          instance.hide({ transitionOut: "fadeOut" }, toast, "button");
        },
        true,
      ],
    ],
  });
  wholeGraph = false;
};

function getNodesFromTree(tree, first = false) {
  if (first) selectedNodesUid.length = 0;
  if (tree.string != undefined) {
    let attr = { string: tree.string, open: tree.open, refs: tree.refs };
    let node = new Node(tree.uid, attr);
    if (node.isEmbeded() && includeEmbeds) node.pushEmbedTree();
    else {
      selectedNodesUid.push(node);
      if (includeRefs) node.pushRefs();
    }
  }
  if (tree.children) {
    tree.children.forEach((subTree) => {
      getNodesFromTree(subTree);
    });
  }
}

function getNodesFromLinkedReferences(mentions) {
  mentions.forEach((mentionUid) => {
    let node = new Node(mentionUid, getBlockAttributes(mentionUid));
    selectedNodesUid.push(node);
    if (includeRefs) node.pushRefs();
  });
}

function getNodesFromPageZoomAndReferences(zoomUid) {
  getNodesFromTree(getTreeByUid(zoomUid), true);
  if (includeLinkedRefs) {
    let mentions = getBlockUidsReferencingBlock(zoomUid);
    getNodesFromLinkedReferences(mentions);
  }
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
        if (page.type != "mentions") getNodesFromTree(getTreeByUid(uid), false);
        else {
          let mentions = getBlockUidsReferencingBlock(uid);
          getNodesFromLinkedReferences(mentions);
        }
      }
    }
  });
}

function insertChangedBlocks(startUid) {
  if (modifiedBlocksCopy.length == 0) return null;
  let now = new Date();
  let hh = now.getHours();
  let mm = now.getMinutes();
  let day = window.roamAlphaAPI.util.dateToPageTitle(now);
  let parentUid = window.roamAlphaAPI.util.generateUID();
  let shift = 0;
  window.roamAlphaAPI.createBlock({
    location: { "parent-uid": startUid, order: 0 },
    block: {
      uid: parentUid,
      string:
        "List of blocks changed by last Find & Replace operation on [[" +
        day +
        "]], " +
        hh +
        ":" +
        mm,
    },
  });
  if (displayBefore) {
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
  modifiedBlocksCopy.forEach((block, i) => {
    let blockUid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createBlock({
      location: { "parent-uid": parentUid, order: i + shift },
      block: { uid: blockUid, string: "((" + block[0] + "))" },
    });
    if (displayBefore)
      window.roamAlphaAPI.createBlock({
        location: { "parent-uid": blockUid, order: 0 },
        block: { string: block[1] },
      });
  });
  return parentUid;
}

function displayChangedBlocks() {
  let pageUid, parentUid;
  pageUid = getPageUidByPageName("roam/depot/find & replace");
  if (pageUid === undefined) {
    pageUid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createPage({
      page: { title: "roam/depot/find & replace", uid: pageUid },
    });
  }
  parentUid = insertChangedBlocks(pageUid);
  window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: { type: "block", "block-uid": parentUid },
  });
}

/******************************************************************************************      
/*	Load / Unload
/******************************************************************************************/

const panelConfig = {
  tabTitle: "Find and replace",
  settings: [
    {
      id: "refsSetting",
      name: "Include inline block references",
      description: "Include block references in Find & Replace operation:",
      action: {
        type: "switch",
        onChange: (evt) => {
          includeRefs = !includeRefs;
        },
      },
    },
    {
      id: "embedSetting",
      name: "Include embeded blocks",
      description:
        "Include embeded blocks (and all their children) in Find & Replace operation:",
      action: {
        type: "switch",
        onChange: (evt) => {
          includeEmbeds = !includeEmbeds;
        },
      },
    },
    {
      id: "linkedSetting",
      name: "Include linked references",
      description:
        "Include linked references in Find & Replace on current Page:",
      action: {
        type: "switch",
        onChange: (evt) => {
          includeLinkedRefs = !includeLinkedRefs;
        },
      },
    },
    {
      id: "beforeSetting",
      name: "Display previous state",
      description:
        "Display changed blocks in a table where the new state is compared to the old state:",
      action: {
        type: "switch",
        onChange: (evt) => {
          displayBefore = !displayBefore;
        },
      },
    },
    {
      id: "wholeSetting",
      name: "Allow 'Whole Graph' Find & Replace",
      description:
        "Display 'Whole Graph' Find & Replace command in command palette (Danger Zone)",
      action: {
        type: "switch",
        onChange: (evt) => {
          allowWhole = !allowWhole;
          loadWholeGraphCommand(allowWhole);
        },
      },
    },
  ],
};

function loadWholeGraphCommand(load = true) {
  if (!load) {
    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: frgLabel,
    });
    wholeGraph = false;
    return;
  }
  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: frgLabel,
    callback: async () => {
      wholeGraph = true;
      await findAndReplace(frgLabel);
    },
  });
}

export default {
  onload: ({ extensionAPI }) => {
    extensionAPI.settings.panel.create(panelConfig);
    if (extensionAPI.settings.get("refsSetting") == null)
      extensionAPI.settings.set("refsSetting", false);
    includeRefs = extensionAPI.settings.get("refsSetting");
    if (extensionAPI.settings.get("embedSetting") == null)
      extensionAPI.settings.set("embedSetting", false);
    includeEmbeds = extensionAPI.settings.get("embedSetting");
    if (extensionAPI.settings.get("linkedSetting") == null)
      extensionAPI.settings.set("linkedSetting", false);
    includeLinkedRefs = extensionAPI.settings.get("linkedSetting");
    if (extensionAPI.settings.get("beforeSetting") == null)
      extensionAPI.settings.set("beforeSetting", false);
    displayBefore = extensionAPI.settings.get("beforeSetting");
    if (extensionAPI.settings.get("wholeSetting") == null)
      extensionAPI.settings.set("wholeSetting", false);
    allowWhole = extensionAPI.settings.get("wholeSetting");

    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: frsLabel,
      callback: async () => {
        let startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
        if (startUid != undefined) selectedNodesUid = [startUid];
        getSelectedBlocksUid();
        if (selectedNodesUid.length == 0) return;
        setTimeout(() => {
          simulateClick(document.body);
        }, 50);
        findAndReplace(frsLabel);
      },
    });
    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: frpLabel,
      callback: async () => {
        let zoomUid =
          await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
        getNodesFromPageZoomAndReferences(zoomUid);
        if (selectedNodesUid.length == 0) return;
        findAndReplace(frpLabel);
      },
    });
    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: frwLabel,
      callback: async () => {
        includeEmbeds = true;
        includeRefs = true;
        includeLinkedRefs = true;
        let zoomUid =
          await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
        getNodesFromPageZoomAndReferences(zoomUid);
        getNodesFromSidebarWindows();
        if (selectedNodesUid.length != 0) findAndReplace(frwLabel);
        includeRefs = extensionAPI.settings.get("refsSetting");
        includeEmbeds = extensionAPI.settings.get("embedSetting");
        includeLinkedRefs = extensionAPI.settings.get("linkedSetting");
      },
    });
    if (allowWhole) loadWholeGraphCommand();
    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: Undo last operation",
      callback: async () => {
        await undoLastBulkOperation();
      },
    });
    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: Redo last operation",
      callback: async () => {
        await redoPopup();
      },
    });
    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Prepend or append content to selected blocks",
      callback: async () => {
        isPrepending = true;
        getSelectedBlocksUid();
        if (selectedNodesUid.length == 0) return;
        setTimeout(() => {
          simulateClick(document.body);
        }, 50);
        appendPrependDialog();
        isPrepending = false;
      },
    });

    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Find & Replace: Insert last changed blocks (references)",
      callback: async () => {
        let startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
        insertChangedBlocks(startUid);
      },
    });

    console.log("Find & replace loaded.");
  },
  onunload: () => {
    window.roamAlphaAPI.ui.commandPalette.removeCommand({ label: frsLabel });
    window.roamAlphaAPI.ui.commandPalette.removeCommand({ label: frpLabel });
    window.roamAlphaAPI.ui.commandPalette.removeCommand({ label: frwLabel });
    window.roamAlphaAPI.ui.commandPalette.removeCommand({ label: frgLabel });
    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: "Find & Replace: Undo last operation",
    });
    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: "Find & Replace: Redo last operation",
    });
    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: "Find & Replace: Insert last changed blocks (references)",
    });
    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: "Prepend or append content to selected blocks",
    });
    console.log("Find & replace unloaded.");
  },
};
