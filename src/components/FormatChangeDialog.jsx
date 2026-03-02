import React, { useState } from "react";
import {
  Dialog,
  Button,
  HTMLSelect,
  Checkbox,
  Classes,
  Intent,
} from "@blueprintjs/core";

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
  cleanMode,
  setCleanMode,
  styleMode,
  setStyleMode,
  aliasMode,
  setAliasMode,
  taskMode,
  setTaskMode,
  removeBlank,
  setRemoveBlank,
}) => (
  <div
    style={{ display: "flex", flexDirection: "column", gap: 10 }}
    className="fr-panel-format"
  >
    {/* ── Formatting row ── */}
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
        <option
          value="capitalizeB"
          title="Capitalize first letter of the block"
        >
          Cap. block
        </option>
        <option value="capitalizeW" title="Capitalize Each Word">
          Cap. Words
        </option>
        <option value="capitalizeS" title="Capitalize each sentence.">
          Cap. sentences
        </option>
      </HTMLSelect>
    </div>

    {/* ── Cleaning row ── */}
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#738694",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 6,
        }}
      >
        Clean content
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <HTMLSelect
          value={cleanMode}
          onChange={(e) => setCleanMode(e.target.value)}
          title="Clean content"
        >
          <option value="noChange">Syntax… (no change)</option>
          <option value="pageRefs">Remove page refs ([[…]], #tag)</option>
          <option value="blockRefs">Resolve block refs ((uid))</option>
          <option value="buttons">Remove buttons ({"{{…}}"})</option>
          <option value="all">All at once</option>
        </HTMLSelect>

        <HTMLSelect
          value={styleMode}
          onChange={(e) => setStyleMode(e.target.value)}
          title="Remove style formatting"
        >
          <option value="noChange">Style… (no change)</option>
          <option value="bold">Remove bold (**…**)</option>
          <option value="italic">Remove italic (__…__)</option>
          <option value="highlight">Remove highlight (^^…^^)</option>
          <option value="strikethrough">Remove strikethrough (~~…~~)</option>
          <option value="allStyles">Remove all styles</option>
        </HTMLSelect>

        <HTMLSelect
          value={aliasMode}
          onChange={(e) => setAliasMode(e.target.value)}
          title="Markdown alias [label](url)"
        >
          <option value="noChange">Alias… (no change)</option>
          <option value="keepAlias">Keep alias only</option>
          <option value="keepUrl">Keep URL only</option>
          <option value="aliasWithStar">Alias url as [*](url)</option>
          <option value="removeUrls">Remove bare URLs</option>
        </HTMLSelect>

        <HTMLSelect
          value={taskMode}
          onChange={(e) => setTaskMode(e.target.value)}
          title="Transform task markers ({{[[TODO]]}}, {{[[DONE]]}})"
        >
          <option value="noChange">Tasks… (no change)</option>
          <option value="parseRef" title="{{[[TODO]]}} → {{TODO}}">
            Parse reference
          </option>
          <option
            value="checkboxIcon"
            title="{{[[TODO]]}} → ☐ / {{[[DONE]]}} → ☑"
          >
            Checkbox icon (☐ / ☑)
          </option>
          <option
            value="markdown"
            title="{{[[TODO]]}} → [ ] / {{[[DONE]]}} → [x]"
          >
            Markdown ([ ] / [x])
          </option>
          <option value="removeTask">Remove task marker</option>
        </HTMLSelect>

        <Checkbox
          checked={removeBlank}
          onChange={(e) => setRemoveBlank(e.target.checked)}
          label="Remove blank blocks"
          title="Delete blocks that are empty (or whitespace-only) and have no children — applied last"
          style={{ marginBottom: 0, alignSelf: "center" }}
        />
      </div>
    </div>
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
  const [cleanMode, setCleanMode] = useState("noChange");
  const [styleMode, setStyleMode] = useState("noChange");
  const [aliasMode, setAliasMode] = useState("noChange");
  const [taskMode, setTaskMode] = useState("noChange");
  const [removeBlank, setRemoveBlank] = useState(false);

  const handleApply = () => {
    onApply(
      heading,
      alignment,
      view,
      caseChange,
      cleanMode,
      styleMode,
      aliasMode,
      taskMode,
      removeBlank,
    );
    setHeading("noChange");
    setAlignment("noChange");
    setView("noChange");
    setCaseChange("noChange");
    setCleanMode("noChange");
    setStyleMode("noChange");
    setAliasMode("noChange");
    setTaskMode("noChange");
    setRemoveBlank(false);
  };

  const nothingSelected =
    heading === "noChange" &&
    alignment === "noChange" &&
    view === "noChange" &&
    caseChange === "noChange" &&
    cleanMode === "noChange" &&
    styleMode === "noChange" &&
    aliasMode === "noChange" &&
    taskMode === "noChange" &&
    !removeBlank;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk formatting or cleaning of selected blocks"
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
          cleanMode={cleanMode}
          setCleanMode={setCleanMode}
          styleMode={styleMode}
          setStyleMode={setStyleMode}
          aliasMode={aliasMode}
          setAliasMode={setAliasMode}
          taskMode={taskMode}
          setTaskMode={setTaskMode}
          removeBlank={removeBlank}
          setRemoveBlank={setRemoveBlank}
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
