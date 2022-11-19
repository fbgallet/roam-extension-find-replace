# Find & Replace, Search in page or graph, block <=> page converter and other bulk operations
 
 Way more than a simple Find & Replace, here a the main features currently available:
### - 🆕 [Search in page](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#---search-in-page) with an instant highlighting
### - 🆕 [Search in graph](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#---search-in-the-whole-graph) with plain text or block references extraction
### - [Find & Replace](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#--find--replace-or-in-the-whole-graph) in blocks selection, page, workspace or whole graph, with complete regex support.
### - 🆕 [Extract highlights](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#-extract-highlights-in-selection-or-page-command-in-the-command-palette-extract-only-the-highlighted-strings-and-add-an-alias-to-the-original-block) in selection or page, and other advanced extraction features.
### - 🆕 [Bulk change format](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#-bulk-change-format-of-selected-blocks-command) of selected blocks (header, alignment, view, case)
### - [Bulk append/prepend](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#-bulk-change-format-of-selected-blocks-command) strings, ie. at the beginning or/and at the end of a set of selected blocks.
### - 🆕 [Block <=> Page](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#-block--page-conversion) conversion, replacing in bulk their references.

### Update to v.2: november 18th 2022 [See changelog here for an overview of updates and new features](https://github.com/fbgallet/roam-extension-find-replace/blob/main/CHANGELOG.md) 🆕

### All the commands are available via the command palette (Cmd-Ctrl + P). Enter "Find & R..." and you will see all of them.

## - 🆕 Search in page

![F R - Search in page](https://user-images.githubusercontent.com/74436347/202797471-b43fd997-a8f3-4896-af20-29948961a7ed.png)

Press `Ctrl + S` open a search box similar to the brothers' search box usually called with Ctrl+F: the search results are instantly highlighted in the current page and and switching from one to the other automatically scrolls the display.

But this search box is specially designed for Roam Research since it detects the words hidden in the collapsed blocks and expands them automatically, by checking an option. The search can also be extended to the whole workspace, linked references and pages in the sidebar.

You can have a quick overview of the search results (including hidden blocks) by clicking `🔎︎` and copied in the clipboard as plain text (block references are resolved). Or you can copy the block references with '((📋))' and paste them anywhere in your graph.

The search engine support regular expressions, so that any kind of pattern can be found. See below for more details and examples.


## - 🆕 Search in the whole graph

![F R - Search in graph](https://user-images.githubusercontent.com/74436347/202821174-4167e496-bbc5-4d32-afaf-160701c260e2.png)

Open the global search box with `Find & Replace: Whole graph search` in the command Palette (just enter 'wg'). It provides very quickly an overview of the results, even in large amounts (like 2000 matches in 2 seconds), if you display them in plain text with `🔎︎`. Then you can easely open any of them in the right sidebar by pressing the `➕` at the end of each block. As with search in page, you can copy the results to clipboard, as plain text or as block references. You can also open them all in the sidebar with the button `🔎︎◨`
In option, search results can be sorted by page or page last edit date (the most recent first).


## - Find & Replace: or in the whole graph

### Find & Replace in selection, in page, in workspace
Replace a given string with another at once or step by step, thanks to the 🆕 highlighting feature.
The range of application depends on two factors:
- the range of selection: if you have selected a set of blocks (blue highlighted with mouse or Shift + Up or Down), only the selected blocks and their expanded children will be processed. If you are using the recent multiselect feature with checkboxes on the right (enabled with Ctrl + m), only checked blocks will be processed. Otherwise, the current page will be processed, including the linked references and the blocks or pages opened in the right sidebar if you click on 'workspace' option.
- the 'Include collapsed blocks' option (in the setting panel): if it's enabled, expanded AND collapsed blocks will be processed when clicking on 'Replace all' button. Otherwise, only the visible blocks will be processed. If you check 'Auto-expand blocks' option in the dialog box, collapsed blocks containing a matching string will be expanded and can be processed even if the former option is disabled.

Find & Replace can be used to remove some content in bulk: enter the content to remove in the Find field, and let the Replace field blank.
It can also be used to replace different writings of a word in a given alias. Suppose that you have written 'word', 'Word', 'words' and 'Words' in your graph and that you want to replace the last three by an alias to [[word]], e.g. `[Word]([[word]])`. You have just to write this regex in the find field: `/Words?|words/` and this in the replace field: `[$RegEx]([[word]])`.

### Find & Replace in whole Graph (Warning: danger zone!):

With great caution ⚠️, you can search and replace some string in the whole graph. Don't forget that a string can be a subset of another string that we haven't imagined. The operation can theoretically be undone (with the Undo command below, not with Cmd-Ctrl + Z), but only immediately, not after a graph reload or after other find and research operations, unless you click on 'display changed blocks in sidebar'. A warning message will request confirmation and indicate the number of blocks that will be modified.
For more safety, the new `🔎︎` feature allows you to have a quick overview of blocks that will be changed before doing it.

### `Find & Replace: Insert last changed blocks (references)` command:

After a Find & Replace operation, you can insert anywhere in your graph the list of changed blocks (as block references). It's also available in the 'Undo' popup after each operation: if you click on `Display changed blocks in sidebar`, the list of changed blocks will be inserted on the `[[roam/depot/find & replace]]` page, with date and timestamp.
In option, you can keep a copy of each changed block in its old state, and display a table that compares the blocks before and after the Find & Replace operation, to identify unintended changes and to have a backup of critical changes. Each old version is copied as a child block of the block reference of the new version - and is therefore easily accessible thought inline rerence counter.

### 🆕 `Extract highlights in selection or page` command in the command palette extract only the highlighted strings, and add an alias to the original block.

On the same principle, but for advanced users, it's possible to extract only strings matching the regular expression in the find field, accordingly to the pattern in the replace field.
If this option is enabled (in the setting panel), not the entire blocks but only the matching strings will be displayed in plain text with `🔎︎` or copied to the clipboard with '((📋))'. The replace field plays the rôle of a template with placeholders (`$RegEx` for the matching strings, `$1`, `$2` for capture groups).

### `Prepend or append content to selected blocks` command:

Insert some string (e.g. a tag) in bulk, at the beginning (prepend) or the end (append) of selected blocks. Only expanded blocks are concerned.

![image](https://user-images.githubusercontent.com/74436347/185461724-c32adb75-86cf-46c8-9335-f2c218d6d587.png)


### 🆕 `Bulk change format of selected blocks` command:

Apply a given header format to a selection of blocks, or justify the content (right,left,center), or change the view of the childre (bullets,numbers,document), or change the case of the text (all as Upper case, all as lower case (current limitation: only text before block reference or page reference) or capitalize the first letter of the block).


## 🆕 Block <=> Page conversion

Convert a given page in a block, and replace in bulk all its references in block references, or the opposite ! It's now as easy as a simple Find & Replace: enter the name of the page (or block reference), then enter a block reference where the page will be converted as the original block to witch all the references will linked (or a new page name).

If you run the `Convert this block => [[page]]` command from the contextual menu of a given block, the original block reference and the page name will be automatically completed. If you have a block reference like `((9jO7A7MwG))` or a page reference like `[[page]]` in the clipboard, and run one of the conversion command with the command palette, the corresponding fields will be auto-completed.

Since it's a quite dangerous operation, it will be safer to check the impacted blocks first, with the `🔎︎` button.


## About Regex support
Regular expressions are supported both in find and replace fields. Regular Expressions are an advanced user feature, you must learn and experiment with their logic before using it (you can [learn and test your formulas here](https://regexr.com/)) !
The most accessible feature is using the variable `$RegEx` as a placeholder for formating the replacement of matching strings:
In Replace field, you can insert `$RegEx` in the replacing string. E.g., to bold all matching strings, enter: `**$RegEx**`
There is 4 possible formating of the main variable (pay attention to upper and lower case letters):

- `$RegEx` leaves the machting string in its initial case. (R and second E are upper case)
- `$REGEX` capitalizes all letters.
- `$regex` set to lower case all letters.
- `$Regex` capitalize first letter.
Capture groups $1 and $2 can also be (multi-) used, assuming that the RegEx formula includes groups in parenthesis.

You can click on `?` button in Find & Replace dialog box to see these examples: 


Current limitations:
- limits of auto-expand blocks feature:
Auto-expand blocks in Search in page or Find & Replace doesn't works always properly. The API command to expand blocks doesn't seem to be 100% reliable when there is an important amount of indented blocks to open. You may have to click on refresh button `↻` until the counter indicates that there are no more words in a folded blocks. Anyway it's only a matter of block display: all matching words will be replaced if you click on 'Replace all'.

- limits of live highlight matches feature:
Text in code blocks are not highlighted. Likewise, if your search for strings including markdown syntax, it will not be highlighted. But in any case, the words will be correctly detected and replaced.

---

For any question or suggestion, DM me on Twitter: [@fbgallet](https://twitter.com/fbgallet) or Roam Slack.
