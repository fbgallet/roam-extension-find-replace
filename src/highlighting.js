import {
  updateBlock,
  getBlockAttributes,
  getBlockContentByUid,
  getParentTreeUids,
  normalizeInputRegex,
  resolveReferences,
  getArrayExcludingAnotherArray,
  getPlainTextOfChildren,
  getChildrenUid,
} from "./utils";
import state from "./state";
import Node from "./nodeModel";
import { getNodes, openParentNodes } from "./nodeTraversal";

// Dependencies injected from index.js to avoid circular imports
let _selectedNodesProcessing, _displayMatchCountInTitle, _referencesRegex;

export function setHighlightingDeps({
  selectedNodesProcessing,
  displayMatchCountInTitle,
  referencesRegex,
}) {
  _selectedNodesProcessing = selectedNodesProcessing;
  _displayMatchCountInTitle = displayMatchCountInTitle;
  _referencesRegex = referencesRegex;
}

export const highlightNextMatch = function (shift) {
  if (!state.eltFound) {
    window.removeEventListener("keydown", onKeyArrows);
    console.log(
      "keyArrow eventListener removed for Find & Replace extension removed",
    );
  }
  let lastElt = state.eltFound[state.scrollIndex];
  setNotCurrentHighlight(lastElt);
  let index = state.scrollIndex + shift;
  if (shift > 0 && index >= state.eltFound.length) index = 0;
  if (shift < 0 && index < 0) index = state.eltFound.length - 1;
  let loopExit = 0;
  while (state.matchArray[index].replaced && loopExit < state.eltFound.length) {
    if (shift > 0) {
      shift++;
      if (index + 1 < state.eltFound.length) index++;
      else index = 0;
    }
    if (shift < 0) {
      shift--;
      if (index > 0) index--;
      else index = state.eltFound.length - 1;
    }
    loopExit++;
  }
  state.scrollIndex = index;
  if (shift > 0 && state.scrollIndex >= state.eltFound.length)
    state.scrollIndex = -(state.eltFound.length - state.scrollIndex);
  if (shift < 0 && state.scrollIndex < 0)
    state.scrollIndex = state.eltFound.length + state.scrollIndex;
  let nextElt = state.eltFound[state.scrollIndex];
  if (nextElt != null) {
    setCurrentHighlight(nextElt);
    nextElt.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }
};

/******************************************************************************************
/*	Functions for highlighting matches
/******************************************************************************************/
export const actualizeHighlights = (
  findInput,
  caseInsensitive,
  wordOnly,
  expandToHighlight = false,
  searchLogic = "",
) => {
  // Small DOM-yield before processing (allows browser repaint)
  setTimeout(async () => {
    if (findInput.length > 0) {
      let promptParameters = normalizeInputRegex(
        findInput,
        "",
        caseInsensitive,
        wordOnly,
        searchLogic,
        expandToHighlight,
      );
      if (expandToHighlight && state.matchingHidden > 0) {
        state.notExpandedNodesUid = [];
        await _selectedNodesProcessing(
          state.collapsedNodesUid,
          promptParameters,
          expandPathBeforeHighlight,
          false,
        );
        let previousCount = -1;
        while (state.notExpandedNodesUid.length > 0 &&
               state.notExpandedNodesUid.length !== previousCount) {
          previousCount = state.notExpandedNodesUid.length;
          state.collapsedNodesUid = state.notExpandedNodesUid;
          state.notExpandedNodesUid = [];
          await _selectedNodesProcessing(
            state.collapsedNodesUid,
            promptParameters,
            expandPathBeforeHighlight,
            false,
          );
        }
        state.notExpandedNodesUid = [];
        // Re-run highlighting after a delay: getNodes() may read a stale Roam cache
        // that still shows expanded blocks as collapsed. By then the cache is fresh.
      }
      await getNodes();
      highlightCurrentSearch(promptParameters, expandToHighlight);
      state.changesNbBackup += state.changesNb;
    }
  }, 10);
};

export const highlightCurrentSearch = async (input, expand) => {
  state.scrollIndex = 0;
  state.matchIndex = 0;
  state.matchingTotal = 0;
  state.matchingHidden = 0;
  state.formatChange = false;
  state.matchArray = [];
  if (input != null) {
    removeHighlightedNodes();
    setTimeout(async () => {
      input.push(expand);
      await _selectedNodesProcessing(
        state.expandedNodesUid,
        input,
        findAndHighlight,
        false,
      );
      input.push(true);
      await _selectedNodesProcessing(
        state.collapsedNodesUid,
        input,
        findAndHighlight,
        false,
      );
      highlightAllMatches();
      _displayMatchCountInTitle();
    }, 100);
  }
};

export const highlightAllMatches = function (inDialog = false) {
  let ordererMatches = [];
  state.eltFound = document.querySelectorAll("fr-match");
  state.eltFound.forEach((item, index) => {
    item.style.color = "#000000";
    if (index === 0 && !inDialog) {
      item.style.backgroundColor = state.highlightColor;
    } else item.style.backgroundColor = state.highlightColor + "65";
    let id = parseInt(item.id);
    ordererMatches.push(state.matchArray[id]);
  });
  if (!inDialog) state.matchArray = ordererMatches;
  if (state.eltFound.length != 0 && !inDialog)
    state.eltFound[0].scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
};

const setCurrentHighlight = function (elt) {
  elt.style.backgroundColor = state.highlightColor;
};

const setNotCurrentHighlight = function (elt) {
  elt.style.backgroundColor = state.highlightColor + "65";
};

export const onKeyArrows = function (e) {
  if (e.key == "ArrowUp") {
    document.activeElement.blur();
    highlightNextMatch(-1);
    _displayMatchCountInTitle();
    e.preventDefault();
  }
  if (e.key == "ArrowDown") {
    document.activeElement.blur();
    highlightNextMatch(1);
    _displayMatchCountInTitle();
    e.preventDefault();
  }
};

export const expandPathBeforeHighlight = async (node, find, replace, searchLogic) => {
  let blockContent = node.content;
  let uid = node.uid;
  let collapsedParents = node.collapsedParents;
  state.refsUids = [];
  let hasMatches = false;
  let hasANDmatchesInChildren = false;
  let resolvedBlockContent = resolveReferences(blockContent, [uid]);

  if (searchLogic != "AND") {
    find.lastIndex = 0;
    hasMatches = find.test(resolvedBlockContent);
  } else {
    hasMatches = find.and.test(resolvedBlockContent);
    if (state.ANDwithChildren)
      hasMatches =
        hasMatches ||
        (await ANDmatchInChildren(
          node,
          blockContent,
          resolvedBlockContent,
          find,
          replace,
          true,
        ));
  }
  if (hasMatches) {
    if (collapsedParents.length != 0) {
      await openParentNodes(collapsedParents);
    }
    let selector = "[id$='" + uid + "']";
    let elt = document.querySelector(selector);
    if (elt === null) {
      let parents = getParentTreeUids(uid);
      await expandWholeParentPath(parents, uid);
      elt = document.querySelector(selector);
      if (elt === null) state.notExpandedNodesUid.push(node);
    }
  }
};

const waitForElement = (selector, timeout = 2000) => {
  return new Promise((resolve) => {
    const elt = document.querySelector(selector);
    if (elt) return resolve(elt);
    const observer = new MutationObserver(() => {
      const elt = document.querySelector(selector);
      if (elt) {
        observer.disconnect();
        resolve(elt);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
};

const expandWholeParentPath = async (parents, targetUid) => {
  for (let i = 0; i < parents.length; i++) {
    const uid = parents[i];
    await window.roamAlphaAPI.updateBlock({
      block: { uid, open: true },
    });
    // Wait for the next level to appear in the DOM (child of what we just opened)
    const nextUid = i + 1 < parents.length ? parents[i + 1] : targetUid;
    await waitForElement("[id$='" + nextUid + "']");
  }
};

const findInReferences = (find, refs, blockContent, count = 0) => {
  for (let i = 0; i < refs.length; i++) {
    if (!state.refsUids.includes(refs[i])) {
      let firstReference = false;
      if (!state.uniqueReferences.includes(refs[i])) {
        state.uniqueReferences.push(refs[i]);
        firstReference = true;
      }
      let refAttr = getBlockAttributes(refs[i]);
      let refNode = new Node(refs[i], refAttr);
      let refContent = refAttr.string;
      state.refsUids.push(refs[i]);
      if (refContent != undefined) {
        let originalIsPresent =
          state.expandedNodesUid.filter((node) => node.uid === refs[i]).length >
          0;
        if (firstReference && originalIsPresent) state.uniqueReferences.pop();
        if (
          !blockContent.includes("{[[embed]]:") &&
          !blockContent.includes("](((" + refs[i] + ")))")
        ) {
          let regex = new RegExp(find.source, find.flags);
          if (
            regex.test(refContent) &&
            ((!originalIsPresent && firstReference) || !state.excludeDuplicate)
          ) {
            state.matchRefsArray.push(refs[i]);
            count += refContent.match(regex).length;
          }
          let nonRedundantRefsArray = getArrayExcludingAnotherArray(
            refNode.refs,
            state.refsUids,
          );
          if (nonRedundantRefsArray.length != 0)
            count += findInReferences(find, nonRedundantRefsArray, refContent);
        }
      }
    }
  }
  return count;
};

const ANDmatchInChildren = async (
  node,
  blockContent,
  resolvedBlockContent,
  find,
  replace,
  expandToHighlight,
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
      matchInBlockContent = find.and.test(resolvedBlockAndChildContent);
      if (matchInBlockContent) {
        if (expandToHighlight) await updateBlock(uid, blockContent, true);
        let childMatches;
        childMatches = resolvedChildContent.match(find.or).length;
        if (node.open != true) state.matchingHidden += childMatches;
        else {
          childNodesToProcess = childNodesToProcess.map(
            (uid) => new Node(uid, getBlockAttributes(uid)),
          );
          await _selectedNodesProcessing(
            childNodesToProcess,
            [find.or, replace, "OR", true],
            findAndHighlight,
          );
        }
      }
    }
  }
  return matchInBlockContent;
};

export const findAndHighlight = async (
  node,
  find,
  replace,
  searchLogic,
  expandToHighlight = false,
  collapsed = false,
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
    if (state.ANDwithChildren && !matchInBlockContent) {
      matchInBlockContent = await ANDmatchInChildren(
        node,
        blockContent,
        resolvedBlockContent,
        find,
        replace,
        expandToHighlight,
      );
    }
    if (matchInBlockContent) find = find.or;
  }
  let matchesInRefs = 0;
  state.matchRefsArray = [];
  if (node.refs.length != 0)
    matchesInRefs = findInReferences(find, node.refs, blockContent);
  let selector = "[id$='" + uid + "']";
  let elt = document.querySelector(selector);
  if (
    expandToHighlight &&
    elt === null &&
    (matchInBlockContent || matchesInRefs > 0)
  ) {
    await expandPathBeforeHighlight(node, find, replace, searchLogic);
    elt = document.querySelector(selector);
    if (elt !== null) collapsed = false;
  }
  if (matchInBlockContent || matchesInRefs > 0) {
    let nbMatchesInBlock = 0;
    let matches = blockContent.match(find);
    if (matches != null) {
      nbMatchesInBlock = matches.length;
    }
    nbMatchesInBlock += matchesInRefs;
    if (!collapsed) state.matchingTotal += nbMatchesInBlock;
    else state.matchingHidden += nbMatchesInBlock;
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

export const highlightString = (
  node,
  find,
  replace = null,
  uid = null,
  bref = null,
) => {
  if (node == null) return;
  if (node.nodeType == 3) {
    // nodeType 3 is Text
    let foundChild = processTextNode(node.nodeValue, find, replace, uid, bref);
    node.parentNode.replaceChild(foundChild, node);
  } else {
    let className = node.className;
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
          if (
            state.excludeDuplicate &&
            !state.matchRefsArray.includes(blockRef)
          ) {
            if (state.uniqueReferences.includes(blockRef)) {
              let index = state.uniqueReferences.indexOf(blockRef);
              state.uniqueReferences.splice(index, 1);
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
      default:
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
  find.lastIndex = 0;
  let matchIterator = [...text.matchAll(find)];
  let nbInBlock = 0;
  if (uid != null && state.matchIndex > 0) {
    if (state.matchArray[state.matchIndex - 1].uid === uid)
      nbInBlock = state.matchArray[state.matchIndex - 1].indexInBlock + 1;
  }

  matchIterator.forEach((i, indexInNode) => {
    if (i.index != 0) {
      let split = i.input.slice(shiftedIndex, i.index);
      t = document.createTextNode(split);
      node.appendChild(t);
    }
    let e = document.createElement("fr-match");
    e.setAttribute("id", state.matchIndex++);
    if (uid != null)
      if (state.extractMatchesOnly) {
        let groups = [];
        let replaceStr = replace;
        for (let j = 1; j < i.length; j++) {
          groups.push(i[j]);
          replaceStr = replaceStr.replace("$" + j, i[j]);
        }
        state.matchingStringsArray.push({
          uid: uid,
          content: i[0],
          groups: groups,
          replace: replaceStr,
        });
      }
    if (replace != null)
      state.matchArray.push({
        uid: uid,
        strToReplace: i[0],
        indexInBlock: indexInNode + nbInBlock,
        replaced: false,
        blockRef: bref,
        matchIndex: state.matchIndex - 1,
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

export function removeHighlightedNodes(e = document) {
  let highlightedElt = e.querySelectorAll("fr-node");
  for (let i = 0; i < highlightedElt.length; i++) {
    let originalTxt = highlightedElt[i].innerText;
    let eTxt = document.createTextNode(originalTxt);
    highlightedElt[i].replaceWith(eTxt);
  }
}
