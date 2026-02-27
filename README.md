# Find & Replace, Search box, block <=> page conversion, bulk operations

**Way more than a simple Find & Replace: a versatile and powerful tool for search supporting regex and bulk operations (update content following a given pattern, append, prepend, change format, bulk page titles change...).**

![F R v10 demo](https://github.com/user-attachments/assets/d76b6eee-1362-468c-809d-b0cbd72d2895)

### 🆕 in v.10 (February 2026):

- Complete overhaul of the UI: unified draggable panel with tabs for almost all features
- Input (search or replace strings) history and favorites
- Filter, sort and select matching blocks of search results or before applying Replace all
- View search result as raw text or rendered blocks
- Commands in context menu of multiselection, page reference and page title

### Available features:

- **[Search in page](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#---search-in-page) with an instant highlighting**
- **[Search in graph](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#---search-in-the-whole-graph) with plain text or block references extraction**
- **[Find & Replace](https://github.com/fbgallet/roam-extension-find-replace#--find--replace) either local, in blocks selection, page, workspace, or global, [in the whole graph](https://github.com/fbgallet/roam-extension-find-replace#find--replace-in-whole-graph-warning-danger-zone), with complete support of regular expressions.**
- **[Extract highlights or bold](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#-extract-highlights-in-selection-or-page-command-in-the-command-palette-extract-only-the-highlighted-strings-and-add-an-alias-to-the-original-block) in selection or page, and other advanced extraction features.**
- **[Block <=> Page](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#-block--page-conversion) conversion, replacing in bulk their references.**
- **[Bulk change format](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#-bulk-change-format-of-selected-blocks-command) of selected blocks (header, alignment, view, case)**
- **[Bulk append/prepend](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#-bulk-change-format-of-selected-blocks-command) strings, ie. at the beginning or/and at the end of a set of selected blocks.**
- **🆕 [Bulk change of page names](https://github.com/fbgallet/roam-extension-find-replace?tab=readme-ov-file#-bulk-change-of-page-names) or simple pages search, supporting Regex.**
- **[Full regular expressions support](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#full-regex-support)**

[See changelog here for an overview of updates and new features](https://github.com/fbgallet/roam-extension-find-replace/blob/main/CHANGELOG.md) \_\_

**💡 All the commands are available via the command palette (Cmd-Ctrl + P). Enter "Find & R..." and you will see all of them.**

## - Search in page

Press `Ctrl + S` to open a search box similar to the browsers' search box usually called with Ctrl+F: the search results are instantly highlighted in the current page and switching from one to the other automatically scrolls the display.

But this search box is specially designed for Roam Research since it detects the words hidden in the collapsed blocks and expands them automatically, by checking `Auto-expand blocks` option.

You can control the scope of the search, it ca be:

- extended to the whole workspace (including linked references and pages in the sidebar),
- or limited to a selection of blocks (by selecting them before opening the panel or, when opened, by selecting them and clicking on 'Blocks' scope)
- or only to page titles.

You can also specify a logic operator if you enter multiple words:

- by default (`full str.`), the whole string is searched,
- but you can search each word separated by a spaces with the `OR` operator (at least one word),
- or the `AND` operator (all words must be present in the block, in any order). `AND+` also includes first level children blocks.

You can have a quick overview of the search results (including hidden blocks) by clicking `🔎︎` and copied in the clipboard as plain text (block references are resolved) and filter/sort the results (see below).

You can copy the block references with '((📋))' and paste them anywhere in your graph.

The search engine support regular expressions, so that any kind of pattern can be found. [See below for more details and examples](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#about-regex-support).

## - Search in the whole graph

Set search scope to "Graph" (or run `Find & Replace: Whole graph search` in the command Palette (just enter 'wg')). Click on `🔎︎` to open a dialog displaying the matching blocks in plain text or rendered as editable Roam blocks.

### Results dialog

When you click `🔎︎`, matching blocks are displayed in a dedicated results dialog with the following features:

- **Two view modes**: _Text_ (raw content, instant) and _Rendered_ (full Roam rendering with links, embeds, formatting). Rendered mode uses lazy loading to avoid freezing the UI on large result sets, and paginates to 100 blocks per page with prev/next navigation.
- **Page path toggle** (rendered mode): show or hide the breadcrumb path above each block — toggled instantly via CSS, no re-rendering needed.
- **Sort**: by page name (alphabetical), by match count per page (descending), or by last edit date (most recent first). The date sort shows a flat list independent of page grouping.
- **Filter**: a live filter input narrows the displayed results by page name or block content.
- **Collapse/Expand**: page groups can be collapsed individually or all at once with a single button (not available in date sort mode).
- **Block selection**: each block has a checkbox; a footer "Select all / Deselect all" checkbox controls all visible blocks at once.
- **Open in sidebar**: selected blocks can be opened all at once in the right sidebar with the footer button.
- **Copy to clipboard**: the dialog's submit button copies all results as plain text (page names + resolved block content).

## - Find & Replace

### Find & Replace in selection, in page, in workspace

Replace a given string with another at once or step by step.

The range of application depends on two factors:

- the range of selection: if you have selected a set of blocks (blue highlighted with mouse or Shift + Up or Down), only the selected blocks and their expanded children will be processed. If you are using the recent multiselect feature with checkboxes on the right (enabled with Ctrl + m), only checked blocks will be processed. Otherwise, the current page will be processed, including the linked references and the blocks or pages opened in the right sidebar if you click on 'workspace' option.

- the 'Include collapsed blocks' option (in the setting panel): if it's enabled, expanded AND collapsed blocks will be processed when clicking on 'Replace all' button. Otherwise, only the visible blocks will be processed. If you check 'Auto-expand blocks' option in the dialog box, collapsed blocks containing a matching string will be expanded and can be processed even if the former option is disabled.

💡 Find & Replace can be used to remove some content in bulk: enter the content to remove in the Find field, and let the Replace field blank.
It can also be used to replace different writings of a word in a given alias. Suppose that you have written 'word', 'Word', 'words' and 'Words' in your graph and that you want to replace the last three by an alias to [[word]], e.g. `[Word]([[word]])`. You have just to write this regex in the find field: `/Words?|words/` and this in the replace field: `[$RegEx]([[word]])`.

### Find & Replace in whole Graph (Warning: danger zone!):

With great caution ⚠️, you can search and replace some string in the whole graph. Don't forget that a string can be a subset of another string that we haven't imagined. The operation can theoretically be undone (with the Undo command below, not with Cmd-Ctrl + Z), but only immediately, not after a graph reload or after other find and research operations, unless you click on 'display changed blocks in sidebar'. A warning message will request confirmation and indicate the number of blocks that will be modified.

For more safety, the `🔎︎` feature allows you to have a quick overview of blocks that will be changed before doing it. The results dialog (described above in the _Search in the whole graph_ section) is the same interactive component: you can filter, sort, switch between text and rendered view, select blocks, and open them in the sidebar before committing to any replacement.

### `Find & Replace: Insert last changed blocks (references)` command:

After a Find & Replace operation, you can insert anywhere in your graph the list of changed blocks (as block references). It's also available in the 'Undo' popup after each operation: if you click on `Display changed blocks in sidebar`, the list of changed blocks will be inserted on the `[[roam/depot/find & replace]]` page, with date and timestamp.

In option, you can keep a copy of each changed block in its old state, and display a table that compares the blocks before and after the Find & Replace operation, to identify unintended changes and to have a backup of critical changes. Each old version is copied as a child block of the block reference of the new version - and is therefore easily accessible thought inline rerence counter.

### `Extract highlights in selection or page` command in the command palette extract only the highlighted strings, and add an alias to the original block.

### `Extract bold text in selection or page` command

On the same principle, but for advanced users, it's possible to extract only strings matching the regular expression in the find field, accordingly to the pattern in the replace field.

If this option is enabled (in the setting panel), not the entire blocks but only the matching strings will be displayed in plain text with `🔎︎` or copied to the clipboard with '((📋))'. The replace field plays the role of a template with placeholders (`$RegEx` for the matching strings, `$1`, `$2` for capture groups).

## Block <=> Page conversion

<img width="408" height="280" alt="image" src="https://github.com/user-attachments/assets/2749259c-5a2e-471d-80c4-b78b23e6091e" />

Convert a given page in a block, and replace in bulk all its references in block references, or the opposite ! It's now as easy as a simple Find & Replace: enter the name of the page (or block reference), then enter a block reference where the page will be converted as the original block to witch all the references will linked (or a new page name).

Options:

- If you enter 'DNP' in the block reference field (or let it blank), the page will be converted in a new block created on the today's daily note page.
- If 'move source content' is checked, all the block in the page will be moved under the new block (or all the children of the block will be move in the new page).
- If you run the `Convert this block => [[page]]` command from the contextual menu of a given block, the original block reference and the page name will be automatically completed.
- If you have a block reference like `((9jO7A7MwG))` or a page reference like `[[page]]` in the clipboard, and run one of the conversion command with the command palette, the corresponding fields will be auto-completed.

Since it's a quite dangerous operation, it will be safer to check the impacted blocks first, with the `🔎︎` button.

The Page => Block conversion command is also available in page and page reference context menu: the corresponding page title will instantly be copied in the page input.

## `Bulk change format of selected blocks` command:

<img width="414" height="307" alt="image" src="https://github.com/user-attachments/assets/72f5237f-5a42-4e1e-a4c5-9b3ca125cb79" />

Apply to a selection of blocks (and only the visible ones), you can bulk change:

- the header level (1, 2 or 3)
- the alignment of the text (right, left, center, justify),
- the view of the children (bullets, numbers, document),
- the case of the text (all as Upper case, all as lower case, capitalize the first letter of the block or capitalize the first letter of each word or (🆕 new in v.3) capitalize each sentence - excluding page references, tags, attributs and block references, of course).

This command is also available in multiselect context menu.

## `Prepend or append content to selected blocks` command:

<img width="413" height="232" alt="image" src="https://github.com/user-attachments/assets/638988e3-2cc1-4425-80a9-86e080d7d897" />

Insert some string (e.g. a tag) in bulk, at the beginning (prepend) or the end (append) of selected blocks. Only expanded blocks are concerned.

This command is also available in multiselect context menu.

## 🆕 `Bulk change of [[page names]]`

![image](https://github.com/user-attachments/assets/2a37e734-3f43-425a-bff8-065c37008ac4)

Enter the pattern to change in multiple page names (it can be a simple string as `Project`) and the replacing string. Before any change in your graph, you will see the list of page names containing this pattern and have the possibility to select or unselect page names to update. You can easily copy this page list to the clipboard or display it in the right sidebar.

In the input field, you can enter a /regex/ to match more precisely some pattern (ex: `/(Project)/A.*`/`) (without escape character) will match 'Project' only if it has a namespace beginning by 'A'. 'Project' here is a capture group (by the use of parenthesis), so the replacing string will only replace this captured group. See next section for more detials on how Regex and placeholders for matching pattern or capture groups can be used.

## 🆕 Input history with favorites

All text inputs (find, replace, prepend, append) remember the last 10 strings you used. Click the history icon on the right side of any input to open a dropdown with your recent values — click any entry to instantly fill the input.

You can **favorite** any entry (⭐) to pin it permanently at the top of the list, immune to the 10-item rotation. Unfavoriting moves the entry back into the regular history. Individual entries can also be removed with ✕. History is stored persistently across sessions via the extension storage.

## Full Regex support

Regular Expressions (often abbreviated to regex) are a powerful system to express and match any form of character pattern you can imagine. The general idea is that a given regex allows to express several sequences of characters. For example, we have seen above that `/Words?|words/` allows to identify 'Word', 'Words' and 'words', but not 'word' (that we don't want to change). So with a single expression in the search field, you can find and modify different words in your graph simultaneously.

The syntax of regular expressions is very strict. Understanding the science behind them is not indispensable (it is a pure mathematical formalism), but you should learn the syntax and experiment with it before using it in Find & Replace (you can ask an LLM via Live AI to generate a regex for you and explainit, or [learn and test your formulas here](https://regexr.com/) or read [Learn regular expressions in about 55 minutes](https://qntm.org/re_en)), unless you restrict yourself to reproducing a few simple examples like the ones below. Be very cautious because their effects is not always easy to grasp and can have a dangerous impact on your data. Don't use regex if you don't know what you do.

The most accessible feature is using the variable `$RegEx` as a placeholder for formating the replacement of matching strings:
in Replace field, you can insert `$RegEx` in the replacing string. E.g., to bold all matching strings, enter: `**$RegEx**`
There is 4 possible formating of the main variable (pay attention to upper and lower case letters):

- `$RegEx` leaves the machting string in its initial case. (R and second E are upper case)
- `$REGEX` capitalizes all letters.
- `$regex` set to lower case all letters.
- `$Regex` capitalize first letter.

### Using capture groups

Search regex support currently 2 capture groups, that mean patterns between parentheses that can be reproduced in the replace string with the placeholders `$1` and `$2`.

You can click on `?` button in Find & Replace dialog box to see these examples:
Regex have to be written between `/`slashes`/` with simple `\` backslash before special character to escape. Flag for global search (/g) is always set by default, you doesn't need to mention it.

**In Find field:**

- `/words?/`, matches all 'word' (singular) or 'words' (plural) occurences,
- `/sk(y|ies)/`, matches all 'sky' (singular) or 'skies' (plural) occurences,
- `/cheese|cake/`, matches all 'cheese' OR 'cake',
- `/[A-Z]\w+/`, matches all words beginning with a capital letter,
- `/.*/` matches all text,
- `/\(\([^\)]{9}\)\)/` matches all block references,
- `/\[\[([^\[^\]]*)\]\]/` matches all page references (not nested) and capture page name,
- `/\[([^\]]*)\]\(\(\([^\)]{9}\)\)\)/` matches `[alias](((refs)))` and capture alias.

**In Replace field:**

- `$RegEx` is the placeholder corresponding to the machting strings (pay attention to the case),
- `$REGEX` capitalizes all letters of the mathcing strings,
- `$regex` set to lower case all letters,
- `$Regex` capitalize first letter,
- `[$RegEx]([[page]])` make each machting string as an alias of [[page]],
- `$1` replace each matching string (e.g. page references) by the first capture group (e.g. the page name),
- `**$1** n°$2` insert two capture groups in a new formated string (only 2 capture groups are supported)

### Current limitations:

- limits of live highlight on page feature:
  Text in code blocks are not highlighted. Likewise, if your search for strings including markdown syntax, or if the matching string is hidden by some markdown syntax (like the link in an alias), it will not be highlighted. A counter indicate how many strings can't be highlighted. You can see them with in plain text with the `🔎︎` button. But in any case, the words will be correctly detected and replaced.

- limits around the logic operators:
  The count of matching elements is not fully reliable with AND or AND+ operators. AND+ is not yet applied to the whole graph search, the algorithm must be optimized to give a result in a reasonable time.

---

## If you want to support my work

If you want to encourage me to develop further and enhance Find & Replace extension, you can [buy me a coffee ☕ here](https://buymeacoffee.com/fbgallet) or [sponsor me on Github](https://github.com/sponsors/fbgallet). Thanks in advance for your support! 🙏

For any question or suggestion, DM me on **X/Twitter** and follow me to be informed of updates and new extensions : [@fbgallet](https://x.com/fbgallet), or on Bluesky: [@fbgallet.bsky.social](https://bsky.app/profile/fbgallet.bsky.social)

Please report any issue [here](https://github.com/fbgallet/roam-extension-find-replace/issues).
