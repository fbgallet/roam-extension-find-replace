import React from "react";
import ReactDOM from "react-dom";
import FormDialog from "roamjs-components/components/FormDialog";
import { Button } from "@blueprintjs/core";
import { useState } from "react";
import renderOverlay from "roamjs-components/util/renderOverlay";
import {
  resultsJSX,
  dialogTitle,
  textToCopy,
  handleSubmit,
  submitParams,
} from ".";

const Dialog = () => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <>
      <FormDialog
        isOpen={isOpen}
        title={dialogTitle}
        onClose={() => setIsOpen(false)}
        onSubmit={() => handleSubmit(...submitParams)}
        content={resultsJSX}
        className={"fr-dialog"}
      />
    </>
  );
};

// export const myDialog = (test) => {
//   ReactDOM.render(<Dialog />, document.querySelector(".roam-article"));
// };

export function displayForm(
  submitButtonTitle = "Copy to clipboard",
  contentClass
) {
  renderOverlay({
    Overlay: Dialog,
  });

  let dialog = document.querySelector(`.bp3-dialog:has(${contentClass})`);
  let cancelButton = dialog.querySelector(".bp3-button-text");
  cancelButton.innerText = "Close";
  let submitButton = dialog.querySelector(".bp3-button.bp3-intent-primary");
  submitButton.innerText = submitButtonTitle;
}
