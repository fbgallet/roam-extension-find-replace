# Find & Replace
 
Find & Replace any string of characters in current **block selection** (including block references and embeds in option), in current **page**, in current **workspace** (page + right sidebar + linked references) or, with great caution, in the whole graph. Case sensitive or insensitive, Regex support. As a bonus: **prepend/append in bulk** feature.

![image](https://user-images.githubusercontent.com/74436347/185465608-d94b14f4-d899-417b-b7cc-ef4c59f5a952.png)

![image](https://user-images.githubusercontent.com/74436347/185460911-83b0c19d-3c1a-428b-ac8e-3d70949baebf.png)


## Commands available in command palette (Cmd-Ctrl + P)

- **Find & Replace: in block or Selection of blocks (frs)**:

Replace, in current block or in the selected block (blue highlighted with mouse or Shift + Up or Down) a given string with another. Only expanded (i.e. visible) blocks are processed. The string to find can be case insensitive or be a Regex expression (see 'About Regex support' section below for details). In option (see setting panel above), inline block references and embeded blocks can be also processed. Find & Replace be used to remove some content in bulk: enter the content to remove in the Find field, and let the Replace field blank. It can also be used to change the case of some text, thanks to Regex.

- **Find & Replace: in Page zoom (frp)**:

Process the whole zoomed part of the page (collapsed blocks included). In option, linked references (backlinks mentions at the bottom of the page) can be also processed.

- **Find & Replace: in Workspace (Page + Sidebar + references) (frw)**:

Processed the current zoomed part of the page and of the opened pages in the right sidebar. Block references, embeded blocks and linked references (for the main page) are included. In the right sidebar, page, blocks and opened linked references are included.

- **Find & Replace: in whole Graph (Warning: dangerous operation!)**:

With great caution ⚠️, you can search and replace some string in the whole graph. Don't forget that a string can be a subset of another string that we haven't imagined. The operation can theoretically be undone (with the Undo command below, not with Cmd-Ctrl + Z), but only immediately, not after a graph reload or after other find and research operations. A warning message will request confirmation and indicate the number of blocks that will be modified. Do not confirm if this number is high, this operation should be used only in exceptional cases. Don't forget to make a regular backup of your graph!

- **Find & Replace: Insert last changed blocks (references)**:

After a Find & Replace operation, you can insert anywhere in your graph the list of changed blocks (as block references). It's also available in the 'Undo' popup after each operation: if you click on `Display changed blocks in sidebar`, the list of changed blocks will be inserted on the `[[roam/depot/find & replace]]` page, with date and timestamp. In option, you can keep a copy of each changed block in its old state, and display a table that compares the blocks before and after the Find & Replace operation, to identify unintended changes and to have a backup of critical changes. Each old version is copied as a child block of the block reference of the new version - and is therefore easily accessible thought inline rerence counter.

- **Find & Replace: Undo last operation**:

Restore the blocks to their previous state. Works only for the last Find & Replace (or Prepend/Append) operation.

- **Find & Replace: Redo last operation**:

Redo the last Find & Replace, or Prepend/Append operation, without opening a dialog box, with the same parameters, to apply for example the change to another page.

- **Prepend or append content to selected blocks**:

Insert some string (e.g. a tag) in bulk, at the beginning (prepend) or the end (append) of selected blocks. Only expanded blocks are concerned.

![image](https://user-images.githubusercontent.com/74436347/185461724-c32adb75-86cf-46c8-9335-f2c218d6d587.png)


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

![image](https://user-images.githubusercontent.com/74436347/185465543-71646344-4d07-4ed4-90bf-02b17bcbf419.png)


---

For any question or suggestion, DM me on Twitter: [@fbgallet](https://twitter.com/fbgallet) or Roam Slack.
