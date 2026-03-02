import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { subscribe, closePanel } from "../panelBridge";
import state from "../state";
import { FormatChangeBody } from "./FormatChangeDialog";
import HistoryPopover from "./HistoryPopover";
import {
  HISTORY_FIND,
  HISTORY_REPLACE,
  HISTORY_PREFIX_SUFFIX,
  addToHistory,
} from "../historyStorage";
import "./UnifiedSearchPanel.css";

const PANEL_WIDTH = 400;
const MARGIN = 20;

function clampPosition(x, y, panelHeight) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const h = panelHeight || 400; // fallback if element not yet measured
  return {
    x: Math.min(Math.max(x, MARGIN), W - PANEL_WIDTH - MARGIN),
    y: Math.min(Math.max(y, MARGIN), H - h - MARGIN),
  };
}

function getInitialPosition() {
  if (state.panelInitialXY) {
    // Clamp with fallback height — real height clamping happens after mount via effect
    return clampPosition(state.panelInitialXY.x, state.panelInitialXY.y);
  }
  // Default: top right
  return { x: window.innerWidth - PANEL_WIDTH - MARGIN, y: MARGIN + 40 };
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
  const [matchLabel, setMatchLabel] = useState("");

  // ── Pre/Append selection state ──
  // null = not yet checked; number = count from last check
  const [selectionCount, setSelectionCount] = useState(null);
  // Warning shown when user clicks "Blocks" scope but no selection found
  const [selectionWarning, setSelectionWarning] = useState(false);
  // Source of blocks for Pre/Append and Format tabs
  // "multiselect" | "page" | "searchResults"
  const [blockSource, setBlockSource] = useState("multiselect");
  // Whether the current count came from a pinned subset (state.frozenSearchSubset was set)
  const [isSearchSubset, setIsSearchSubset] = useState(false);

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

  // ── Format tab inputs ──
  const [fmtHeading, setFmtHeading] = useState("noChange");
  const [fmtAlignment, setFmtAlignment] = useState("noChange");
  const [fmtView, setFmtView] = useState("noChange");
  const [fmtCaseChange, setFmtCaseChange] = useState("noChange");
  const [fmtCleanMode, setFmtCleanMode] = useState("noChange");
  const [fmtStyleMode, setFmtStyleMode] = useState("noChange");
  const [fmtAliasMode, setFmtAliasMode] = useState("noChange");
  const [fmtTaskMode, setFmtTaskMode] = useState("noChange");
  const [fmtRemoveBlank, setFmtRemoveBlank] = useState(false);

  // ── Drag state ──
  const [position, setPosition] = useState(getInitialPosition);
  const dragOffset = useRef(null);
  const panelRef = useRef(null);

  // ── Clamp position after mount so the real panel height is known ──
  useEffect(() => {
    if (!panelRef.current) return;
    const h = panelRef.current.offsetHeight;
    setPosition((pos) => clampPosition(pos.x, pos.y, h));
  }, []);

  // ── Debounce ref ──
  const debounceRef = useRef(null);
  const inputChangesRef = useRef(0);

  // Track whether the panel was open on the previous notification
  const wasOpenRef = useRef(false);

  // Ref for the find input — used to auto-focus on open
  const findInputRef = useRef(null);

  // Stable ref so the subscribe callback can call checkSelection without stale closure
  const checkSelectionRef = useRef(null);

  // ── Auto-focus find input when panel opens on search/findReplace tabs ──
  useEffect(() => {
    if (isOpen && (mode === "search" || mode === "findReplace")) {
      // Small delay to let the DOM settle after conditional rendering
      setTimeout(() => findInputRef.current?.focus(), 50);
    }
  }, [isOpen, mode]);

  // ── Subscribe to bridge ──
  useEffect(() => {
    const unsub = subscribe((snapshot) => {
      const justOpened = snapshot.isOpen && !wasOpenRef.current;
      wasOpenRef.current = snapshot.isOpen;
      setIsOpen(snapshot.isOpen);

      if (justOpened) {
        // Re-clamp position in case the window was resized since last open
        setTimeout(() => {
          const h = panelRef.current?.offsetHeight;
          setPosition((pos) => clampPosition(pos.x, pos.y, h));
        }, 0);

        // Only sync inputs when the panel transitions closed → open
        const newMode = snapshot.mode ?? "search";
        const requestedScope = snapshot.scope ?? "page";
        setMode(newMode);
        setGraphSubMode(snapshot.graphSubMode ?? "search");
        setConversionDirection(snapshot.conversionDirection ?? "pageToBlock");
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
        // Always check selection on open; auto-activate "selection" scope if blocks found
        setSelectionCount(null);
        setTimeout(async () => {
          // Only probe multiselect for search/findReplace tabs (to auto-switch to selection scope).
          // For other tabs (format, appendPrepend…) the tab-open effect handles source detection independently.
          if (newMode === "search" || newMode === "findReplace") {
            const result = checkSelectionRef.current?.();
            const count = result instanceof Promise ? await result : result;
            if (count > 0) {
              setScope("selection");
              return;
            }
          }
          setScope(requestedScope);
        }, 0);
      }

      // matchLabel updates while the panel is open (from displayMatchCountInTitle)
      setMatchLabel(snapshot.matchLabel ?? "");
    });
    return unsub;
  }, []);

  // ── Selection check: used by both Pre/Append tab and "Blocks" scope ──
  // sourceOverride allows callers to force a specific source; otherwise uses current blockSource
  const checkSelection = useCallback(
    (sourceOverride) => {
      const src = sourceOverride ?? blockSource;
      const result = callbacks.onCheckSelectionForSource
        ? callbacks.onCheckSelectionForSource(src)
        : Promise.resolve(callbacks.onCheckSelection());
      Promise.resolve(result).then((count) => {
        setSelectionCount(count);
      });
      return result;
    },
    [callbacks, blockSource],
  );

  // Keep ref in sync so the subscribe callback (outside React render cycle) can call it
  checkSelectionRef.current = checkSelection;

  // Auto-check when switching to the Pre/Append or Format tab
  useEffect(() => {
    if (!isOpen || (mode !== "appendPrepend" && mode !== "format")) return;
    setSelectionCount(null);
    setIsSearchSubset(false);
    if (state.frozenSearchSubset !== null) {
      // Pinned search subset takes priority
      setIsSearchSubset(true);
      setBlockSource("searchResults");
      checkSelection("searchResults");
    } else if (scope === "selection") {
      // User was in Blocks scope — carry over multiselect directly
      setBlockSource("multiselect");
      checkSelection("multiselect");
    } else {
      // Probe multiselect first; fall back to page if nothing selected.
      // Use setTimeout to let React finish rendering before querying the DOM/API.
      setTimeout(async () => {
        const count = await callbacks.onCheckSelectionForSource("multiselect");
        if (count > 0) {
          setBlockSource("multiselect");
          setSelectionCount(count);
        } else {
          // No multiselect — default to page and count its blocks
          setBlockSource("page");
          const pageCount = await callbacks.onCheckSelectionForSource("page");
          setSelectionCount(pageCount);
        }
      }, 0);
    }
  }, [mode, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // When scope is set to "selection" (e.g. auto-detected on open), populate count
  // Note: manual Blocks button clicks are handled in handleScopeChange (async)
  useEffect(() => {
    if (isOpen && scope === "selection") {
      checkSelection("multiselect");
    }
  }, [scope, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [
    isOpen,
    findInput,
    replaceInput,
    caseInsensitive,
    wordOnly,
    expandToHighlight,
  ]);

  // ── Drag logic ──
  const onHeaderMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
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
        const h = panelRef.current?.offsetHeight;
        lastPos = clampPosition(lastPos.x, lastPos.y, h);
        setPosition(lastPos);
        state.panelInitialXY = lastPos;
        if (state.savePanelXY) state.savePanelXY(lastPos.x, lastPos.y);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [position],
  );

  // ── Handlers ──
  const handleFindChange = useCallback(
    (e) => {
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
          callbacks.onActualizeHighlights(
            value,
            caseInsensitive,
            wordOnly,
            expandToHighlight,
            searchLogic,
            scope,
          );
        }
      }, timeout);
    },
    [
      scope,
      caseInsensitive,
      wordOnly,
      expandToHighlight,
      searchLogic,
      callbacks,
    ],
  );

  const reHighlight = (fi, ci, wo, ex, sl) => {
    if (scope !== "graph" && scope !== "pageTitles" && fi.length > 1) {
      callbacks.onActualizeHighlights(fi, ci, wo, ex, sl, scope);
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
    callbacks.onRefresh(
      findInput,
      caseInsensitive,
      wordOnly,
      expandToHighlight,
      searchLogic,
      scope,
    );
  };

  const handleReplace = () => {
    addToHistory(callbacks.extensionAPI, HISTORY_FIND, findInput);
    addToHistory(callbacks.extensionAPI, HISTORY_REPLACE, replaceInput);
    callbacks.onReplace(
      findInput,
      replaceInput,
      caseInsensitive,
      wordOnly,
      searchLogic,
    );
  };

  const handleReplaceAll = () => {
    addToHistory(callbacks.extensionAPI, HISTORY_FIND, findInput);
    addToHistory(callbacks.extensionAPI, HISTORY_REPLACE, replaceInput);
    callbacks.onReplaceAll(
      findInput,
      replaceInput,
      caseInsensitive,
      wordOnly,
      searchLogic,
    );
    handleClose();
  };

  const handleDisplayResults = () => {
    addToHistory(callbacks.extensionAPI, HISTORY_FIND, findInput);
    if (mode === "findReplace")
      addToHistory(callbacks.extensionAPI, HISTORY_REPLACE, replaceInput);
    if (scope === "graph") {
      callbacks.onGraphDisplayResults(
        findInput,
        caseInsensitive,
        wordOnly,
        searchLogic,
        graphSubMode,
        mode === "findReplace" ? replaceInput : undefined,
        callbacks.onApplySearchSubset,
      );
    } else if (scope === "pageTitles") {
      callbacks.onPageTitlesDisplayResults(findInput, replaceInput);
    } else {
      callbacks.onDisplayResults(
        findInput,
        replaceInput,
        caseInsensitive,
        wordOnly,
        searchLogic,
        callbacks.onApplySearchSubset,
      );
    }
  };

  const handleDisplayResultsSidebar = () => {
    addToHistory(callbacks.extensionAPI, HISTORY_FIND, findInput);
    callbacks.onGraphDisplayResultsSidebar(
      findInput,
      caseInsensitive,
      wordOnly,
      searchLogic,
      graphSubMode,
    );
  };

  const handleCopyRefs = () => {
    addToHistory(callbacks.extensionAPI, HISTORY_FIND, findInput);
    if (scope === "graph") {
      callbacks.onGraphCopyRefs(
        findInput,
        replaceInput,
        caseInsensitive,
        wordOnly,
        searchLogic,
        graphSubMode,
      );
    } else {
      callbacks.onCopyRefs(
        findInput,
        replaceInput,
        caseInsensitive,
        searchLogic,
        mode,
      );
    }
  };

  const handleHelp = () => {
    callbacks.onHelp(scope === "graph" ? graphSubMode : mode);
  };

  const handleGraphReplace = () => {
    addToHistory(callbacks.extensionAPI, HISTORY_FIND, findInput);
    addToHistory(callbacks.extensionAPI, HISTORY_REPLACE, replaceInput);
    if (graphSubMode === "replace page names") {
      callbacks.onGraphReplacePageNames(findInput, replaceInput);
    } else {
      callbacks.onGraphReplace(
        findInput,
        replaceInput,
        caseInsensitive,
        wordOnly,
        searchLogic,
      );
    }
  };

  const handlePageTitlesReplace = () => {
    addToHistory(callbacks.extensionAPI, HISTORY_FIND, findInput);
    addToHistory(callbacks.extensionAPI, HISTORY_REPLACE, replaceInput);
    callbacks.onPageTitlesReplace(findInput, replaceInput);
    handleClose();
  };

  // Re-check count when user manually switches source in Pre/Append or Format tabs
  const handleSourceChange = useCallback(
    (src) => {
      setIsSearchSubset(false);
      if (src !== "multiselect") {
        // Leaving multiselect — drop frozen capture
        callbacks.onClearMultiselectCapture?.();
      }
      // When switching TO multiselect, keep any existing frozen capture intact so the
      // already-captured selection (from tab-open) is reused immediately without a DOM re-read.
      setBlockSource(src);
      setSelectionCount(null);
      checkSelection(src);
    },
    [callbacks, checkSelection],
  );

  // ── Large-scope confirmation ──
  // Require a second "Confirm?" click when operating on many blocks from search results
  const LARGE_SCOPE_THRESHOLD = 20;
  const isLargeScope =
    blockSource === "searchResults" && selectionCount > LARGE_SCOPE_THRESHOLD;
  const [applyPending, setApplyPending] = useState(false);

  // Cancel pending confirmation when source, count, or tab changes
  useEffect(() => {
    setApplyPending(false);
  }, [blockSource, selectionCount, mode]);

  const handleAppendPrepend = () => {
    if (!selectionCount) return;
    if (isLargeScope && !applyPending) {
      setApplyPending(true);
      return;
    }
    setApplyPending(false);
    addToHistory(callbacks.extensionAPI, HISTORY_PREFIX_SUFFIX, prefixInput);
    addToHistory(callbacks.extensionAPI, HISTORY_PREFIX_SUFFIX, suffixInput);
    callbacks.onAppendPrepend(prefixInput, suffixInput);
    handleClose();
  };

  const handleFormatApply = () => {
    if (!selectionCount) return;
    if (isLargeScope && !applyPending) {
      setApplyPending(true);
      return;
    }
    setApplyPending(false);
    callbacks.onFormatChange(
      fmtHeading,
      fmtAlignment,
      fmtView,
      fmtCaseChange,
      fmtCleanMode,
      fmtStyleMode,
      fmtAliasMode,
      fmtTaskMode,
      fmtRemoveBlank,
    );
    // Reset selects but keep panel open so user can apply more changes
    setFmtHeading("noChange");
    setFmtAlignment("noChange");
    setFmtView("noChange");
    setFmtCaseChange("noChange");
    setFmtCleanMode("noChange");
    setFmtStyleMode("noChange");
    setFmtAliasMode("noChange");
    setFmtTaskMode("noChange");
    setFmtRemoveBlank(false);
  };

  const handlePageBlockConvert = () => {
    addToHistory(callbacks.extensionAPI, HISTORY_FIND, findInput);
    addToHistory(callbacks.extensionAPI, HISTORY_REPLACE, replaceInput);
    if (conversionDirection === "pageToBlock") {
      callbacks.onPageToBlock(findInput, replaceInput, moveContent);
    } else {
      callbacks.onBlockToPage(findInput, replaceInput, moveContent);
    }
  };

  const handleClose = () => {
    if (mode === "findReplace") {
      callbacks.onFindReplaceClose(
        findInput,
        replaceInput,
        caseInsensitive,
        wordOnly,
        expandToHighlight,
        scope === "workspace",
      );
    } else if (mode === "search") {
      callbacks.onSearchClose(
        findInput,
        caseInsensitive,
        wordOnly,
        expandToHighlight,
        scope === "workspace",
      );
    } else {
      // appendPrepend / format / pageBlockConversion: clear frozen selection and any lingering highlights
      callbacks.onClearFrozenNodes?.();
      callbacks.onRemoveHighlights?.();
    }
    closePanel();
  };

  const handleScopeChange = async (newScope) => {
    setSelectionWarning(false);
    if (newScope === "workspace" || newScope === "page") {
      setScope(newScope);
      callbacks.onActualizeHighlights(
        findInput,
        caseInsensitive,
        wordOnly,
        expandToHighlight,
        searchLogic,
        newScope,
      );
    } else if (newScope === "selection") {
      setSelectionCount(null);
      // "Click again" while already in selection scope = force a fresh DOM read (new selection)
      if (scope === "selection") callbacks.onClearMultiselectCapture?.();
      const result = checkSelection("multiselect");
      const count = result instanceof Promise ? await result : result;
      if (count > 0) {
        setScope("selection");
        callbacks.onActualizeHighlights(
          findInput,
          caseInsensitive,
          wordOnly,
          expandToHighlight,
          searchLogic,
          "selection",
        );
      } else {
        // No selection found — show warning, revert to page scope
        setSelectionWarning(true);
        setScope("page");
      }
    } else {
      setScope(newScope);
    }
  };

  const handleTabChange = (newMode) => {
    setMode(newMode);
  };

  if (!isOpen) return null;

  // ── Derived display values ──
  const isGraphScope = scope === "graph";
  const isPageTitlesScope = scope === "pageTitles";
  const isSelectionScope = scope === "selection";
  const isFindReplaceMode = mode === "findReplace";
  const isAppendPrependTab = mode === "appendPrepend";
  const isFormatTab = mode === "format";
  const isPageBlockTab = mode === "pageBlockConversion";
  const isSearchOrReplace = mode === "search" || mode === "findReplace";

  const tabTitles = {
    search: "Search",
    findReplace: "Find & Replace",
    appendPrepend: "Prepend / Append to blocks",
    format: "Format selected blocks",
    pageBlockConversion: "Page ⟺ Block conversion",
  };
  const panelTitle = matchLabel || tabTitles[mode] || "Find & Replace";

  // ── Block-source status message for Pre/Append & Format tabs ──
  const hasSearchResults = state.matchArray.length > 0;
  const blockSourceStatusMsg =
    selectionCount === null
      ? "Checking…"
      : selectionCount > 0
        ? blockSource === "searchResults"
          ? isSearchSubset
            ? `✓ ${selectionCount} block${selectionCount > 1 ? "s" : ""} from selected results`
            : `✓ ${selectionCount} block${selectionCount > 1 ? "s" : ""} from search results`
          : blockSource === "page"
            ? `✓ ${selectionCount} block${selectionCount > 1 ? "s" : ""} on this page/view`
            : `✓ ${selectionCount} block${selectionCount > 1 ? "s" : ""} selected`
        : blockSource === "multiselect"
          ? "⚠ No blocks selected — select blocks then refresh"
          : blockSource === "page"
            ? "⚠ No blocks found on current page"
            : "⚠ No search results — run a search first";

  // Search logic options
  const logicOptions = [
    { value: "", label: "full str." },
    { value: "OR", label: "OR" },
  ];
  if (mode === "search") {
    logicOptions.push({ value: "AND", label: "AND" });
    if (!isGraphScope && scope !== "selection")
      logicOptions.push({ value: "AND+", label: "AND+1" });
  }

  // Placeholders for search/findReplace
  let findPlaceholder = "Find… (support /regex/g, help via ？)";
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

  const showCaseWord =
    isSearchOrReplace &&
    !(
      isGraphScope &&
      isFindReplaceMode &&
      graphSubMode === "replace page names"
    );
  const showDanger = isGraphScope && isFindReplaceMode;

  return (
    <div
      ref={panelRef}
      className="fr-panel bp3-elevation-2"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header / drag handle */}
      <div className="fr-panel-header" onMouseDown={onHeaderMouseDown}>
        <span className="fr-panel-header-label">{panelTitle}</span>
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
        <Tab id="format" title="Format" />
        <Tab id="pageBlockConversion" title="Page ⇔ Block" />
      </Tabs>

      {/* ── Append/Prepend tab ── */}
      {isAppendPrependTab && (
        <div className="fr-panel-body">
          {/* Source selector */}
          <div
            className="fr-panel-scope"
            style={{ marginBottom: 6, paddingTop: 0 }}
          >
            <ButtonGroup small>
              <Button
                small
                active={blockSource === "multiselect"}
                text="Multiselect"
                onClick={() => handleSourceChange("multiselect")}
              />
              <Button
                small
                active={blockSource === "page"}
                text="Main view"
                onClick={() => handleSourceChange("page")}
              />
              <Button
                small
                active={blockSource === "searchResults"}
                text="Search results"
                disabled={!hasSearchResults}
                onClick={() => handleSourceChange("searchResults")}
              />
            </ButtonGroup>
          </div>
          {/* Status row */}
          <div
            className={selectionCount ? "fr-panel-info" : "fr-panel-warning"}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ flex: 1 }}>{blockSourceStatusMsg}</span>
            {blockSource === "multiselect" && (
              <Tooltip content="Re-check selection" minimal>
                <Button
                  minimal
                  small
                  icon="refresh"
                  onClick={() => { callbacks.onClearMultiselectCapture?.(); checkSelection("multiselect"); }}
                  className="fr-btn-icon"
                />
              </Tooltip>
            )}
          </div>
          <div className="fr-panel-find-row">
            <InputGroup
              value={prefixInput}
              onChange={(e) => setPrefixInput(e.target.value)}
              placeholder="Text to prepend…"
              autoFocus
              fill
              rightElement={
                <HistoryPopover
                  storageKey={HISTORY_PREFIX_SUFFIX}
                  extensionAPI={callbacks.extensionAPI}
                  onSelect={(v) => setPrefixInput(v)}
                />
              }
            />
          </div>
          <div className="fr-panel-replace-row">
            <InputGroup
              value={suffixInput}
              onChange={(e) => setSuffixInput(e.target.value)}
              placeholder="Text to append…"
              fill
              rightElement={
                <HistoryPopover
                  storageKey={HISTORY_PREFIX_SUFFIX}
                  extensionAPI={callbacks.extensionAPI}
                  onSelect={(v) => setSuffixInput(v)}
                />
              }
            />
          </div>
          {isLargeScope && (
            <div className="fr-panel-danger" style={{ marginTop: 6 }}>
              ⚠ {selectionCount} blocks from search results — large scope, bulk
              change may be irreversible.
            </div>
          )}
          <div className="fr-panel-buttons">
            <Button
              small
              intent={applyPending ? "danger" : "primary"}
              text={
                applyPending ? `⚠ Confirm ${selectionCount} blocks?` : "Apply"
              }
              onClick={handleAppendPrepend}
              disabled={prefixInput === "" && suffixInput === ""}
            />
            {applyPending && (
              <Button
                small
                minimal
                text="Cancel"
                onClick={() => setApplyPending(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Format tab ── */}
      {isFormatTab && (
        <div className="fr-panel-body">
          {/* Source selector */}
          <div
            className="fr-panel-scope"
            style={{ marginBottom: 6, paddingTop: 0 }}
          >
            <ButtonGroup small>
              <Button
                small
                active={blockSource === "multiselect"}
                text="Multiselect"
                onClick={() => handleSourceChange("multiselect")}
              />
              <Button
                small
                active={blockSource === "page"}
                text="Main view"
                onClick={() => handleSourceChange("page")}
              />
              <Button
                small
                active={blockSource === "searchResults"}
                text="Search results"
                disabled={!hasSearchResults}
                onClick={() => handleSourceChange("searchResults")}
              />
            </ButtonGroup>
          </div>
          {/* Status row */}
          <div
            className={selectionCount ? "fr-panel-info" : "fr-panel-warning"}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ flex: 1 }}>{blockSourceStatusMsg}</span>
            {blockSource === "multiselect" && (
              <Tooltip content="Re-check selection" minimal>
                <Button
                  minimal
                  small
                  icon="refresh"
                  onClick={() => { callbacks.onClearMultiselectCapture?.(); checkSelection("multiselect"); }}
                  className="fr-btn-icon"
                />
              </Tooltip>
            )}
          </div>
          <div style={{ marginTop: 8 }}>
            <FormatChangeBody
              heading={fmtHeading}
              setHeading={setFmtHeading}
              alignment={fmtAlignment}
              setAlignment={setFmtAlignment}
              view={fmtView}
              setView={setFmtView}
              caseChange={fmtCaseChange}
              setCaseChange={setFmtCaseChange}
              cleanMode={fmtCleanMode}
              setCleanMode={setFmtCleanMode}
              styleMode={fmtStyleMode}
              setStyleMode={setFmtStyleMode}
              aliasMode={fmtAliasMode}
              setAliasMode={setFmtAliasMode}
              taskMode={fmtTaskMode}
              setTaskMode={setFmtTaskMode}
              removeBlank={fmtRemoveBlank}
              setRemoveBlank={setFmtRemoveBlank}
            />
          </div>
          {isLargeScope && (
            <div className="fr-panel-danger" style={{ marginTop: 6 }}>
              ⚠ {selectionCount} blocks from search results — large scope, bulk
              change may be irreversible.
            </div>
          )}
          <div className="fr-panel-buttons">
            <Button
              small
              intent={applyPending ? "danger" : "primary"}
              text={
                applyPending ? `⚠ Confirm ${selectionCount} blocks?` : "Apply"
              }
              onClick={handleFormatApply}
              disabled={
                !selectionCount ||
                (fmtHeading === "noChange" &&
                  fmtAlignment === "noChange" &&
                  fmtView === "noChange" &&
                  fmtCaseChange === "noChange" &&
                  fmtCleanMode === "noChange" &&
                  fmtStyleMode === "noChange" &&
                  fmtAliasMode === "noChange" &&
                  fmtTaskMode === "noChange" &&
                  !fmtRemoveBlank)
              }
            />
            {applyPending && (
              <Button
                small
                minimal
                text="Cancel"
                onClick={() => setApplyPending(false)}
              />
            )}
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
                onClick={() =>
                  callbacks.onPageBlockDisplayResults(
                    findInput,
                    replaceInput,
                    conversionDirection,
                    moveContent,
                    callbacks.onApplySearchSubset,
                  )
                }
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
                {
                  value: "selection",
                  label:
                    selectionCount > 0
                      ? `Blocks (${selectionCount})`
                      : "Blocks",
                  tooltip:
                    "Search within multiselected blocks (drag-select or Cmd+M). Click again to refresh the selection.",
                },
                {
                  value: "page",
                  label: "Main view",
                  tooltip: "Search in the currently open page or zoomed block",
                },
                {
                  value: "workspace",
                  label: "Workspace",
                  tooltip: "Search across main window and sidebar pages",
                },
                {
                  value: "graph",
                  label: "Graph",
                  tooltip: "Whole-graph search and replace",
                },
                {
                  value: "pageTitles",
                  label: "Page titles",
                  tooltip:
                    "Find and replace patterns in page titles across the graph",
                },
              ].map((s) => (
                <Tooltip key={s.value} content={s.tooltip} minimal>
                  <Button
                    small
                    active={scope === s.value}
                    text={s.label}
                    onClick={() => handleScopeChange(s.value)}
                  />
                </Tooltip>
              ))}
            </ButtonGroup>
          </div>
          {/* Warning when Blocks scope clicked but no selection found */}
          {selectionWarning && (
            <div className="fr-panel-warning" style={{ margin: "4px 10px 0" }}>
              ⚠ No blocks selected — drag-select or use Cmd+M, then click Blocks
              again.
            </div>
          )}

          {/* Body */}
          <div className="fr-panel-body">
            {/* Graph info/danger */}
            {isGraphScope && !showDanger && (
              <div className="fr-panel-info">
                🔎 to show results, 🔎◨ to open in sidebar, ((📋)) to copy block
                refs.
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
                inputRef={findInputRef}
                value={findInput}
                onChange={handleFindChange}
                placeholder={findPlaceholder}
                fill
                rightElement={
                  <HistoryPopover
                    storageKey={HISTORY_FIND}
                    extensionAPI={callbacks.extensionAPI}
                    onSelect={(v) => {
                      setFindInput(v);
                      if (
                        scope !== "graph" &&
                        scope !== "pageTitles" &&
                        v.length > 1
                      )
                        callbacks.onActualizeHighlights(
                          v,
                          caseInsensitive,
                          wordOnly,
                          expandToHighlight,
                          searchLogic,
                          scope,
                        );
                    }}
                  />
                }
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
                  rightElement={
                    <HistoryPopover
                      storageKey={HISTORY_REPLACE}
                      extensionAPI={callbacks.extensionAPI}
                      onSelect={(v) => setReplaceInput(v)}
                    />
                  }
                />
              </div>
            )}

            {/* Extra options */}
            <div className="fr-panel-extra-options">
              {!isGraphScope && !isPageTitlesScope && !isSelectionScope && (
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
                <Button
                  small
                  intent="danger"
                  text="Replace"
                  onClick={handleGraphReplace}
                />
              )}

              {/* Page titles scope: replace trigger */}
              {isPageTitlesScope && isFindReplaceMode && (
                <Button
                  small
                  intent="danger"
                  text="Replace"
                  onClick={handlePageTitlesReplace}
                />
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
                  text="？"
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
