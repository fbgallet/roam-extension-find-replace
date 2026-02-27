import React, { useState, useEffect, useRef } from "react";
import { Alert, Intent } from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { updateBlock, getBlockAttributes } from "./utils";
import { displayChangedBlocks } from "./copyResults";
import { getUndoToaster } from "./toaster";
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

export const undoLastBulkOperation = async function () {
  if (state.lastOperation === "block to page") {
    state.lastOperation = "page to block";
    await changePageToBlock(
      state.inputBackup[1],
      state.inputBackup[0],
      state.inputBackup[4],
    );
    let temp = state.inputBackup[1];
    state.inputBackup[1] = state.inputBackup[0];
    state.inputBackup[0] = temp;
  } else if (state.lastOperation === "page to block") {
    state.lastOperation = "block to page";
    await changeBlockToPage(
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
};

const btnStyle = (bg, color, border = "none") => ({
  background: bg,
  color,
  border,
  borderRadius: 3,
  padding: "3px 10px",
  fontSize: 12,
  cursor: "pointer",
  fontWeight: "bold",
  flexShrink: 0,
});

const UndoToastMessage = ({
  matchesNb,
  findInput,
  replaceStr,
  operation,
  timeoutSec,
  onDismiss,
  onUndo,
  onDisplay,
}) => {
  const [seconds, setSeconds] = useState(timeoutSec);
  const pausedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!pausedRef.current) {
        setSeconds((s) => {
          if (s <= 1) {
            clearInterval(interval);
            return 0;
          }
          return s - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <span>
        <strong>{matchesNb}</strong> match(es) replaced
        {" — "}
        <em>{operation}</em>
      </span>
      <span style={{ fontSize: 11, opacity: 0.8 }}>
        Do not use Ctrl+Z to undo.
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          onClick={onUndo}
          style={btnStyle("#fff", "#c75000", "2px solid #c75000")}
        >
          ↩ Undo
        </button>
        <button
          onClick={onDisplay}
          style={btnStyle(
            "transparent",
            "#fff",
            "1px solid rgba(255,255,255,0.5)",
          )}
        >
          Display changes
        </button>
        <button
          onClick={onDismiss}
          style={btnStyle(
            "transparent",
            "#fff",
            "1px solid rgba(255,255,255,0.5)",
          )}
        >
          Close ({seconds})
        </button>
      </div>
    </div>
  );
};

/**
 * Shows a non-blocking bottom-right toast with Undo + Display changed blocks actions.
 * Auto-dismisses after timeout. Does not block interaction with the page.
 */
export const undoPopup = async function (
  matchesNb = state.changesNbBackup,
  findInput,
  replaceStr,
  timeout = 8000,
  display = "once",
) {
  const toaster = getUndoToaster();
  const timeoutSec = Math.round(timeout / 1000);
  let toastKey;

  const dismiss = () => toaster.dismiss(toastKey);

  toastKey = toaster.show({
    message: (
      <UndoToastMessage
        matchesNb={matchesNb}
        findInput={findInput}
        replaceStr={replaceStr}
        operation={state.lastOperation}
        timeoutSec={timeoutSec}
        onDismiss={dismiss}
        onUndo={async () => {
          dismiss();
          await new Promise((r) => setTimeout(r, 100));
          await undoLastBulkOperation();
        }}
        onDisplay={() => {
          dismiss();
          displayChangedBlocks(
            false,
            "",
            state.lastOperation === "Find and Replace page names"
              ? "replace page names"
              : "",
            true,
            findInput,
            replaceStr,
          );
        }}
      />
    ),
    intent: Intent.WARNING,
    timeout,
    className: "fr-undo-toast",
    icon: "undo",
  });
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
              await undoLastBulkOperation();
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
          while (state.modifiedBlocksCopy.length > 0)
            state.modifiedBlocksCopy.pop();
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
