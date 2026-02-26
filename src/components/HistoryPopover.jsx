import React, { useState, useCallback } from "react";
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

  const refresh = useCallback(() => {
    setData(loadHistoryData(extensionAPI, storageKey));
  }, [extensionAPI, storageKey]);

  const handleOpen = useCallback(() => {
    refresh();
    setIsOpen(true);
  }, [refresh]);

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
    <Popover
      content={menuContent}
      placement="bottom-end"
      isOpen={isOpen}
      onInteraction={(nextOpen) => {
        if (!nextOpen) setIsOpen(false);
      }}
      minimal
    >
      <Tooltip content="Recent values" minimal>
        <Button
          icon="history"
          minimal
          small
          onClick={handleOpen}
          className="fr-history-trigger-btn"
        />
      </Tooltip>
    </Popover>
  );
}
