import React from "react";
import { Alert, Intent } from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { updateBlock, getBlockAttributes } from "./utils";
import { displayChangedBlocks } from "./copyResults";
import { warningToast } from "./notifications";
import state from "./state";
import { changeBlockToPage, changePageToBlock } from "./wholeGraph";
import { openPanel } from "./panelBridge";

// Dependencies injected from index.js to avoid circular imports
let _findAndReplace,
  _searchOnly,
  _appendPrepend,
  _replaceOpened,
  _changeBlockFormat,
  _selectedNodesProcessing;

export function setUndoRedoDeps({
  findAndReplace,
  searchOnly,
  appendPrepend,
  replaceOpened,
  changeBlockFormat,
  selectedNodesProcessing,
}) {
  _findAndReplace = findAndReplace;
  _searchOnly = searchOnly;
  _appendPrepend = appendPrepend;
  _replaceOpened = replaceOpened;
  _changeBlockFormat = changeBlockFormat;
  _selectedNodesProcessing = selectedNodesProcessing;
}

export const undoLastBulkOperation = async function (
  matchesNb = state.changesNbBackup,
  inputStr = "",
  replaceStr = "",
) {
  if (state.lastOperation === "block to page") {
    state.lastOperation = "page to block";
    changePageToBlock(
      state.inputBackup[1],
      state.inputBackup[0],
      state.inputBackup[4],
    );
    let temp = state.inputBackup[1];
    state.inputBackup[1] = state.inputBackup[0];
    state.inputBackup[0] = temp;
  } else if (state.lastOperation === "page to block") {
    state.lastOperation = "block to page";
    changeBlockToPage(
      state.inputBackup[1],
      state.inputBackup[0],
      state.inputBackup[4],
    );
    let temp = state.inputBackup[1];
    state.inputBackup[1] = state.inputBackup[0];
    state.inputBackup[0] = temp;
  } else if (state.lastOperation === "Find and Replace page names") {
    let backupArray = [];
    if (state.modifiedBlocksCopy.length) {
      for (const match of state.modifiedBlocksCopy) {
        backupArray.push({
          uid: match.uid,
          title: getPageTitleByPageUid(match.uid),
        });
        await roamAlphaAPI.data.page.update({
          page: {
            uid: match.uid,
            title: match.title,
          },
        });
      }
      state.modifiedBlocksCopy = [...backupArray];
    }
  } else {
    for (let index = 0; index < state.modifiedBlocksCopy.length; index++) {
      let uid = state.modifiedBlocksCopy[index].uid;
      let blockContent = state.modifiedBlocksCopy[index].content;
      let blockState = state.modifiedBlocksCopy[index].open;
      await updateBlock(uid, blockContent, blockState);
      let block = getBlockAttributes(uid);
      if (state.formatChange) {
        if (
          block.heading != state.modifiedBlocksCopy[index].h &&
          state.modifiedBlocksCopy[index].h != "noChange"
        ) {
          await window.roamAlphaAPI.updateBlock({
            block: { uid: uid, heading: state.modifiedBlocksCopy[index].h },
          });
        }
        if (state.modifiedBlocksCopy[index].a != "noChange") {
          await window.roamAlphaAPI.updateBlock({
            block: {
              uid: uid,
              "text-align": state.modifiedBlocksCopy[index].a,
            },
          });
        }
        if (state.modifiedBlocksCopy[index].v != "noChange") {
          await window.roamAlphaAPI.updateBlock({
            block: {
              uid: uid,
              "children-view-type": state.modifiedBlocksCopy[index].v,
            },
          });
        }
        let hOld;
        if (block.heading != null) {
          hOld = block.heading;
        } else {
          hOld = 0;
        }
        state.modifiedBlocksCopy[index] = {
          uid: block.uid,
          content: block.string,
          open: block.open,
          h: hOld,
          a: block["text-align"],
          v: block["view-type"],
        };
      } else {
        state.modifiedBlocksCopy[index] = {
          uid: block.uid,
          content: block.string,
          open: block.open,
        };
      }
    }
  }
  await undoPopup(matchesNb, inputStr, replaceStr, 5000, "replace");
};

/**
 * Shows a toast with Undo + Display changed blocks actions.
 * Replaces the old iziToast.warning() undo popup.
 */
export const undoPopup = async function (
  matchesNb = state.changesNbBackup,
  findInput,
  replaceStr,
  timeout = 8000,
  display = "once",
) {
  const msg =
    matchesNb +
    " match(es) replaced!\n" +
    "Undo this '" +
    state.lastOperation +
    "' operation? (Do not use Ctrl+Z)";

  // Use a Blueprint Toaster with action button for UNDO
  // We render an Alert-style component for the undo confirmation
  const UndoAlert = ({ isOpen, onClose }) => (
    <Alert
      isOpen={isOpen}
      onClose={onClose}
      intent={Intent.WARNING}
      confirmButtonText="UNDO"
      cancelButtonText="Keep changes"
      canEscapeKeyCancel
      canOutsideClickCancel
      onConfirm={async () => {
        await new Promise((r) => setTimeout(r, 100));
        await undoLastBulkOperation(matchesNb, replaceStr, findInput);
        onClose();
      }}
      icon="undo"
    >
      <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{msg}</p>
      <div style={{ marginTop: 12 }}>
        <button
          style={{
            fontSize: 12, background: "none", border: "1px solid #ccc",
            borderRadius: 3, padding: "3px 8px", cursor: "pointer",
          }}
          onClick={() => {
            displayChangedBlocks(
              false, "",
              state.lastOperation === "Find and Replace page names" ? "replace page names" : "",
              true,
              findInput,
              replaceStr,
            );
            onClose();
          }}
        >
          Display changed blocks in sidebar
        </button>
      </div>
    </Alert>
  );
  renderOverlay({ Overlay: UndoAlert });
};

/******************************************************************************************
/*	Redo last bulk operation
/******************************************************************************************/
export const redoPopup = async function () {
  if (
    state.lastOperation === "block to page" ||
    state.lastOperation === "page to block"
  )
    return;
  if (state.lastOperation === "Find and Replace")
    _findAndReplace(
      state.lastOperation,
      state.inputBackup[0],
      state.inputBackup[1],
      state.inputBackup[2],
      state.inputBackup[3],
      state.inputBackup[4],
      state.inputBackup[5],
    );
  else if (state.lastOperation === "Search")
    _searchOnly(
      state.inputBackup[0],
      state.inputBackup[1],
      state.inputBackup[2],
      state.inputBackup[3],
      state.inputBackup[4],
    );
  else {
    const confirmMsg =
      "Are you sure you want to redo the last bulk '" +
      state.lastOperation +
      "' operation?";

    const RedoAlert = ({ isOpen, onClose }) => (
      <Alert
        isOpen={isOpen}
        onClose={onClose}
        intent={Intent.WARNING}
        confirmButtonText="Yes, redo"
        cancelButtonText="No"
        canEscapeKeyCancel
        canOutsideClickCancel
        onConfirm={async () => {
          let callback;
          switch (state.lastOperation) {
            case "":
              alert("No bulk operation has been run.");
              return;
            case "Undo":
              undoLastBulkOperation();
              break;
            case "Append and/or Prepend":
              callback = _appendPrepend;
              break;
            case "Find and Replace":
              callback = _replaceOpened;
              break;
            case "Change format":
            default:
              callback = _changeBlockFormat;
              break;
          }
          while (state.modifiedBlocksCopy.length > 0) state.modifiedBlocksCopy.pop();
          await _selectedNodesProcessing(
            state.expandedNodesUid,
            state.inputBackup,
            callback,
          );
          onClose();
        }}
      >
        <p>{confirmMsg}</p>
      </Alert>
    );
    renderOverlay({ Overlay: RedoAlert });
  }
};
