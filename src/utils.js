import getEditTime from "roamjs-components/queries/getEditTimeByBlockUid";
import { regexVarInsert } from ".";

export const uidRegex = /\(\([^\)]{9}\)\)/g;
const pageRegex = /\[\[.*\]\]/g; // very simplified...
const regexPatternRegex = /^\/(.*)\/([^\/]*)$/;

export function getPagesNamesMatchingRegex(regexStr) {
  let wordOnly = false;
  const splittedRegex = regexStr.toString().match(regexPatternRegex);
  if (splittedRegex[1].includes("\\b")) {
    wordOnly = true;
  }
  let dataLogRegexStr = removeEscapeCharacters(splittedRegex[1]);
  dataLogRegexStr =
    splittedRegex.length > 2 && splittedRegex[2].includes("i")
      ? "(?i)" + dataLogRegexStr
      : dataLogRegexStr;
  let result = window.roamAlphaAPI.q(`[:find
    (pull ?node [:block/string :node/title :block/uid])
  :where
    [(re-pattern "${dataLogRegexStr}") ?regex]
    [?node :node/title ?node-Title]
    [(re-find ?regex ?node-Title)]
  ]`);
  if (wordOnly) {
    result = result.filter((elt) => regexStr.test(elt[0].title));
  }
  return result;
}

export function getTreeByUid(uid) {
  if (uid) {
    // // previous query version
    // return window.roamAlphaAPI.q(`[:find (pull ?page
    //                  [:block/uid :block/string :block/children {:block/parents [:block/uid]} :block/open {:block/refs [:block/uid]} :block/order
    //                     {:block/children  ...} ])
    //                   :where [?page :block/uid "${uid}"] ]`)[0][0];
    return window.roamAlphaAPI.pull(
      "[:block/uid :block/string :block/children {:block/children  ...} :block/open {:block/refs [:block/uid]} :block/order {:block/page [:block/uid]}]",
      [":block/uid", uid]
    );
  } else return null;
}

export function getPlainTextOfChildren(uid) {
  let childContent = window.roamAlphaAPI.pull(
    "[:block/uid {:block/children [:block/string]}]",
    [":block/uid", uid]
  )[":block/children"];
  //console.log(childContent);
  let content = "";
  if (childContent != undefined) {
    for (let i = 0; i < childContent.length; i++) {
      content += " " + childContent[i][":block/string"];
    }
  }
  return content;
}

export function getChildrenUid(uid) {
  let children = window.roamAlphaAPI.pull(
    "[:block/uid {:block/children [:block/uid]}]",
    [":block/uid", uid]
  )[":block/children"];
  if (children != undefined) {
    let childrenUid = [];
    for (let i = 0; i < children.length; i++) {
      childrenUid.push(children[i][":block/uid"]);
    }
    return childrenUid;
  }
  return null;
}

export function getParentTreeUids(uid) {
  if (uid) {
    let arrayOfArrays = window.roamAlphaAPI.q(`[:find ?p
                      :where 
                      [?q :block/uid "${uid}"]
                      [?q :block/parents ?i]
                      [?i :block/uid ?p]
                    ]`);
    let parentArray = [];
    for (let i = 1; i < arrayOfArrays.length; i++) {
      parentArray.push(arrayOfArrays[i][0]);
    }
    return parentArray;
  } else return null;
  /* return window.roamAlphaAPI.data.pull(
      "[:block/parents]",
      `[:db/id :block/uid] [:block/uid "${uid}"]`
    );*/
}

export function getBlockAttributes(uid) {
  // // previous query version
  // return window.roamAlphaAPI.q(`[:find (pull ?page
  //                               [:block/string :block/uid :block/open {:block/parents [:block/uid]} {:block/refs [:block/uid]}
  //                                :block/heading :block/text-align :children/view-type
  //                                ])
  //                     :where [?page :block/uid "${uid}"]  ]`)[0][0];
  let r = window.roamAlphaAPI.pull(
    "[:block/uid :block/string :block/open {:block/refs [:block/uid]} :block/order {:block/page [:block/uid]} :block/heading :block/text-align :children/view-type]",
    [":block/uid", uid]
  );
  return {
    uid: r[":block/uid"],
    string: r[":block/string"],
    open: r[":block/open"],
    refs:
      r[":block/refs"] == undefined
        ? []
        : r[":block/refs"].map((a) => a[":block/uid"]),
    order: r[":block/order"],
    page:
      r[":block/page"] != undefined
        ? r[":block/page"][":block/uid"]
        : undefined,
    heading: r[":block/heading"],
    "text-align": r[":block/text-align"],
    "view-type": r[":block/view-type"],
  };
}

export function getAllBlockData() {
  // TODO a pull version for that query ?
  return window.roamAlphaAPI
    .q(
      `[:find ?u ?s ?p :where [?e :block/uid ?u] [?e :block/string ?s]
  [?e :block/page ?t] [?t :block/uid ?p]]`
    )
    .map((f) => ({ uid: f[0], text: f[1], page: f[2] }));
}

export function getPageTitleByBlockUid(uid) {
  return window.roamAlphaAPI.pull("[{:block/page [:block/uid :node/title]}]", [
    ":block/uid",
    uid,
  ])[":block/page"][":node/title"];
}

export function getBlockContentByUid(uid) {
  let result = window.roamAlphaAPI.pull("[:block/string]", [":block/uid", uid]);
  if (result) return result[":block/string"];
  else return "";
}

export function getPageUidByPageName(page) {
  let p = window.roamAlphaAPI.q(`[:find (pull ?e [:block/uid]) 
							     :where [?e :node/title "${page}"]]`);
  if (p.length == 0) return undefined;
  else return p[0][0].uid;
}

export function getPageUidOfBlock(uid) {
  let p = window.roamAlphaAPI.q(`[:find ?page-uid 
							     :where [?b :block/uid "${uid}"]
                   [?b :block/page ?p]
                   [?p :block/uid ?page-uid]]`);
  if (!p.length) return undefined;
  else return p[0][0];
}

export function getPageNameByPageUid(uid) {
  let r = window.roamAlphaAPI.data.pull("[:node/title]", [":block/uid", uid]);
  if (r != null) return r[":node/title"];
  else return "undefined";
}

export async function getPageUidByNameOrCreateIt(name) {
  let pageUid = getPageUidByPageName(name);
  if (pageUid === undefined) {
    pageUid = window.roamAlphaAPI.util.generateUID();
    await window.roamAlphaAPI.createPage({
      page: { title: name, uid: pageUid },
    });
  }
  return pageUid;
}

export function updateBlock(uid, content, isOpen) {
  setTimeout(function () {
    if (isOpen !== undefined)
      window.roamAlphaAPI.updateBlock({
        block: { uid: uid, string: content, open: isOpen },
      });
    else
      window.roamAlphaAPI.updateBlock({
        block: { uid: uid, string: content },
      });
  }, 10);
}

export function simulateClick(el) {
  const options = {
    bubbles: true,
    cancelable: true,
    view: window,
    target: el,
    which: 1,
    button: 0,
  };
  el.dispatchEvent(new MouseEvent("mousedown", options));
  el.dispatchEvent(new MouseEvent("mouseup", options));
  el.dispatchEvent(new MouseEvent("click", options));
}

export const createBlockOnDNP = async (order = "last", content = "") => {
  let blockUid = window.roamAlphaAPI.util.generateUID();
  let dnp = window.roamAlphaAPI.util.dateToPageUid(new Date());
  window.roamAlphaAPI.createBlock({
    location: { "parent-uid": dnp, order: order },
    block: {
      uid: blockUid,
      string: content,
    },
  });
  return blockUid;
};

export const normalizeInputRegex = function (
  toFindStr,
  strToReplace,
  caseNotSensitive = false,
  wordOnly = false,
  searchLogic = "",
  expandToHighlight = false,
  isGlobal = true
) {
  let toFindregexp;
  if (toFindStr != null && strToReplace != null) {
    let regParts = toFindStr.match(/^\/(.*?)\/([gimsuy]*)$/);
    if (regParts) {
      if (!regParts[2].includes("i") && caseNotSensitive) {
        regParts[2] += "i";
      }
      if (!regParts[2].includes("g") && isGlobal) regParts[2] += "g";
      toFindregexp = new RegExp(regParts[1], regParts[2]);
    } else {
      toFindStr = toFindStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let regPar2 = isGlobal ? "g" : "";
      if (caseNotSensitive) {
        regPar2 += "i";
      }
      if (searchLogic != "") {
        let logicString = "";
        let logicStringAnd = "";
        let split = toFindStr.split(" ");
        for (let i = 0; i < split.length; i++) {
          if (wordOnly) split[i] = "\\b" + split[i] + "\\b";
          //if (searchLogic == "OR") {
          logicString += split[i];
          if (i != split.length - 1) logicString += "|";
          //}
          if (searchLogic == "AND") {
            logicStringAnd += "(?=.*" + split[i] + ")";
            if (i == split.length - 1) logicStringAnd += ".*";
          }
        }
        if (searchLogic == "AND")
          logicString = { and: logicStringAnd, or: logicString };
        toFindStr = logicString;
      } else if (wordOnly) toFindStr = "\\b" + toFindStr + "\\b";
      if (searchLogic == "AND")
        toFindregexp = {
          and: new RegExp(toFindStr.and, regPar2),
          or: new RegExp(toFindStr.or, regPar2),
        };
      else toFindregexp = new RegExp(toFindStr, regPar2);
    }
    //console.log(toFindregexp);
    return [toFindregexp, strToReplace, searchLogic];
  }
  return null;
};

export function normalizeMention(input, type, strict = false) {
  if (type === "block") {
    uidRegex.lastIndex = 0;
    if (uidRegex.test(input)) return input;
    else if (!strict) {
      input = "((" + input + "))";
      uidRegex.lastIndex = 0;
      if (uidRegex.test(input)) return input;
      else {
        console.log(input + " is not a valid " + type + " reference.");
        return null;
      }
    }
  } else if (type === "page") {
    pageRegex.lastIndex = 0;
    if (pageRegex.test(input)) return input;
    else if (!strict) {
      input = "[[" + input + "]]";
      pageRegex.lastIndex = 0;
      if (pageRegex.test(input)) return input;
      else {
        console.log(input + " is not a valid " + type + " reference.");
        return null;
      }
    }
  }
  return null;
}

export const getMatchesNbInBlock = (array, uid) => {
  return array.filter((node) => node.uid === uid).length;
};

export const moveChildBlocks = (sourceUid, targetUid) => {
  let tree = getTreeByUid(sourceUid);

  if (tree[":block/children"]) {
    let children = tree[":block/children"]
      .sort((a, b) => a[":block/order"] - b[":block/order"])
      .map((child) => child[":block/uid"]);
    for (let i = 0; i < children.length; i++) {
      window.roamAlphaAPI.moveBlock({
        location: setLocation(targetUid, i),
        block: { uid: children[i] },
      });
    }
  }
};

const setLocation = (uid, order) => {
  return {
    "parent-uid": uid,
    order: order,
  };
};

export function removeDuplicateBlocks(array) {
  let uids = [];
  let blockNodes = [];

  if (array.length > 0) {
    array.forEach((node) => {
      if (node.content != undefined && !uids.includes(node.uid)) {
        uids.push(node.uid);
        blockNodes.push(node);
      }
    });
  }
  return blockNodes;
}

export function getUniqueUidsArray(array) {
  let uids = [];
  let uniqueUids = [];
  array.forEach((node) => {
    if (!uids.includes(node.uid)) {
      uids.push(node.uid);
      uniqueUids.push(node.uid);
    }
  });
  return uniqueUids;
}

export function getArrayExcludingAnotherArray(array, excludedArray) {
  let resultArray = [];
  array.forEach((node) => {
    if (!excludedArray.includes(node)) resultArray.push(node);
  });
  return resultArray;
}

export const getNextPositionIcon = function (position) {
  switch (position) {
    case "topRight":
      return "◲";
    case "bottomRight":
      return "◱";
    case "bottomLeft":
      return "◰";
    case "topLeft":
      return "◳";
  }
};

export const getNextPosition = function (position) {
  const positions = ["topRight", "bottomRight", "bottomLeft", "topLeft"];
  let index = positions.indexOf(position);
  index++;
  if (index == positions.length) index = 0;
  return positions[index];
};

export function getNowDateAndTime() {
  let now = new Date();
  let hh = addZero(now.getHours());
  let mm = addZero(now.getMinutes());
  let day = window.roamAlphaAPI.util.dateToPageTitle(now);
  return "[[" + day + "]], " + hh + ":" + mm;
}

export function addZero(i) {
  if (i < 10) {
    i = "0" + i;
  }
  return i;
}

export const groupMatchesByPage = function (matchArray) {
  let displayArray = sortByPageTitle(matchArray);
  let treeArray = [];
  displayArray.forEach((node) => {
    if (treeArray.filter((tree) => tree.page === node.page).length == 0)
      treeArray.push({ page: node.page, blocks: [] });
    const index = treeArray.findIndex((object) => {
      return object.page === node.page;
    });
    treeArray[index].blocks.push({
      uid: node.uid,
      content: node.content,
    });
  });
  return treeArray;
};

export const sortByPageTitle = function (array) {
  return array
    .map((node) => {
      return {
        uid: node.uid,
        content: node.content,
        page: node.page || getPageUidOfBlock(node.uid),
      };
    })
    .sort((a, b) => a.page?.localeCompare(b.page) || 0);
};

export const sortByEditTime = function (array) {
  return array
    .map((node) => ({
      uid: node.uid,
      content: node.content,
      lastEdit: getEditTime(node.uid),
    }))
    .sort((a, b) => b.lastEdit - a.lastEdit);
};

export const resolveReferences = (content, uidsArray) => {
  if (uidRegex.test(content)) {
    uidRegex.lastIndex = 0;
    let matches = content.matchAll(uidRegex);
    for (const match of matches) {
      let refUid = match[0].slice(2, -2);
      let isNewRef = !uidsArray.includes(refUid);
      uidsArray.push(refUid);
      let resolvedRef = getBlockContentByUid(refUid);
      uidRegex.lastIndex = 0;
      if (uidRegex.test(resolvedRef) && isNewRef)
        resolvedRef = resolveReferences(resolvedRef, uidsArray);
      content = content.replace(match, resolvedRef);
    }
  }
  return content;
};

export const isRegex = (string) => {
  const firstIndex = string.indexOf("/");
  const lastIndex = string.lastIndexOf("/");
  return firstIndex === 0 && lastIndex && lastIndex - firstIndex > 1;
};

const removeEscapeCharacters = (str) => {
  return str.replace(/\\[bfnrt'"]|\\/g, "");
};

export const replaceSubstringOrCaptureGroup = (
  str,
  toReplaceRegex,
  replacingStr
) => {
  let strToReplace, result;
  const regexSplit = toReplaceRegex.toString().match(regexPatternRegex);
  const regex = new RegExp(
    regexSplit[1],
    regexSplit && regexSplit.length > 2 && regexSplit[2]
  );
  const matchingStr = str.match(regex);
  if (
    replacingStr.search(/\$regex/i) == -1 &&
    replacingStr.search(/\$1/) == -1 &&
    replacingStr.search(/\$2/) == -1
  ) {
    if (matchingStr && matchingStr.length > 1) {
      // has a capture group
      replacingStr = matchingStr[0].replace(matchingStr[1], replacingStr);
      strToReplace = matchingStr[0];
    } else if (matchingStr && matchingStr.length === 1)
      strToReplace = matchingStr[0];
    result = str.replace(strToReplace, replacingStr);
  } else result = replaceGroupPlaceholders(str, matchingStr, replacingStr);
  return result;
};

const replaceGroupPlaceholders = (str, matchingStr, replacingStr) => {
  let stringArray = [];
  let lastIndex = 0;
  let reverse = false;
  if (matchingStr.index != 0) {
    stringArray.push(str.substring(lastIndex, matchingStr.index));
  }
  if (!reverse)
    stringArray.push(regexVarInsert(matchingStr, replacingStr, str));
  else {
    let last = stringArray.length - 1;
    stringArray[last] = regexVarInsert([stringArray[last]], replacingStr, str);
    stringArray.push(
      str.substring(
        matchingStr.index,
        matchingStr.index + matchingStr[0].length
      )
    );
  }
  lastIndex = matchingStr.index + matchingStr[0].length;

  if (lastIndex < str.length - 1) {
    let end = str.substring(lastIndex);
    if (!reverse) stringArray.push(end);
    else stringArray.push(regexVarInsert([end], replacingStr, str));
  }
  return stringArray.join("");
};
