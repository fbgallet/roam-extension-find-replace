import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Button,
  Divider,
  Icon,
  Menu,
  MenuItem,
  Popover,
  Tooltip,
} from "@blueprintjs/core";
import {
  loadHistoryData,
  toggleFavorite,
  removeFromHistory,
} from "../historyStorage";

export default function HistoryPopover({ storageKey, extensionAPI, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(() =>
    loadHistoryData(extensionAPI, storageKey)
  );
  const triggerRef = useRef(null);

  const refresh = useCallback(() => {
    setData(loadHistoryData(extensionAPI, storageKey));
  }, [extensionAPI, storageKey]);

  const handleInteraction = useCallback(
    (nextOpen) => {
      if (nextOpen) refresh();
      setIsOpen(nextOpen);
    },
    [refresh]
  );

  // Close on Escape (without propagating to panel's close handler)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen]);

  // Close on click outside (reliable fallback for Blueprint portal in Roam's DOM)
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e) => {
      const popoverEl = document.querySelector(".fr-history-menu");
      const triggerEl = triggerRef.current;
      if (
        popoverEl && !popoverEl.contains(e.target) &&
        triggerEl && !triggerEl.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown, true);
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }, [isOpen]);

  const handleSelect = useCallback(
    (value) => {
      onSelect(value);
      setIsOpen(false);
    },
    [onSelect]
  );

  const handleToggleFavorite = useCallback(
    (e, value) => {
      e.stopPropagation();
      toggleFavorite(extensionAPI, storageKey, value);
      refresh();
    },
    [extensionAPI, storageKey, refresh]
  );

  const handleRemove = useCallback(
    (e, value) => {
      e.stopPropagation();
      removeFromHistory(extensionAPI, storageKey, value);
      refresh();
    },
    [extensionAPI, storageKey, refresh]
  );

  const isEmpty = data.favorites.length === 0 && data.history.length === 0;

  const menuContent = (
    <Menu className="fr-history-menu">
      {isEmpty && (
        <MenuItem disabled text="No history yet" className="fr-history-empty" />
      )}

      {data.favorites.map((value) => (
        <MenuItem
          key={"fav-" + value}
          text={
            <span className="fr-history-item-text" title={value}>
              {value}
            </span>
          }
          icon={<Icon icon="star" className="fr-history-star-icon" />}
          labelElement={
            <span className="fr-history-actions">
              <Button
                icon="star-empty"
                minimal
                small
                title="Unfavorite"
                onClick={(e) => handleToggleFavorite(e, value)}
                className="fr-history-action-btn"
              />
              <Button
                icon="cross"
                minimal
                small
                title="Remove"
                onClick={(e) => handleRemove(e, value)}
                className="fr-history-action-btn"
              />
            </span>
          }
          onClick={() => handleSelect(value)}
          className="fr-history-menu-item fr-history-favorite"
        />
      ))}

      {data.favorites.length > 0 && data.history.length > 0 && (
        <Divider />
      )}

      {data.history.map((value) => (
        <MenuItem
          key={"hist-" + value}
          text={
            <span className="fr-history-item-text" title={value}>
              {value}
            </span>
          }
          labelElement={
            <span className="fr-history-actions">
              <Button
                icon="star-empty"
                minimal
                small
                title="Add to favorites"
                onClick={(e) => handleToggleFavorite(e, value)}
                className="fr-history-action-btn"
              />
              <Button
                icon="cross"
                minimal
                small
                title="Remove"
                onClick={(e) => handleRemove(e, value)}
                className="fr-history-action-btn"
              />
            </span>
          }
          onClick={() => handleSelect(value)}
          className="fr-history-menu-item"
        />
      ))}
    </Menu>
  );

  return (
    <span ref={triggerRef}>
      <Popover
        content={menuContent}
        placement="bottom-end"
        isOpen={isOpen}
        onInteraction={handleInteraction}
        minimal
      >
        <Tooltip content="Recent values" minimal>
          <Button
            icon="history"
            minimal
            small
            className="fr-history-trigger-btn"
          />
        </Tooltip>
      </Popover>
    </span>
  );
}
