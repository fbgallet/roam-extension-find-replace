import React from "react";
import { Toaster, Position, Intent, OverlayToaster } from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { updatePanelField } from "./panelBridge";
import state from "./state";

// Singleton toaster instance (created lazily)
let _toaster = null;

function getToaster() {
  if (_toaster) return _toaster;
  const container = document.createElement("div");
  container.id = "fr-toaster-root";
  document.body.appendChild(container);
  _toaster = OverlayToaster.createAsync(
    { position: Position.TOP, maxToasts: 3 },
    { domRenderer: (toaster, el) => ReactDOM.render(toaster, el), container },
  );
  return _toaster;
}

// Simpler approach: use static Toaster.create for synchronous access
let _toasterSync = null;
function getToasterSync() {
  if (_toasterSync) return _toasterSync;
  _toasterSync = Toaster.create({ position: Position.TOP, maxToasts: 3 });
  return _toasterSync;
}

// Bottom-right toaster for non-blocking undo/redo notifications
let _undoToasterSync = null;
export function getUndoToaster() {
  if (_undoToasterSync) return _undoToasterSync;
  _undoToasterSync = Toaster.create({
    position: Position.BOTTOM_RIGHT,
    maxToasts: 2,
  });
  return _undoToasterSync;
}

export const errorToast = (message) => {
  getToasterSync().show({
    message: React.createElement(
      "span",
      null,
      React.createElement("strong", null, "Input error: "),
      message,
    ),
    intent: Intent.WARNING,
    timeout: 4000,
    icon: "warning-sign",
  });
};

export const infoToast = (message, timeout = 4000) => {
  getToasterSync().show({
    message,
    intent: Intent.PRIMARY,
    timeout,
    icon: "info-sign",
  });
};

export const warningToast = (message, timeout = 5000) => {
  getToasterSync().show({
    message,
    intent: Intent.WARNING,
    timeout,
    icon: "warning-sign",
  });
};

/** Replaces displayWholeGraphCountInTitle — updates the panel header label */
export const displayWholeGraphCountInTitle = (msg = "") => {
  let label = "";
  if (msg === "") {
    label = "In whole graph: " + state.changesNb + " matches";
  } else {
    label = msg;
  }
  updatePanelField("matchLabel", label);
  return label;
};
