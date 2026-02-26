import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  Button,
  ButtonGroup,
  Checkbox,
  HTMLSelect,
  InputGroup,
  Tab,
  Tabs,
  Tooltip,
} from "@blueprintjs/core";
import { subscribe, closePanel, updatePanelField, getPanelState } from "../panelBridge";
import state from "../state";
import "./UnifiedSearchPanel.css";

const PANEL_WIDTH = 400;
const PANEL_HEIGHT_APPROX = 200; // conservative estimate for bottom/center presets
const MARGIN = 20;

function getPositionFromPreset(preset) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  switch (preset) {
    case "top left":    return { x: MARGIN, y: MARGIN + 40 };
    case "top right":   return { x: W - PANEL_WIDTH - MARGIN, y: MARGIN + 40 };
    case "bottom left": return { x: MARGIN, y: H - PANEL_HEIGHT_APPROX - MARGIN };
    case "bottom right":return { x: W - PANEL_WIDTH - MARGIN, y: H - PANEL_HEIGHT_APPROX - MARGIN };
    case "center":      return { x: (W - PANEL_WIDTH) / 2, y: (H - PANEL_HEIGHT_APPROX) / 2 };
    case "center left": return { x: MARGIN, y: (H - PANEL_HEIGHT_APPROX) / 2 };
    case "center right":return { x: W - PANEL_WIDTH - MARGIN, y: (H - PANEL_HEIGHT_APPROX) / 2 };
    default:            return { x: W - PANEL_WIDTH - MARGIN, y: MARGIN + 40 };
  }
}

function getInitialPosition() {
  if (state.panelInitialXY) return state.panelInitialXY;
  return getPositionFromPreset(state.panelPosition ?? "top right");
}

/**
 * UnifiedSearchPanel
 *
 * Props: callbacks object injected from index.js
 * {
 *   // Search/FindReplace (page / workspace / graph / pageTitles scopes)
 *   onActualizeHighlights(findInput, caseInsensitive, wordOnly, expand, searchLogic)
 *   onHighlightNext(shift)
 *   onReplace(findInput, replaceInput, caseInsensitive, wordOnly, searchLogic)
 *   onReplaceAll(findInput, replaceInput, caseInsensitive, wordOnly, searchLogic)
 *   onDisplayResults(promptParams, findInput)
 *   onCopyRefs(findInput, replaceInput, caseInsensitive, searchLogic, mode)
 *   onHelp(mode)
 *   onRefresh(findInput, caseInsensitive, wordOnly, expand, searchLogic)
 *   // Graph-specific
 *   onGraphSearch(findInput, caseInsensitive, wordOnly, searchLogic)
 *   onGraphReplace(findInput, replaceInput, caseInsensitive, wordOnly, searchLogic)
 *   onGraphReplacePageNames(findInput, replaceInput)
 *   onGraphDisplayResults(findInput, caseInsensitive, wordOnly, searchLogic, graphSubMode)
 *   onGraphDisplayResultsSidebar(findInput, caseInsensitive, wordOnly, searchLogic, graphSubMode)
 *   onGraphCopyRefs(findInput, replaceInput, caseInsensitive, wordOnly, searchLogic, graphSubMode)
 *   // Page titles scope
 *   onPageTitlesReplace(findInput, replaceInput)
 *   onPageTitlesDisplayResults(findInput, replaceInput)
 *   // Append/Prepend tab
 *   onAppendPrepend(prefix, suffix)
 *   // Page⇔Block conversion tab
 *   onPageToBlock(findInput, replaceInput, moveContent)
 *   onBlockToPage(findInput, replaceInput, moveContent)
 *   // Lifecycle
 *   onClose(findInput, replaceInput, caseInsensitive, wordOnly, expand, workspace)
 * }
 */
const UnifiedSearchPanel = ({ callbacks }) => {
  // ── Bridge state ──
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState("page");
  const [mode, setMode] = useState("search");
  const [graphSubMode, setGraphSubMode] = useState("search");
  const [conversionDirection, setConversionDirection] = useState("pageToBlock");
  const [label, setLabel] = useState("");
  const [matchLabel, setMatchLabel] = useState("");

  // ── Pre/Append selection state ──
  // null = not yet checked; number = count from last check
  const [selectionCount, setSelectionCount] = useState(null);

  // ── Input state ──
  const [findInput, setFindInput] = useState("");
  const [replaceInput, setReplaceInput] = useState("");
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [wordOnly, setWordOnly] = useState(false);
  const [expandToHighlight, setExpandToHighlight] = useState(false);
  const [moveContent, setMoveContent] = useState(false);
  const [searchLogic, setSearchLogic] = useState("");

  // ── Append/Prepend tab inputs ──
  const [prefixInput, setPrefixInput] = useState("");
  const [suffixInput, setSuffixInput] = useState("");

  // ── Drag state ──
  const [position, setPosition] = useState(getInitialPosition);
  const dragOffset = useRef(null);

  // ── Debounce ref ──
  const debounceRef = useRef(null);
  const inputChangesRef = useRef(0);

  // Track whether the panel was open on the previous notification
  const wasOpenRef = useRef(false);

  // Stable ref so the subscribe callback can call checkSelection without stale closure
  const checkSelectionRef = useRef(null);

  // ── Subscribe to bridge ──
  useEffect(() => {
    const unsub = subscribe((snapshot) => {
      const justOpened = snapshot.isOpen && !wasOpenRef.current;
      wasOpenRef.current = snapshot.isOpen;
      setIsOpen(snapshot.isOpen);

      if (justOpened) {
        // Only sync inputs when the panel transitions closed → open
        const newMode = snapshot.mode ?? "search";
        setScope(snapshot.scope ?? "page");
        setMode(newMode);
        setGraphSubMode(snapshot.graphSubMode ?? "search");
        setConversionDirection(snapshot.conversionDirection ?? "pageToBlock");
        setLabel(snapshot.label ?? "");
        setFindInput(snapshot.findInput ?? "");
        setReplaceInput(snapshot.replaceInput ?? "");
        setCaseInsensitive(snapshot.caseInsensitive ?? false);
        setWordOnly(snapshot.wordOnly ?? false);
        setExpandToHighlight(snapshot.expandToHighlight ?? false);
        setMoveContent(snapshot.moveContent ?? false);
        setSearchLogic(snapshot.searchLogic ?? "");
        // Reset pre/append inputs on each open
        setPrefixInput("");
        setSuffixInput("");
        // Auto-check selection when opening directly on the Pre/Append tab
        if (newMode === "appendPrepend") {
          setSelectionCount(null);
          // Defer so the panel renders first, then fires the check
          setTimeout(() => checkSelectionRef.current?.(), 0);
        }
      }

      // matchLabel updates while the panel is open (from displayMatchCountInTitle)
      setMatchLabel(snapshot.matchLabel ?? "");
    });
    return unsub;
  }, []);

  // ── Pre/Append: check selection via both Roam APIs ──
  const checkSelection = useCallback(() => {
    const count = callbacks.onCheckSelection();
    setSelectionCount(count);
  }, [callbacks]);

  // Keep ref in sync so the subscribe callback can call it
  checkSelectionRef.current = checkSelection;

  // Auto-check when switching to the Pre/Append tab
  useEffect(() => {
    if (isOpen && mode === "appendPrepend") {
      setSelectionCount(null);
      checkSelection();
    }
  }, [mode, isOpen]);

  // ── Keyboard arrow listener (page/workspace scope, search/findReplace tabs only) ──
  useEffect(() => {
    if (!isOpen || scope === "graph" || scope === "pageTitles") return;
    if (mode !== "search" && mode !== "findReplace") return;
    const onKeyArrows = (e) => {
      if (!isOpen) return;
      if (e.key === "ArrowDown" && e.ctrlKey) {
        e.preventDefault();
        handleHighlightNext(1);
      } else if (e.key === "ArrowUp" && e.ctrlKey) {
        e.preventDefault();
        handleHighlightNext(-1);
      }
    };
    window.addEventListener("keydown", onKeyArrows);
    return () => window.removeEventListener("keydown", onKeyArrows);
  }, [isOpen, scope, mode]);

  // ── ESC to close ──
  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isOpen, findInput, replaceInput, caseInsensitive, wordOnly, expandToHighlight]);

  // ── Drag logic ──
  const onHeaderMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    let lastPos = { x: position.x, y: position.y };
    const onMouseMove = (e) => {
      if (!dragOffset.current) return;
      lastPos = {
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      };
      setPosition(lastPos);
    };
    const onMouseUp = () => {
      dragOffset.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      state.panelInitialXY = lastPos;
      if (state.savePanelXY) state.savePanelXY(lastPos.x, lastPos.y);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [position]);

  // ── Handlers ──
  const handleFindChange = useCallback((e) => {
    const value = e.target.value;
    setFindInput(value);
    if (scope === "graph" || scope === "pageTitles") return;

    clearTimeout(debounceRef.current);
    inputChangesRef.current++;
    const capturedChange = inputChangesRef.current;
    const len = value.length;
    const timeout = len > 2 ? 100 : 800;

    debounceRef.current = setTimeout(() => {
      if (inputChangesRef.current !== capturedChange) return;
      if (len > 1) {
        inputChangesRef.current++;
        callbacks.onActualizeHighlights(value, caseInsensitive, wordOnly, expandToHighlight, searchLogic);
      }
    }, timeout);
  }, [scope, caseInsensitive, wordOnly, expandToHighlight, searchLogic, callbacks]);

  const reHighlight = (fi, ci, wo, ex, sl) => {
    if (scope !== "graph" && scope !== "pageTitles" && fi.length > 1) {
      callbacks.onActualizeHighlights(fi, ci, wo, ex, sl);
    }
  };

  const handleCaseChange = (e) => {
    const v = e.target.checked;
    setCaseInsensitive(v);
    reHighlight(findInput, v, wordOnly, expandToHighlight, searchLogic);
  };

  const handleWordChange = (e) => {
    const v = e.target.checked;
    setWordOnly(v);
    reHighlight(findInput, caseInsensitive, v, expandToHighlight, searchLogic);
  };

  const handleLogicChange = (e) => {
    const v = e.target.value;
    setSearchLogic(v);
    reHighlight(findInput, caseInsensitive, wordOnly, expandToHighlight, v);
  };

  const handleExpandChange = (e) => {
    const v = e.target.checked;
    setExpandToHighlight(v);
    reHighlight(findInput, caseInsensitive, wordOnly, v, searchLogic);
  };

  const handleHighlightNext = (shift) => {
    callbacks.onHighlightNext(shift);
  };

  const handleRefresh = () => {
    callbacks.onRefresh(findInput, caseInsensitive, wordOnly, expandToHighlight, searchLogic);
  };

  const handleReplace = () => {
    callbacks.onReplace(findInput, replaceInput, caseInsensitive, wordOnly, searchLogic);
  };

  const handleReplaceAll = () => {
    callbacks.onReplaceAll(findInput, replaceInput, caseInsensitive, wordOnly, searchLogic);
    handleClose();
  };

  const handleDisplayResults = () => {
    if (scope === "graph") {
      callbacks.onGraphDisplayResults(findInput, caseInsensitive, wordOnly, searchLogic, graphSubMode, mode === "findReplace" ? replaceInput : undefined);
    } else if (scope === "pageTitles") {
      callbacks.onPageTitlesDisplayResults(findInput, replaceInput);
    } else {
      callbacks.onDisplayResults(findInput, replaceInput, caseInsensitive, wordOnly, searchLogic);
    }
  };

  const handleDisplayResultsSidebar = () => {
    callbacks.onGraphDisplayResultsSidebar(findInput, caseInsensitive, wordOnly, searchLogic, graphSubMode);
  };

  const handleCopyRefs = () => {
    if (scope === "graph") {
      callbacks.onGraphCopyRefs(findInput, replaceInput, caseInsensitive, wordOnly, searchLogic, graphSubMode);
    } else {
      callbacks.onCopyRefs(findInput, replaceInput, caseInsensitive, searchLogic, mode);
    }
  };

  const handleHelp = () => {
    callbacks.onHelp(scope === "graph" ? graphSubMode : mode);
  };

  const handleGraphReplace = () => {
    if (graphSubMode === "replace page names") {
      callbacks.onGraphReplacePageNames(findInput, replaceInput);
    } else {
      callbacks.onGraphReplace(findInput, replaceInput, caseInsensitive, wordOnly, searchLogic);
    }
  };

  const handlePageTitlesReplace = () => {
    callbacks.onPageTitlesReplace(findInput, replaceInput);
    handleClose();
  };

  const handleAppendPrepend = () => {
    // Re-check selection at apply time in case user selected after opening
    const count = callbacks.onCheckSelection();
    setSelectionCount(count);
    if (!count) return;
    callbacks.onAppendPrepend(prefixInput, suffixInput);
    handleClose();
  };

  const handlePageBlockConvert = () => {
    if (conversionDirection === "pageToBlock") {
      callbacks.onPageToBlock(findInput, replaceInput, moveContent);
    } else {
      callbacks.onBlockToPage(findInput, replaceInput, moveContent);
    }
  };

  const handleClose = () => {
    if (mode === "findReplace") {
      callbacks.onFindReplaceClose(findInput, replaceInput, caseInsensitive, wordOnly, expandToHighlight, scope === "workspace");
    } else if (mode === "search") {
      callbacks.onSearchClose(findInput, caseInsensitive, wordOnly, expandToHighlight, scope === "workspace");
    }
    closePanel();
  };

  const handleScopeChange = (newScope) => {
    setScope(newScope);
    if (newScope === "workspace" || newScope === "page") {
      callbacks.onActualizeHighlights(findInput, caseInsensitive, wordOnly, expandToHighlight, searchLogic);
    }
  };

  const handleTabChange = (newMode) => {
    setMode(newMode);
  };

  if (!isOpen) return null;

  // ── Derived display values ──
  const isGraphScope = scope === "graph";
  const isPageTitlesScope = scope === "pageTitles";
  const isFindReplaceMode = mode === "findReplace";
  const isAppendPrependTab = mode === "appendPrepend";
  const isPageBlockTab = mode === "pageBlockConversion";
  const isSearchOrReplace = mode === "search" || mode === "findReplace";

  // Search logic options
  const logicOptions = [
    { value: "", label: "full str." },
    { value: "OR", label: "OR" },
  ];
  if (mode === "search") {
    logicOptions.push({ value: "AND", label: "AND" });
    if (!isGraphScope) logicOptions.push({ value: "AND+", label: "AND+1" });
  }

  // Placeholders for search/findReplace
  let findPlaceholder = "Find… (support /regex/g, help via ❔)";
  let replacePlaceholder = "Replace by… blank=delete, $RegEx=match";
  if (isGraphScope && isFindReplaceMode) {
    if (graphSubMode === "replace page names") {
      findPlaceholder = "Pattern as string or /regex(capture gr.)/";
      replacePlaceholder = "String replacing pattern or capture group";
    }
  }
  if (isPageTitlesScope) {
    findPlaceholder = "Pattern in page titles (string or /regex/)";
    replacePlaceholder = "Replace page title pattern";
  }

  // Placeholders for Page⇔Block tab
  const convIsPageToBlock = conversionDirection === "pageToBlock";
  const pageBlockFindPlaceholder = convIsPageToBlock
    ? "Page name: [[page]] or page"
    : "Source block reference: ((uid)) or uid";
  const pageBlockReplacePlaceholder = convIsPageToBlock
    ? "Block ref: ((uid)) or uid, or DNP"
    : "Target page name: [[page]] or page";

  const showCaseWord = isSearchOrReplace && !(isGraphScope && isFindReplaceMode && graphSubMode === "replace page names");
  const showDanger = isGraphScope && isFindReplaceMode;

  return (
    <div
      className="fr-panel bp3-elevation-2"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header / drag handle */}
      <div className="fr-panel-header" onMouseDown={onHeaderMouseDown}>
        <span className="fr-panel-header-label">
          {matchLabel || label || "Find & Replace"}
        </span>
        <Tooltip content="Close (Esc)" minimal>
          <Button
            minimal
            small
            icon="cross"
            onClick={handleClose}
            style={{ flexShrink: 0 }}
          />
        </Tooltip>
      </div>

      {/* Tabs */}
      <Tabs
        id="fr-panel-tabs"
        selectedTabId={mode}
        onChange={handleTabChange}
        animate={false}
      >
        <Tab id="search" title="Search" />
        <Tab id="findReplace" title="Find & Replace" />
        <Tab id="appendPrepend" title="Pre/Append" />
        <Tab id="pageBlockConversion" title="Page ⇔ Block" />
      </Tabs>

      {/* ── Append/Prepend tab ── */}
      {isAppendPrependTab && (
        <div className="fr-panel-body">
          {/* Selection status row */}
          <div className={selectionCount ? "fr-panel-info" : "fr-panel-warning"} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ flex: 1 }}>
              {selectionCount === null
                ? "Checking selection…"
                : selectionCount > 0
                  ? `✓ ${selectionCount} block${selectionCount > 1 ? "s" : ""} selected`
                  : "⚠ No blocks selected — select blocks now, then refresh"}
            </span>
            <Tooltip content="Re-check selection" minimal>
              <Button
                minimal
                small
                icon="refresh"
                onClick={checkSelection}
                className="fr-btn-icon"
              />
            </Tooltip>
          </div>
          <div className="fr-panel-find-row">
            <InputGroup
              value={prefixInput}
              onChange={(e) => setPrefixInput(e.target.value)}
              placeholder="Text to prepend…"
              autoFocus
              fill
            />
          </div>
          <div className="fr-panel-replace-row">
            <InputGroup
              value={suffixInput}
              onChange={(e) => setSuffixInput(e.target.value)}
              placeholder="Text to append…"
              fill
            />
          </div>
          <div className="fr-panel-buttons">
            <Button
              small
              intent="primary"
              text="Apply"
              onClick={handleAppendPrepend}
              disabled={prefixInput === "" && suffixInput === ""}
            />
          </div>
        </div>
      )}

      {/* ── Page ⇔ Block conversion tab ── */}
      {isPageBlockTab && (
        <div className="fr-panel-body">
          <div className="fr-panel-danger">
            ⚠ Danger zone! Check affected blocks first via 🔎.
          </div>
          {/* Direction selector */}
          <div className="fr-panel-scope" style={{ marginBottom: 6 }}>
            <ButtonGroup>
              <Button
                small
                active={conversionDirection === "pageToBlock"}
                text="Page → Block"
                onClick={() => setConversionDirection("pageToBlock")}
              />
              <Button
                small
                active={conversionDirection === "blockToPage"}
                text="Block → Page"
                onClick={() => setConversionDirection("blockToPage")}
              />
            </ButtonGroup>
          </div>
          <div className="fr-panel-find-row">
            <InputGroup
              value={findInput}
              onChange={(e) => setFindInput(e.target.value)}
              placeholder={pageBlockFindPlaceholder}
              fill
            />
          </div>
          <div className="fr-panel-replace-row">
            <InputGroup
              value={replaceInput}
              onChange={(e) => setReplaceInput(e.target.value)}
              placeholder={pageBlockReplacePlaceholder}
              fill
            />
          </div>
          <div className="fr-panel-extra-options">
            <Checkbox
              label="Move source content"
              checked={moveContent}
              onChange={(e) => setMoveContent(e.target.checked)}
              title="Move all child blocks to the target block or page"
            />
          </div>
          <div className="fr-panel-buttons">
            <Tooltip content="Show results in plain text dialog" minimal>
              <Button
                minimal
                small
                text="🔎"
                onClick={() => callbacks.onPageBlockDisplayResults(findInput, replaceInput, conversionDirection, moveContent)}
                className="fr-btn-icon"
              />
            </Tooltip>
            <Button
              small
              intent="danger"
              text="Convert"
              onClick={handlePageBlockConvert}
            />
          </div>
        </div>
      )}

      {/* ── Search / Find & Replace tabs ── */}
      {isSearchOrReplace && (
        <>
          {/* Scope selector */}
          <div className="fr-panel-scope">
            <ButtonGroup>
              {[
                { value: "page", label: "Main view" },
                { value: "workspace", label: "Workspace" },
                { value: "graph", label: "Graph" },
                { value: "pageTitles", label: "Page titles" },
              ].map((s) => (
                <Button
                  key={s.value}
                  small
                  active={scope === s.value}
                  text={s.label}
                  onClick={() => handleScopeChange(s.value)}
                />
              ))}
            </ButtonGroup>
          </div>

          {/* Body */}
          <div className="fr-panel-body">
            {/* Graph info/danger */}
            {isGraphScope && !showDanger && (
              <div className="fr-panel-info">
                🔎 to show results, 🔎◨ to open in sidebar, ((📋)) to copy block refs.
              </div>
            )}
            {showDanger && (
              <div className="fr-panel-danger">
                ⚠ Danger zone! Check affected blocks first via 🔎.
              </div>
            )}

            {/* Options row */}
            <div className="fr-panel-options">
              {showCaseWord && (
                <>
                  <Checkbox
                    label="Case insensitive"
                    checked={caseInsensitive}
                    onChange={handleCaseChange}
                    title="Take case into account or not to test matching words"
                  />
                  <Checkbox
                    label="Only words"
                    checked={wordOnly}
                    onChange={handleWordChange}
                    title="Match only entire words, not part of words"
                  />
                </>
              )}
              {!isPageTitlesScope && (
                <HTMLSelect
                  value={searchLogic}
                  onChange={handleLogicChange}
                  title="Search logic"
                >
                  {logicOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </HTMLSelect>
              )}
            </div>

            {/* Find input */}
            <div className="fr-panel-find-row">
              <InputGroup
                value={findInput}
                onChange={handleFindChange}
                placeholder={findPlaceholder}
                autoFocus={false}
                fill
              />
              <Tooltip content="Refresh search" minimal>
                <Button
                  minimal
                  small
                  icon="refresh"
                  onClick={handleRefresh}
                  className="fr-btn-icon"
                />
              </Tooltip>
            </div>

            {/* Replace input */}
            {isFindReplaceMode && (
              <div className="fr-panel-replace-row">
                <InputGroup
                  value={replaceInput}
                  onChange={(e) => setReplaceInput(e.target.value)}
                  placeholder={replacePlaceholder}
                  autoFocus={false}
                  fill
                />
              </div>
            )}

            {/* Extra options */}
            <div className="fr-panel-extra-options">
              {!isGraphScope && !isPageTitlesScope && (
                <Checkbox
                  label="Auto-expand blocks"
                  checked={expandToHighlight}
                  onChange={handleExpandChange}
                  title="Expand collapsed blocks with matching strings"
                />
              )}
            </div>

            {/* Action buttons */}
            <div className="fr-panel-buttons">
              {/* Page / Workspace scope navigation + replace */}
              {!isGraphScope && !isPageTitlesScope && (
                <>
                  <Tooltip content="Previous match (Ctrl+↑)" minimal>
                    <Button
                      minimal
                      small
                      icon="arrow-up"
                      onClick={() => handleHighlightNext(-1)}
                      className="fr-btn-icon"
                    />
                  </Tooltip>
                  <Tooltip content="Next match (Ctrl+↓)" minimal>
                    <Button
                      minimal
                      small
                      icon="arrow-down"
                      onClick={() => handleHighlightNext(1)}
                      className="fr-btn-icon"
                    />
                  </Tooltip>
                  {isFindReplaceMode && (
                    <>
                      <Button small text="Replace" onClick={handleReplace} />
                      <Button
                        small
                        intent="primary"
                        text="Replace all"
                        onClick={handleReplaceAll}
                      />
                    </>
                  )}
                </>
              )}

              {/* Graph scope: replace trigger */}
              {isGraphScope && isFindReplaceMode && (
                <Button small intent="danger" text="Replace" onClick={handleGraphReplace} />
              )}

              {/* Page titles scope: replace trigger */}
              {isPageTitlesScope && isFindReplaceMode && (
                <Button small intent="danger" text="Replace" onClick={handlePageTitlesReplace} />
              )}

              {/* Shared buttons */}
              <Tooltip content="Show results in plain text dialog" minimal>
                <Button
                  minimal
                  small
                  text="🔎"
                  onClick={handleDisplayResults}
                  className="fr-btn-icon"
                />
              </Tooltip>

              {isGraphScope && (
                <Tooltip content="Open results in sidebar" minimal>
                  <Button
                    minimal
                    small
                    text="🔎◨"
                    onClick={handleDisplayResultsSidebar}
                    className="fr-btn-icon"
                  />
                </Tooltip>
              )}

              {!isPageTitlesScope && (
                <Tooltip content="Copy block refs to clipboard" minimal>
                  <Button
                    minimal
                    small
                    text="((📋))"
                    onClick={handleCopyRefs}
                    className="fr-btn-icon"
                  />
                </Tooltip>
              )}

              <Tooltip content="Help: regex examples" minimal>
                <Button
                  minimal
                  small
                  text="❔"
                  onClick={handleHelp}
                  className="fr-btn-icon"
                />
              </Tooltip>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UnifiedSearchPanel;
