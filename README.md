# Find & Replace
 
Find & Replace any content, case sensitive or not, in current block selection, in current page, in current workspace (page + right sidebar + linked references) or, with great caution, in the whole graph, with Regex support. As a bonus, there is also a prepend/append in bulk feature.

## Commands available in command palette (Cmd-Ctrl + P)

- **Find & Replace: in block or Selection of blocks (frs)**: replace, in current block or in the selected block (blue highlighted with mouse or Shift + Up or Down) a given string with another. The string to find can be case insensitive or be a Regex expression (see below for details). Only expanded blocks are processed. In option (see setting panel above), inline block references and embeded blocks can be also processed.

- **Find & Replace: in Page zoom (frp)**: process the whole zoomed part of the page (collapsed blocks included). In option, linked references (backlinks mentions at the bottom of the page) can be also processed.

- **Find & Replace: in Workspace (Page + Sidebar + references) (frw)**: processed the current zoomed part of the page and of the opened pages in the right sidebar. Block references, embeded blocks and linked references (for the main page) are included. In the right sidebar, page, blocks and opened linked references are included.

- **Find & Replace: in whole Graph (Warning: dangerous operation!)**: with great caution ⚠️, you can search and replace some string in the whole graph. Don't forget that a string can be a subset of another string that we haven't imagined. The operation can theoretically be undone (with the Undo command below, not with Cmd-Ctrl + Z), but only immediately, not after a graph reload or after other find and research operations. A warning message will request confirmation and indicate the number of blocks that will be modified. Do not confirm if this number is high, this operation should be used only in exceptional cases. Don't forget to make a regular backup of your graph!

- **Find & Replace: Insert last changed blocks (references)**: after a Find & Replace operation, you can insert anywhere in your graph the list of changed block (as block references). It's also available in the 'Undo' popup after each operation: if you click on `Display changed blocks in sidebar`, the list of changed block will be inserted on the `[[roam/depot/find & replace]]` page, with date and timestamp. In option, you can display a table that compares the blocks before and after the Find & Replace operation, to identify unintended changes and to have a backup of critical changes.

- **Find & Replace: Undo last operation**: restores the blocks to their previous state. Works only for the last Find & Replace operation.

- **Find & Replace: Redo last operation**: redo the last Find & Replace, or Prepend/Append operation, without opening a dialog box, with the same parameters, to apply for example the change to another page.

- **Prepend or append content to selected blocks**: insert some string (e.g. a tag) in bulk, at the beginning (prepend) or the end (append) of selected blocks. Only expanded blocks are concerned.

![image](https://user-images.githubusercontent.com/74436347/185459813-73ae93e2-8dae-4266-99fb-c86f3fb617d9.png)
