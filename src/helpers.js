import React from "react";
import { Dialog, Button, Classes } from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { updatePanelField } from "./panelBridge";
import state from "./state";

// Dependencies injected from index.js
let _examplesOfRegex = "";

export function setHelpersDeps({ examplesOfRegex }) {
  _examplesOfRegex = examplesOfRegex;
}

/**
 * Shows a BlueprintJS dialog with regex examples.
 * Replaces the old iziToast.show() help popup.
 */
export const helpToast = (
  title = "Examples of regular expressions that could be useful:",
  msg = null,
) => {
  if (msg === null) msg = _examplesOfRegex;
  const HelpDialog = ({ isOpen, onClose }) => (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      style={{ maxWidth: 640, width: "90%" }}
      enforceFocus={false}
    >
      <div className={Classes.DIALOG_BODY}>
        <div
          style={{ fontSize: 13, lineHeight: "1.6" }}
          dangerouslySetInnerHTML={{ __html: msg }}
        />
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
          <strong>How to support my work?</strong>{" "}
          Become a{" "}
          <a href="https://github.com/sponsors/fbgallet" target="_blank" rel="noreferrer">Github sponsor</a>,{" "}
          <a href="https://buymeacoffee.com/fbgallet" target="_blank" rel="noreferrer">buy me a coffee</a>{" "}
          or follow @fbgallet on{" "}
          <a href="https://x.com/fbgallet" target="_blank" rel="noreferrer">X</a>,{" "}
          on <a href="https://bsky.app/profile/fbgallet.bsky.social" target="_blank" rel="noreferrer">Bluesky</a>{" "}
          or on <a href="https://mastodon.social/@fbgallet" target="_blank" rel="noreferrer">Mastodon</a>
        </div>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button text="Close" onClick={onClose} />
        </div>
      </div>
    </Dialog>
  );
  renderOverlay({ Overlay: HelpDialog });
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
};

/**
 * Computes the current match count label and pushes it to the panel bridge
 * so the React component re-renders automatically.
 * Returns the label string (kept for backward compat with callers that use the return value).
 */
export const displayMatchCountInTitle = function () {
  let currentScroll = 0;
  let hiddenStr = "";
  if (state.matchingHidden > 0)
    hiddenStr = " (+" + state.matchingHidden + " in collapsed blocks)";
  let unhighlightableElts = state.matchingTotal - (state.eltFound ? state.eltFound.length : 0);
  let unhighlightableStr = "";
  if (unhighlightableElts > 0)
    unhighlightableStr =
      " (" +
      unhighlightableElts +
      " elements can't be highlighted, e.g. in code blocks)";
  if (state.matchArray.length !== 0) currentScroll = state.scrollIndex + 1;
  const label =
    parseInt(currentScroll) +
    " / " +
    state.matchingTotal +
    hiddenStr +
    unhighlightableStr;
  updatePanelField("matchLabel", label);
  return label;
};
