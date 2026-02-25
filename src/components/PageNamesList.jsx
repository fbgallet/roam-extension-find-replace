import React, { useState, useEffect, useCallback } from "react";
import { Checkbox } from "@blueprintjs/core";
import state from "../state";

const PageNamesList = ({ matchArray, find, replace, replaceFunc }) => {
  const [selectedItems, setSelectedItems] = useState(() => [...matchArray]);

  // Keep state.submitParams in sync with selection
  useEffect(() => {
    state.submitParams = [selectedItems];
  }, [selectedItems]);

  const allSelected = selectedItems.length === matchArray.length;
  const someSelected = selectedItems.length > 0 && !allSelected;

  const toggleItem = useCallback((item) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedItems(allSelected ? [] : [...matchArray]);
  }, [allSelected, matchArray]);

  return (
    <div className="page-list">
      <Checkbox
        checked={allSelected}
        indeterminate={someSelected}
        onChange={toggleAll}
        label={allSelected ? "Deselect all" : "Select all"}
        className="select-all-pages"
      />
      <ul>
        {matchArray.map((match, i) => (
          <li key={match.title || i}>
            <Checkbox
              checked={selectedItems.includes(match)}
              onChange={() => toggleItem(match)}
              className="page-checkbox"
              label={
                "[[" +
                match.title +
                "]] \u27A1\uFE0E [[" +
                replaceFunc(match.title, find, replace) +
                "]]"
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PageNamesList;
