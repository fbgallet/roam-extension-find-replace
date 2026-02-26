import React, { useState } from "react";
import { Dialog, Button, InputGroup, Classes, Intent } from "@blueprintjs/core";

const AppendPrependDialog = ({ isOpen, onClose, onConfirm }) => {
  const [prefixe, setPrefixe] = useState("");
  const [suffixe, setSuffixe] = useState("");

  const handleConfirm = () => {
    onConfirm(prefixe, suffixe);
    setPrefixe("");
    setSuffixe("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleConfirm();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Prepend / Append to selected blocks"
      enforceFocus={false}
      style={{ width: 380 }}
    >
      <div className={Classes.DIALOG_BODY}>
        <p style={{ fontSize: 13, color: "#5f6b7c", marginBottom: 12 }}>
          Text to prepend or/and append to each selected block. Don't forget spaces if needed.
        </p>
        <InputGroup
          placeholder="Text to prepend…"
          value={prefixe}
          onChange={(e) => setPrefixe(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{ marginBottom: 8 }}
        />
        <InputGroup
          placeholder="Text to append…"
          value={suffixe}
          onChange={(e) => setSuffixe(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button text="Cancel" onClick={onClose} />
          <Button
            text="Confirm"
            intent={Intent.PRIMARY}
            onClick={handleConfirm}
            disabled={prefixe === "" && suffixe === ""}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default AppendPrependDialog;
