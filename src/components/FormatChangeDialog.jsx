import React, { useState } from "react";
import { Dialog, Button, HTMLSelect, Classes, Intent } from "@blueprintjs/core";

/**
 * FormatChangeBody — the format-change controls, usable inline (panel tab)
 * or inside a Dialog wrapper.
 *
 * Props:
 *   heading, setHeading, alignment, setAlignment,
 *   view, setView, caseChange, setCaseChange  — controlled state from parent
 */
export const FormatChangeBody = ({
  heading,
  setHeading,
  alignment,
  setAlignment,
  view,
  setView,
  caseChange,
  setCaseChange,
}) => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    <HTMLSelect
      value={heading}
      onChange={(e) => setHeading(e.target.value)}
      title="Heading level"
    >
      <option value="noChange">Heading (no change)</option>
      <option value="1">H1</option>
      <option value="2">H2</option>
      <option value="3">H3</option>
      <option value="0">Normal</option>
    </HTMLSelect>

    <HTMLSelect
      value={alignment}
      onChange={(e) => setAlignment(e.target.value)}
      title="Text alignment"
    >
      <option value="noChange">Alignment (no change)</option>
      <option value="left">Left</option>
      <option value="center">Center</option>
      <option value="right">Right</option>
      <option value="justify">Justify</option>
    </HTMLSelect>

    <HTMLSelect
      value={view}
      onChange={(e) => setView(e.target.value)}
      title="View type"
    >
      <option value="noChange">View as… (no change)</option>
      <option value="document">Document</option>
      <option value="numbered">Numbered List</option>
      <option value="bullet">Bulleted List</option>
    </HTMLSelect>

    <HTMLSelect
      value={caseChange}
      onChange={(e) => setCaseChange(e.target.value)}
      title="Case transformation"
    >
      <option value="noChange">Case (no change)</option>
      <option value="toUpper">UPPER case</option>
      <option value="toLower">lower case</option>
      <option value="capitalizeB" title="Capitalize first letter of the block">Cap. block</option>
      <option value="capitalizeW" title="Capitalize Each Word">Cap. Words</option>
      <option value="capitalizeS" title="Capitalize each sentence.">Cap. sentences</option>
    </HTMLSelect>
  </div>
);

/**
 * FormatChangeDialog — standalone dialog wrapper (used by command palette path).
 */
const FormatChangeDialog = ({ isOpen, onClose, onApply }) => {
  const [heading, setHeading] = useState("noChange");
  const [alignment, setAlignment] = useState("noChange");
  const [view, setView] = useState("noChange");
  const [caseChange, setCaseChange] = useState("noChange");

  const handleApply = () => {
    onApply(heading, alignment, view, caseChange);
    setHeading("noChange");
    setAlignment("noChange");
    setView("noChange");
    setCaseChange("noChange");
  };

  const nothingSelected =
    heading === "noChange" &&
    alignment === "noChange" &&
    view === "noChange" &&
    caseChange === "noChange";

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk format change for selected blocks"
      enforceFocus={false}
      style={{ width: 420 }}
    >
      <div className={Classes.DIALOG_BODY}>
        <p style={{ fontSize: 13, color: "#5f6b7c", marginBottom: 12 }}>
          Select the formatting changes to apply to all selected blocks.
        </p>
        <FormatChangeBody
          heading={heading}
          setHeading={setHeading}
          alignment={alignment}
          setAlignment={setAlignment}
          view={view}
          setView={setView}
          caseChange={caseChange}
          setCaseChange={setCaseChange}
        />
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button text="Cancel" onClick={onClose} />
          <Button
            text="Apply"
            intent={Intent.PRIMARY}
            onClick={handleApply}
            disabled={nothingSelected}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default FormatChangeDialog;
