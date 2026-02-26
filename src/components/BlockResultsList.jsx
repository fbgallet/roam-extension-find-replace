import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  InputGroup,
  Button,
  ButtonGroup,
  Tag,
  Icon,
  Checkbox,
} from "@blueprintjs/core";
import { getPageNameByPageUid, resolveReferences } from "../utils";
import state from "../state";

// Fetch edit time for a block uid via Roam API
function getBlockEditTime(uid) {
  const r = window.roamAlphaAPI.data.pull("[:edit/time]", [":block/uid", uid]);
  return r ? r[":edit/time"] : 0;
}

const ROAM_PAGE_SIZE = 100;

// ── RoamRenderedBlock ────────────────────────────────────────────────
// Renders a block lazily via IntersectionObserver on first enter.
// Always renders with zoom-path?:true; path visibility is toggled via CSS.
function RoamRenderedBlock({ uid, scrollRoot }) {
  const elRef = useRef(null);
  const visibleRef = useRef(false);
  const [, forceRender] = useState(0);

  // Step 1: observe visibility — fires renderBlock once when block first enters view
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !visibleRef.current) {
          visibleRef.current = true;
          forceRender((n) => n + 1);
          observer.disconnect();
        }
      },
      { root: scrollRoot || null, rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  // Step 2: render once when block first becomes visible
  useEffect(() => {
    if (!visibleRef.current || !elRef.current) return;
    elRef.current.innerHTML = "";
    window.roamAlphaAPI.ui.components.renderBlock({
      uid,
      el: elRef.current,
      "open?": false,
      "zoom-path?": true,
    });
    return () => { if (elRef.current) elRef.current.innerHTML = ""; };
  }, [visibleRef.current, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={elRef}
      className="block-rendered-view"
      style={visibleRef.current ? undefined : { minHeight: "1.5em" }}
    />
  );
}

const BlockResultsList = ({
  treeArray,
  promptParameters,
  isMatchesOnly,
  onHighlight,
  onHighlightAll,
  onReplaceSelected,
}) => {
  const [filterText, setFilterText] = useState("");
  const [sortBy, setSortBy] = useState("page"); // "page" | "count" | "date"
  const [collapsedPages, setCollapsedPages] = useState(new Set());
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [renderMode, setRenderMode] = useState("text"); // "text" | "roam"
  const [showPath, setShowPath] = useState(true);
  // selectedBlocks: Set of block uids
  const [selectedBlocks, setSelectedBlocks] = useState(null); // null = not initialized yet
  const [roamPage, setRoamPage] = useState(0); // pagination index for rendered mode
  const containerRef = useRef(null);

  // Reset rendered-mode pagination when sort, filter, or mode changes
  useEffect(() => { setRoamPage(0); }, [sortBy, filterText, renderMode]);

  // Highlight param derived once
  const highlightParam = useMemo(() => {
    if (!promptParameters || isMatchesOnly) return null;
    let p = promptParameters[0];
    if (promptParameters.length >= 3 && promptParameters[2] === "AND")
      p = p.or;
    return p;
  }, [promptParameters, isMatchesOnly]);

  // Build enriched tree with display strings and edit times
  const enrichedTree = useMemo(() => {
    return treeArray.map((group) => ({
      ...group,
      pageName: getPageNameByPageUid(group.page),
      blocks: group.blocks.map((block) => {
        let display = (block.content ?? "") + "\n";
        if (display.includes("```")) {
          display = display.substring(0, state.codeBlockLimit) + " (...)";
        } else {
          display = resolveReferences(display, [block.uid]);
        }
        const editTime = getBlockEditTime(block.uid);
        return { ...block, display, editTime };
      }),
    }));
  }, [treeArray]);

  // Initialize all blocks as selected on first render
  useEffect(() => {
    if (selectedBlocks === null && enrichedTree.length > 0) {
      const allUids = new Set(
        enrichedTree.flatMap((g) => g.blocks.map((b) => b.uid))
      );
      setSelectedBlocks(allUids);
    }
  }, [enrichedTree, selectedBlocks]);

  // Build textToCopy from enrichedTree (all blocks, not just selected)
  useEffect(() => {
    let text = "";
    enrichedTree.forEach((group) => {
      const pageMention = "[[" + group.pageName + "]]";
      text += pageMention + "\n";
      group.blocks.forEach((block) => {
        if (!block.content?.includes("```")) {
          text += "  - " + block.display + "\n";
        }
      });
    });
    state.textToCopy = text;
  }, [enrichedTree]);

  // Filter
  const filteredTree = useMemo(() => {
    if (!filterText) return enrichedTree;
    const lower = filterText.toLowerCase();
    return enrichedTree
      .map((group) => {
        const matchesPageName = group.pageName.toLowerCase().includes(lower);
        if (matchesPageName) return group;
        const filteredBlocks = group.blocks.filter((b) =>
          b.display.toLowerCase().includes(lower)
        );
        if (filteredBlocks.length === 0) return null;
        return { ...group, blocks: filteredBlocks };
      })
      .filter(Boolean);
  }, [enrichedTree, filterText]);

  // Sort: grouped modes ("page", "count") vs flat date mode
  const sortedTree = useMemo(() => {
    const arr = [...filteredTree];
    if (sortBy === "count") {
      arr.sort((a, b) => b.blocks.length - a.blocks.length);
    } else {
      // "page": sort groups by page name alphabetically (groupMatchesByPage sorts by uid, not name)
      arr.sort((a, b) => a.pageName.localeCompare(b.pageName));
    }
    return arr;
  }, [filteredTree, sortBy]);

  // Flat list for date sort: all blocks merged, sorted by editTime desc, with pageName attached
  const flatDateList = useMemo(() => {
    if (sortBy !== "date") return null;
    return filteredTree
      .flatMap((group) =>
        group.blocks.map((block) => ({ ...block, pageName: group.pageName }))
      )
      .sort((a, b) => b.editTime - a.editTime);
  }, [filteredTree, sortBy]);

  // Counts
  const totalBlocks = useMemo(
    () => enrichedTree.reduce((sum, g) => sum + g.blocks.length, 0),
    [enrichedTree]
  );
  const visibleBlocks = useMemo(
    () => flatDateList ? flatDateList.length : sortedTree.reduce((sum, g) => sum + g.blocks.length, 0),
    [sortedTree, flatDateList]
  );

  // Paginated views for rendered mode (text mode shows all)
  const roamPageStart = roamPage * ROAM_PAGE_SIZE;
  const pagedFlatDateList = useMemo(() => {
    if (!flatDateList || renderMode !== "roam") return flatDateList;
    return flatDateList.slice(roamPageStart, roamPageStart + ROAM_PAGE_SIZE);
  }, [flatDateList, renderMode, roamPageStart]);

  const pagedSortedTree = useMemo(() => {
    if (renderMode !== "roam") return sortedTree;
    let remaining = ROAM_PAGE_SIZE;
    let skip = roamPageStart;
    const result = [];
    for (const group of sortedTree) {
      if (skip >= group.blocks.length) { skip -= group.blocks.length; continue; }
      const sliced = group.blocks.slice(skip, skip + remaining);
      skip = 0;
      result.push({ ...group, blocks: sliced });
      remaining -= sliced.length;
      if (remaining <= 0) break;
    }
    return result;
  }, [sortedTree, renderMode, roamPageStart]);

  const roamTotalPages = useMemo(
    () => renderMode !== "roam" ? 1 : Math.ceil(visibleBlocks / ROAM_PAGE_SIZE),
    [renderMode, visibleBlocks]
  );

  // Highlight text-mode results after each render (sort, filter, collapse change)
  useEffect(() => {
    if (renderMode !== "text" || !containerRef.current || !highlightParam)
      return;
    const contentEls = containerRef.current.querySelectorAll(
      ".block-results-blocks li .block-results-content"
    );
    for (const el of contentEls) {
      if (el.firstChild) onHighlight && onHighlight(el.firstChild, highlightParam);
    }
    onHighlightAll && onHighlightAll(true);
  }, [sortedTree, collapsedPages, renderMode, highlightParam, onHighlight, onHighlightAll]);

  // Highlight rendered-mode results — renderBlock is async so wait for DOM
  useEffect(() => {
    if (renderMode !== "roam" || !highlightParam) return;
    const timer = setTimeout(() => {
      onHighlightAll && onHighlightAll(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [sortedTree, collapsedPages, renderMode, showPath, highlightParam, onHighlightAll]);

  // Toggle page collapse
  const togglePage = useCallback((pageUid) => {
    setCollapsedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageUid)) next.delete(pageUid);
      else next.add(pageUid);
      return next;
    });
  }, []);

  // Toggle all collapsed
  const toggleAll = useCallback(() => {
    if (allCollapsed) {
      setCollapsedPages(new Set());
      setAllCollapsed(false);
    } else {
      setCollapsedPages(new Set(enrichedTree.map((g) => g.page)));
      setAllCollapsed(true);
    }
  }, [allCollapsed, enrichedTree]);

  // Selection helpers
  const allVisibleUids = useMemo(
    () => flatDateList ? flatDateList.map((b) => b.uid) : sortedTree.flatMap((g) => g.blocks.map((b) => b.uid)),
    [sortedTree, flatDateList]
  );
  const allSelected = useMemo(
    () =>
      selectedBlocks !== null &&
      allVisibleUids.length > 0 &&
      allVisibleUids.every((uid) => selectedBlocks.has(uid)),
    [selectedBlocks, allVisibleUids]
  );
  const someSelected = useMemo(
    () =>
      selectedBlocks !== null &&
      allVisibleUids.some((uid) => selectedBlocks.has(uid)),
    [selectedBlocks, allVisibleUids]
  );

  const toggleBlock = useCallback((uid) => {
    setSelectedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const toggleAllSelection = useCallback(() => {
    if (allSelected) {
      setSelectedBlocks((prev) => {
        const next = new Set(prev);
        allVisibleUids.forEach((uid) => next.delete(uid));
        return next;
      });
    } else {
      setSelectedBlocks((prev) => {
        const next = new Set(prev);
        allVisibleUids.forEach((uid) => next.add(uid));
        return next;
      });
    }
  }, [allSelected, allVisibleUids]);

  // Open selected blocks in sidebar
  const openSelectedInSidebar = useCallback(() => {
    if (!selectedBlocks) return;
    allVisibleUids.forEach((uid) => {
      if (selectedBlocks.has(uid)) {
        window.roamAlphaAPI.ui.rightSidebar.addWindow({
          window: { type: "block", "block-uid": uid },
        });
      }
    });
  }, [selectedBlocks, allVisibleUids]);

  const selectedCount = useMemo(
    () =>
      selectedBlocks
        ? allVisibleUids.filter((u) => selectedBlocks.has(u)).length
        : 0,
    [selectedBlocks, allVisibleUids]
  );

  return (
    <div className="block-list">
      {/* Toolbar — outside scroll area */}
      <div className="block-results-toolbar">
        <InputGroup
          small
          leftIcon="filter"
          placeholder="Filter results..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <ButtonGroup minimal>
          <Button
            small
            icon="sort-alphabetical"
            title="Sort by page name"
            active={sortBy === "page"}
            onClick={() => setSortBy("page")}
          />
          <Button
            small
            icon="sort-numerical-desc"
            title="Sort by match count"
            active={sortBy === "count"}
            onClick={() => setSortBy("count")}
          />
          <Button
            small
            icon="time"
            title="Sort by edit date (most recent first)"
            active={sortBy === "date"}
            onClick={() => setSortBy("date")}
          />
        </ButtonGroup>
        <ButtonGroup minimal className="block-results-view-toggle">
          <Button
            small
            text="Text"
            title="Raw text view"
            active={renderMode === "text"}
            onClick={() => setRenderMode("text")}
          />
          <Button
            small
            text="Rendered"
            title="Rendered Roam view"
            active={renderMode === "roam"}
            onClick={() => setRenderMode("roam")}
          />
          {renderMode === "roam" && (
            <Button
              small
              icon="map-marker"
              title={showPath ? "Hide page path" : "Show page path"}
              active={showPath}
              onClick={() => setShowPath((v) => !v)}
            />
          )}
        </ButtonGroup>
        {sortBy !== "date" && (
          <Button
            small
            minimal
            icon={allCollapsed ? "expand-all" : "collapse-all"}
            title={allCollapsed ? "Expand all" : "Collapse all"}
            onClick={toggleAll}
          />
        )}
      </div>

      {/* Scrollable results area */}
      <div className={`block-results-scroll${!showPath ? " hide-block-path" : ""}`} ref={containerRef}>
        {/* Summary */}
        <div className="block-results-summary">
          {filterText
            ? `Showing ${visibleBlocks} of ${totalBlocks} blocks across ${flatDateList ? filteredTree.length : sortedTree.length} pages`
            : `${totalBlocks} blocks across ${enrichedTree.length} pages`}
        </div>

        {/* Pagination nav (rendered mode only, when needed) */}
        {renderMode === "roam" && roamTotalPages > 1 && (
          <div className="block-results-pagination">
            <Button
              small
              minimal
              icon="chevron-left"
              disabled={roamPage === 0}
              onClick={() => { setRoamPage((p) => p - 1); containerRef.current?.scrollTo(0, 0); }}
            />
            <span>{roamPageStart + 1}–{Math.min(roamPageStart + ROAM_PAGE_SIZE, visibleBlocks)} of {visibleBlocks}</span>
            <Button
              small
              minimal
              icon="chevron-right"
              disabled={roamPage >= roamTotalPages - 1}
              onClick={() => { setRoamPage((p) => p + 1); containerRef.current?.scrollTo(0, 0); }}
            />
          </div>
        )}

        {/* Results — flat list for date sort, grouped for page/count */}
        {(() => {
          const displayFlat = flatDateList
            ? (renderMode === "roam" ? pagedFlatDateList : flatDateList)
            : null;
          const displayTree = !flatDateList
            ? (renderMode === "roam" ? pagedSortedTree : sortedTree)
            : null;

          if (displayFlat) return (
            <ul className={`block-results-blocks${renderMode === "text" ? " text-mode" : ""}`}>
              {displayFlat.map((block) => (
                <li key={block.uid}>
                  <span className="block-results-content">
                    {renderMode === "roam" ? (
                      <RoamRenderedBlock uid={block.uid} scrollRoot={containerRef.current} />
                    ) : (
                      <>
                        <span className="block-results-inline-page">{"[[" + block.pageName + "]]"}</span>
                        {" " + block.display}
                      </>
                    )}
                  </span>
                  <Checkbox
                    className="block-results-checkbox"
                    checked={selectedBlocks ? selectedBlocks.has(block.uid) : true}
                    onChange={() => toggleBlock(block.uid)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </li>
              ))}
            </ul>
          );

          return displayTree.map((group) => {
            const isCollapsed = collapsedPages.has(group.page);
            const pageMention = "[[" + group.pageName + "]]";
            return (
              <div className="block-results-page-group" key={group.page}>
                <div
                  className="block-results-page-header"
                  onClick={() => togglePage(group.page)}
                >
                  <Icon
                    icon={isCollapsed ? "chevron-right" : "chevron-down"}
                    size={12}
                  />
                  <span>{pageMention}</span>
                  <Tag minimal round small>
                    {group.blocks.length}
                  </Tag>
                </div>
                {!isCollapsed && (
                  <ul className={`block-results-blocks${renderMode === "text" ? " text-mode" : ""}`}>
                    {group.blocks.map((block) => (
                      <li key={block.uid}>
                        <span className="block-results-content">
                          {renderMode === "roam" ? (
                            <RoamRenderedBlock uid={block.uid} scrollRoot={containerRef.current} />
                          ) : (
                            block.display
                          )}
                        </span>
                        <Checkbox
                          className="block-results-checkbox"
                          checked={selectedBlocks ? selectedBlocks.has(block.uid) : true}
                          onChange={() => toggleBlock(block.uid)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          });
        })()}
      </div>{/* end .block-results-scroll */}

      {/* Footer — outside scroll area, always visible */}
      <div className="block-results-footer">
        <Checkbox
          className="block-results-select-all"
          checked={allSelected}
          indeterminate={!allSelected && someSelected}
          onChange={toggleAllSelection}
          label={
            allSelected
              ? "Deselect all"
              : someSelected
              ? `${selectedCount} selected`
              : "Select all"
          }
        />
        <button
          className="block-results-sidebar-btn"
          disabled={selectedCount === 0}
          onClick={openSelectedInSidebar}
          title="Open selected blocks in right sidebar"
        >
          <Icon icon="panel-stats" size={12} />
          {` Open ${selectedCount} in sidebar`}
        </button>
        {onReplaceSelected && (
          <button
            className="block-results-replace-btn"
            disabled={selectedCount === 0}
            onClick={() => onReplaceSelected(
              selectedBlocks ? allVisibleUids.filter((u) => selectedBlocks.has(u)) : []
            )}
            title="Replace only selected blocks"
          >
            Replace {selectedCount} selected
          </button>
        )}
      </div>
    </div>
  );
};

export default BlockResultsList;
