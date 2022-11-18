import React from "react";
import ReactDOM from "react-dom";
import FormDialog from "roamjs-components/components/FormDialog";
import { Button } from "@blueprintjs/core";
import { useState } from "react";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { resultsJSX, dialogTitle, textToCopy } from ".";

const Dialog = () => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <>
      <FormDialog
        isOpen={isOpen}
        title={dialogTitle}
        onClose={() => setIsOpen(false)}
        onSubmit={() => navigator.clipboard.writeText(textToCopy)}
        content={resultsJSX}
      />
    </>
  );
};

// export const myDialog = (test) => {
//   ReactDOM.render(<Dialog />, document.querySelector(".roam-article"));
// };

export function displayForm() {
  renderOverlay({
    Overlay: Dialog,
  });

  let dialog = document.querySelector(".bp3-dialog");
  dialog.style.width = "60%";
  dialog.style.position = "absolute";
  dialog.style.top = "200px";
  dialog.style.left = "40px";
  let cancelButton = dialog.querySelector(".bp3-button-text");
  cancelButton.innerText = "Close";
  let submitButton = dialog.querySelector(".bp3-button.bp3-intent-primary");
  submitButton.innerText = "Copy to clipboard";
}
