import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import {
  displayBefore,
  extractMatchesOnly,
  lastOperation,
  matchArray,
  matchesSortedBy,
  matchingStringsArray,
  modifiedBlocksCopy,
  showPath,
} from ".";
import {
  getNowDateAndTime,
  getPageTitleByBlockUid,
  getPageUidByPageName,
  getUniqueUidsArray,
  isRegex,
  sortByEditTime,
  sortByPageTitle,
} from "./utils";

export async function copyMatchingUidsToClipboard(
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

export const copyMatchingPagesToClipbard = () => {
  let stringToPaste = "";
  if (matchArray.length) {
    for (let i = 0; i < matchArray.length; i++) {
      stringToPaste += `[[${matchArray[i].title}]]\n\n`;
    }
  }
  navigator.clipboard.writeText(stringToPaste.trim());
};

export function insertChangedBlocks(
  startUid,
  blocksArray,
  title,
  mode,
  isChanged
) {
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

export function displayChangedBlocks(
  onlySearch = false,
  title = "",
  mode,
  isChanged,
  findStr = "",
  replaceStr = ""
) {
  let pageUid, parentUid;
  pageUid = getExtensionPageUidOrCreateIt();
  let timestamp = getNowDateAndTime();
  let array = [];
  if (!onlySearch) {
    let replaceInfos = findStr
      ? `('${findStr}' ${
          replaceStr ? " replaced by '" + replaceStr + "'" : " removed"
        }) `
      : "";
    title = `${
      lastOperation.includes("page") ? "Pages" : "Blocks"
    } changed by last ${lastOperation} ${replaceInfos}on ${timestamp}`;
    array = modifiedBlocksCopy;
  } else {
    title += timestamp;
    if (
      extractMatchesOnly &&
      (isRegex(findStr) || title.toLowerCase().includes("extract"))
    )
      array = matchingStringsArray;
    else array = matchArray;
  }

  if (mode !== "replace page names") {
    if (matchesSortedBy === "page") array = sortByPageTitle(array);
    else if (matchesSortedBy === "date") array = sortByEditTime(array);
  }
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
