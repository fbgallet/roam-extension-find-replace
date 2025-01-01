# Find & Replace, Search box, block <=> page conversion, bulk operations

![F R gif demo 2](https://user-images.githubusercontent.com/74436347/206271356-ef6d6085-8280-4b53-a622-bed4e733dcd9.gif)

**Way more than a simple Find & Replace, a versatile tool for search and bulk operations:**

### 🆕 in v.9: Extract bold text

### 🆕 in v.8: Bulk change of [[page names]]

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

![F R - Search in page](https://user-images.githubusercontent.com/74436347/202797471-b43fd997-a8f3-4896-af20-29948961a7ed.png)

Press `Ctrl + S` to open a search box similar to the browsers' search box usually called with Ctrl+F: the search results are instantly highlighted in the current page and switching from one to the other automatically scrolls the display.

But this search box is specially designed for Roam Research since it detects the words hidden in the collapsed blocks and expands them automatically, by checking an option. The search can also be extended to the whole workspace, linked references and pages in the sidebar.

You can also specify a logic operator if you enter multiple words: by default, the whole string is searched, but you can search each word separated by a spaces with the OR operator (at least one word) or the AND operator (all words must be present in the block, in any order). AND+ is an experimental feature, it's like AND but it includes first level children blocks.

You can have a quick overview of the search results (including hidden blocks) by clicking `🔎︎` and copied in the clipboard as plain text (block references are resolved). Or you can copy the block references with '((📋))' and paste them anywhere in your graph.

The search engine support regular expressions, so that any kind of pattern can be found. [See below for more details and examples](https://github.com/fbgallet/roam-extension-find-replace/blob/main/README.md#about-regex-support).

## - Search in the whole graph

![F R - Search in graph](https://user-images.githubusercontent.com/74436347/202821174-4167e496-bbc5-4d32-afaf-160701c260e2.png)

Open the global search box with `Find & Replace: Whole graph search` in the command Palette (just enter 'wg'). It provides very quickly an overview of the results, even in large amounts (like 2000 matches in 2 seconds), if you display them in plain text with `🔎︎`. Then you can easely open any of them in the right sidebar by pressing the `➕` at the end of each block. As with search in page, you can copy the results to clipboard, as plain text or as block references. You can also open them all in the sidebar with the button `🔎︎◨`

In option, search results can be sorted by page or page last edit date (the most recent first).

## - Find & Replace

### Find & Replace in selection, in page, in workspace

Replace a given string with another at once or step by step, thanks to the 🆕 highlighting feature.

The range of application depends on two factors:

- the range of selection: if you have selected a set of blocks (blue highlighted with mouse or Shift + Up or Down), only the selected blocks and their expanded children will be processed. If you are using the recent multiselect feature with checkboxes on the right (enabled with Ctrl + m), only checked blocks will be processed. Otherwise, the current page will be processed, including the linked references and the blocks or pages opened in the right sidebar if you click on 'workspace' option.

- the 'Include collapsed blocks' option (in the setting panel): if it's enabled, expanded AND collapsed blocks will be processed when clicking on 'Replace all' button. Otherwise, only the visible blocks will be processed. If you check 'Auto-expand blocks' option in the dialog box, collapsed blocks containing a matching string will be expanded and can be processed even if the former option is disabled.

💡 Find & Replace can be used to remove some content in bulk: enter the content to remove in the Find field, and let the Replace field blank.
It can also be used to replace different writings of a word in a given alias. Suppose that you have written 'word', 'Word', 'words' and 'Words' in your graph and that you want to replace the last three by an alias to [[word]], e.g. `[Word]([[word]])`. You have just to write this regex in the find field: `/Words?|words/` and this in the replace field: `[$RegEx]([[word]])`.

### Find & Replace in whole Graph (Warning: danger zone!):

![F R - in graph](https://user-images.githubusercontent.com/74436347/202827469-4454ca34-b361-434b-912b-70224e809470.png)

With great caution ⚠️, you can search and replace some string in the whole graph. Don't forget that a string can be a subset of another string that we haven't imagined. The operation can theoretically be undone (with the Undo command below, not with Cmd-Ctrl + Z), but only immediately, not after a graph reload or after other find and research operations, unless you click on 'display changed blocks in sidebar'. A warning message will request confirmation and indicate the number of blocks that will be modified.

For more safety, the new `🔎︎` feature allows you to have a quick overview of blocks that will be changed before doing it.

### `Find & Replace: Insert last changed blocks (references)` command:

After a Find & Replace operation, you can insert anywhere in your graph the list of changed blocks (as block references). It's also available in the 'Undo' popup after each operation: if you click on `Display changed blocks in sidebar`, the list of changed blocks will be inserted on the `[[roam/depot/find & replace]]` page, with date and timestamp.

In option, you can keep a copy of each changed block in its old state, and display a table that compares the blocks before and after the Find & Replace operation, to identify unintended changes and to have a backup of critical changes. Each old version is copied as a child block of the block reference of the new version - and is therefore easily accessible thought inline rerence counter.

### `Extract highlights in selection or page` command in the command palette extract only the highlighted strings, and add an alias to the original block.

### `Extract bold text in selection or page` command

On the same principle, but for advanced users, it's possible to extract only strings matching the regular expression in the find field, accordingly to the pattern in the replace field.

If this option is enabled (in the setting panel), not the entire blocks but only the matching strings will be displayed in plain text with `🔎︎` or copied to the clipboard with '((📋))'. The replace field plays the role of a template with placeholders (`$RegEx` for the matching strings, `$1`, `$2` for capture groups).

## Block <=> Page conversion

![image](https://user-images.githubusercontent.com/74436347/202827676-c014f2e3-d9a3-42e9-bc51-dbb46b1b465e.png)

![image](https://user-images.githubusercontent.com/74436347/202827749-4e65964a-2b03-453a-8135-b62a3f3031de.png)

Convert a given page in a block, and replace in bulk all its references in block references, or the opposite ! It's now as easy as a simple Find & Replace: enter the name of the page (or block reference), then enter a block reference where the page will be converted as the original block to witch all the references will linked (or a new page name).

Options:

- If you enter 'DNP' in the block reference field (or let it blank), the page will be converted in a new block created on the today's daily note page.
- If 'move source content' is checked, all the block in the page will be moved under the new block (or all the children of the block will be move in the new page).
- If you run the `Convert this block => [[page]]` command from the contextual menu of a given block, the original block reference and the page name will be automatically completed.
- If you have a block reference like `((9jO7A7MwG))` or a page reference like `[[page]]` in the clipboard, and run one of the conversion command with the command palette, the corresponding fields will be auto-completed.

Since it's a quite dangerous operation, it will be safer to check the impacted blocks first, with the `🔎︎` button.

## `Bulk change format of selected blocks` command:

![F R - format](https://user-images.githubusercontent.com/74436347/202827539-64b45e04-647c-44d1-9119-7aebe0f58042.png)

Apply to a selection of blocks (and only the visible ones), you can bulk change:

- the header level (1, 2 or 3)
- the alignment of the text (right, left, center, justify),
- the view of the children (bullets, numbers, document),
- the case of the text (all as Upper case, all as lower case, capitalize the first letter of the block or capitalize the first letter of each word or (🆕 new in v.3) capitalize each sentence - excluding page references, tags, attributs and block references, of course).

## `Prepend or append content to selected blocks` command:

![F R - append](https://user-images.githubusercontent.com/74436347/202827636-ec408223-091b-4352-b1b7-2d60d9b9feb9.png)

Insert some string (e.g. a tag) in bulk, at the beginning (prepend) or the end (append) of selected blocks. Only expanded blocks are concerned.

## 🆕 `Bulk change of [[page names]]`

![image](https://github.com/user-attachments/assets/2a37e734-3f43-425a-bff8-065c37008ac4)

Enter the pattern to change in multiple page names (it can be a simple string as `Project`) and the replacing string. Before any change in your graph, you will see the list of page names containing this pattern and have the possibility to select or unselect page names to update. You can easily copy this page list to the clipboard or display it in the right sidebar.

In the input field, you can enter a /regex/ to match more precisely some pattern (ex: `/(Project)/A.*`/`) (without escape character) will match 'Project' only if it has a namespace beginning by 'A'. 'Project' here is a capture group (by the use of parenthesis), so the replacing string will only replace this captured group. See next section for more detials on how Regex and placeholders for matching pattern or capture groups can be used.

## Full Regex support

Regular Expressions (often abbreviated to regex) are a powerful system to express and match any form of character pattern you can imagine. The general idea is that a given regex allows to express several sequences of characters. For example, we have seen above that `/Words?|words/` allows to identify 'Word', 'Words' and 'words', but not 'word' (that we don't want to change). So with a single expression in the search field, you can find and modify different words in your graph simultaneously.

The syntax of regular expressions is very strict. Understanding the science behind them is not indispensable (it is a pure mathematical formalism), but you have to learn the syntax and experiment with it before using it in Find & Replace (you can [for example, learn and test your formulas here](https://regexr.com/)), unless you restrict yourself to reproducing a few simple examples like the ones below. Be very cautious because their effects is not always easy to grasp and can have a dangerous impact on your data. Don't use regex if you don't know what you do.

The most accessible feature is using the variable `$RegEx` as a placeholder for formating the replacement of matching strings:
in Replace field, you can insert `$RegEx` in the replacing string. E.g., to bold all matching strings, enter: `**$RegEx**`
There is 4 possible formating of the main variable (pay attention to upper and lower case letters):

- `$RegEx` leaves the machting string in its initial case. (R and second E are upper case)
- `$REGEX` capitalizes all letters.
- `$regex` set to lower case all letters.
- `$Regex` capitalize first letter.
  Capture groups $1 and $2 can also be (multi-) used, assuming that the RegEx formula includes groups in parenthesis.

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

- limits of auto-expand blocks feature:
  Auto-expand blocks in Search in page or Find & Replace doesn't works always properly. The API command to expand blocks doesn't seem to be 100% reliable when there is an important amount of indented blocks to open. You may have to click on refresh button `↻` until the counter indicates that there are no more words in a folded blocks. Anyway it's only a matter of block display: all matching words will be replaced if you click on 'Replace all'.

- limits of live highlight on page feature:
  Text in code blocks are not highlighted. Likewise, if your search for strings including markdown syntax, or if the matching string is hidden by some markdown syntax (like the link in an alias), it will not be highlighted. A counter indicate how many strings can't be highlighted. You can see them with in plain text with the `🔎︎` button. But in any case, the words will be correctly detected and replaced.

- limits around the logic operators:
  The count of matching elements is not fully reliable with AND or AND+ operators. AND+ is not yet applied to the whole graph search, the algorithm must be optimized to give a result in a reasonable time.

---

For any question or suggestion, DM me on Twitter and follow me to be informed of updates and new extensions: [@fbgallet](https://twitter.com/fbgallet) or Roam Slack.
