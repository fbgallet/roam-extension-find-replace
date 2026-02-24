import iziToast from "izitoast";
import state from "./state";

// Dependencies injected from index.js
let _examplesOfRegex = "";

export function setHelpersDeps({ examplesOfRegex }) {
  _examplesOfRegex = examplesOfRegex;
}

export const helpToast = (
  title = "Examples of regular expressions that could be useful:",
  msg = null,
) => {
  if (msg === null) msg = _examplesOfRegex;
  iziToast.show({
    maxWidth: 630,
    title: title,
    position: "center",
    messageLineHeight: "22",
    message: msg,
    timeout: false,
  });
};

export const initializeGlobalVar = (close) => {
  if (!close) state.changesNbBackup = 0;
  state.changesNb = 0;
  state.ANDwithChildren = false;
  state.scrollIndex = 0;
  state.matchIndex = 0;
  state.matchingTotal = 0;
  state.matchingHidden = 0;
  state.matchArray.length = 0;
  state.matchingStringsArray.length = 0;
  // state.seletionBlue = false;
};

export const displayMatchCountInTitle = function (toast) {
  let toastTitle = toast.querySelector(".iziToast-title");
  let currentScroll = 0;
  let hiddenStr = "";
  if (state.matchingHidden > 0)
    hiddenStr = " (+" + state.matchingHidden + " in collapsed blocks)";
  let unhighlightableElts = state.matchingTotal - state.eltFound.length;
  let unhighlightableStr = "";
  if (unhighlightableElts > 0)
    unhighlightableStr =
      " (" +
      unhighlightableElts +
      " elements can't be highlighted, e.g. in code blocks)";
  if (state.matchArray.length != 0) currentScroll = state.scrollIndex + 1;
  let label =
    parseInt(currentScroll) +
    " / " +
    state.matchingTotal +
    hiddenStr +
    unhighlightableStr;
  toastTitle.innerText = label;
  return label;
};

export const getCurrentToastLabel = function (toast) {
  return toast.querySelector(".iziToast-title").innerText;
};
