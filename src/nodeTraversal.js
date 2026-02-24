import getBlockUidsReferencingBlock from "roamjs-components/queries/getBlockUidsReferencingBlock";
import {
  getBlockAttributes,
  getTreeByUid,
  getBlockContentByUid,
  removeDuplicateBlocks,
  simulateClick,
} from "./utils";
import state from "./state";
import Node, { setGetNodesFromTree } from "./nodeModel";

export const onKeydown = async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key == "s") {
    // let selection = getSelection();
    // await getNodes();
    // if (selection === null) selection = "";
    // searchOnly(selection);
    e.preventDefault();
    return;
  }
};

export function getSelectedNodes(selection, inCollapsed = false) {
  // let uniqueUids = [];
  selection.forEach((block) => {
    let inputBlock = block.querySelector(".rm-block__input");
    if (!inputBlock) return;
    let uid = inputBlock.id.slice(-9);
    // if (!uniqueUids.includes(uid)) {
    // uniqueUids.push(uid);
    getNodesFromTree(
      getTreeByUid(uid),
      false,
      state.expandedNodesUid,
      inCollapsed,
    );
    // }
  });

  state.expandedNodesUid = removeDuplicateBlocks(state.expandedNodesUid);
}

export function getCheckedNodes(checkedBlocks) {
  checkedBlocks.forEach((uid) => {
    let node = new Node(uid, getBlockAttributes(uid));
    if (node.content != undefined) {
      state.expandedNodesUid.push(node);
      node.pushRefs();
    }
  });
}

export function getSelection() {
  initializeNodesArrays();
  state.seletionBlue = false;
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
      state.selectedBlocks = selection;
      getSelectedNodes(state.selectedBlocks);
      selection = null;
      state.seletionBlue = true;
    }
    if (!startUid && checkSelection.length) {
      state.selectedBlocks = checkSelection;
      getCheckedNodes(checkSelection);
      selection = null;
      state.seletionBlue = false;
    }
  }
  // console.log(state.expandedNodesUid);
  return selection;
}

export async function getNodes() {
  if (!state.seletionBlue) {
    getSelection();
    if (state.selectedBlocks.length != 0 && !state.workspace) {
      if (state.selectedBlocks[0].length == 9)
        getCheckedNodes(state.selectedBlocks); // checked blocks with ctrl + m
      else getSelectedNodes(state.selectedBlocks); // classic multiselect
    } else {
      if (state.workspace) await getWorkspaceNodes();
      else await getNodesInPage();
    }
  }
  if (state.excludeDuplicate) {
    state.expandedNodesUid = removeDuplicateBlocks(state.expandedNodesUid);
    state.collapsedNodesUid = removeDuplicateBlocks(state.collapsedNodesUid);
  }
  // console.log("Expanded:");
  // console.log(state.expandedNodesUid);
  // console.log("Collapsed:");
  // console.log(state.collapsedNodesUid);
}

export function initializeNodesArrays() {
  state.expandedNodesUid = [];
  state.collapsedNodesUid = [];
  state.referencedNodesUid = [];
  state.uniqueReferences = [];
  state.refsUids = [];
  state.selectedBlocks = [];
}

export async function getNodesInPage() {
  let zoomUid = await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
  if (!zoomUid) getNodesFromDailyNotes();
  else getNodesFromPageZoomAndReferences(zoomUid);
}

export function getNodesFromDailyNotes() {
  let dailyNotes = document.querySelectorAll(
    "div.roam-log-page:not(.roam-log-preview)",
  );
  dailyNotes.forEach((dnp) => {
    let blocks = dnp.querySelectorAll(".rm-block-main");
    getSelectedNodes(blocks, true);
  });
}

export function getNodesFromPageZoomAndReferences(zoomUid) {
  getNodesFromTree(getTreeByUid(zoomUid), true, state.expandedNodesUid);

  if (state.workspace) {
    let mentions = getBlockUidsReferencingBlock(zoomUid);
    getNodesFromLinkedReferences(mentions);
  }
}

export async function getWorkspaceNodes() {
  await getNodesInPage();
  getNodesFromSidebarWindows();
}

export function getNodesFromLinkedReferences(mentions) {
  mentions.forEach((mentionUid) => {
    let node = new Node(mentionUid, getBlockAttributes(mentionUid));
    if (node.content != undefined) {
      state.expandedNodesUid.push(node);
      node.pushRefs();

      // Doesn't work currently <= limitation in the API, :block/open doesn't affect
      // blocks in the Linked references section
      // getNodesFromTree(getTreeByUid(mentionUid), false, state.expandedNodesUid);
    }
  });
}

export function getNodesFromSidebarWindows() {
  let sidebarUids = window.roamAlphaAPI.ui.rightSidebar.getWindows();
  sidebarUids.forEach((page) => {
    let uid = "";
    if (!page["collapsed?"]) {
      if (page.type == "block") uid = page["block-uid"];
      if (page.type == "outline" || page.type == "mentions")
        uid = page["page-uid"];
      if (uid != "") {
        if (page.type != "mentions")
          getNodesFromTree(getTreeByUid(uid), false, state.expandedNodesUid);
        else {
          let mentions = getBlockUidsReferencingBlock(uid);
          getNodesFromLinkedReferences(mentions);
        }
      }
    }
  });
}

export const openParentNodes = async (collapsed, forced = false) => {
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

export function getNodesFromTree(
  tree,
  first,
  nodeArray,
  inCollapsedtree = false,
  collapsedParents = [],
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
    if (node.isEmbeded() && state.includeEmbeds) node.pushEmbedTree();
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
          state.collapsedNodesUid,
          true,
          newCollapsedParentsArray,
        );
      else
        getNodesFromTree(
          children[j],
          false,
          state.expandedNodesUid,
          false,
          newCollapsedParentsArray,
        );
    }
  }
}

// Wire up the lazy reference in nodeModel
setGetNodesFromTree(getNodesFromTree);
