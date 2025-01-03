## v.9 (January 1st, 2025)

### New features:

- New command: "Extract bold text in selection or page"

### Fixes:

- command "Extract highlighted text in selection or page" works again
- Fixed broken features to display changed blocks after replacing them
- replacing matching string with a capture group was inserting "undefined" if matching string was at the beginning of a block
- Fixed option: "Extract only matching strings" instead of entire block

## v.8 (August 25th, 2024)

### New features:

- Bulk change of page names, supporting regex and simple page name search

### Fixes:

- Dialog box showing results has a scrollbar and fit better current window size

## v.6 (July 30th, 2023)

### Fixes:

- Search in Page, in not zoomed page, was broken
- text in quote AND in markdown formatting was not highlighted when searched

## v.5

### Fixes:

- Block => Page conversion was not copying the block children to the new page
- Page => Block conversion was broken

## v.4 (February 24th, 2023)

### Updates:

- hotkeys can be customized for almost all commands in command palette

### Fixes:

- F&R with multi-select is now properly working
- using placeholders ($Regex, or $1, $2) for Regex capture groups was broken

## v.3 (December 7th, 2022)

### New features:

- Added logic operators for search: full string / OR / AND / AND+ (experimental)
- Added Sentence capitalization in Bulk change format

### Fixes:

- search works now on daily note view (wall of DNP) and can find elements on multiple DNP

## v.2 (November 19th, 2022) MAJOR update

### New features:

- Search on page, highlighting matches (replace Ctrl+f native feature of Chrome, but introduce this feature lacking in Desktop version of Roam).
- Find & Replace: possibiliy to replace matches one by one or replace all
- Block <=> Page converter
- Change format in bulk: header, align, view and case.
- Highlight extraction
- 3 ways to see or backup the results of a search (on page or in graph): in plain text, in clipboard as block references or in the sidebar (in a dedicated page)

### Enhancements:

- Cleaner and (hopefully) better UI, with option to choose where is displayed the dialog box.
- Find & Replace: checkbox to match only words, to auto-expand collapsed blocks and to apply to workspace (linked references + sidebar)
- Better support of advanced usage of regular expressions, now you can extract capture groups. Examples provider in help panel are more useful.
- Auto-detect if blocks are selected (limited range) or not (range = whole page), when opening Find and Replace box.

# Settings change:

- The option to include block references or not in Find & Research has been removed, since you can now choose to replace matches one by one.
