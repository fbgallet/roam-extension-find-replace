import React from "react";
import { Dialog, Button, Intent, Classes } from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import state from "./state";

const FRDialog = ({ isOpen, onClose }) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={state.dialogTitle}
      enforceFocus={false}
      autoFocus={false}
      className="fr-dialog"
    >
      <div className={Classes.DIALOG_BODY}>{state.resultsJSX}</div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button text={state.cancelButtonTitle} onClick={onClose} />
          <Button
            text={state.submitButtonTitle}
            intent={Intent.PRIMARY}
            onClick={() => {
              state.handleSubmit(...state.submitParams);
              onClose();
            }}
          />
        </div>
      </div>
    </Dialog>
  );
};


export function displayForm(submitButtonTitle = "Copy to clipboard") {
  state.submitButtonTitle = submitButtonTitle;
  state.cancelButtonTitle = "Close";
  renderOverlay({
    Overlay: FRDialog,
  });
}
