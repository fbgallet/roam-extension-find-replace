import { getBlockAttributes, getBlockContentByUid, getTreeByUid } from "./utils";
import state from "./state";

// getNodesFromTree is set lazily to avoid circular dependency with nodeTraversal
let _getNodesFromTree = null;
export function setGetNodesFromTree(fn) {
  _getNodesFromTree = fn;
}

let Node = function (uid, attr, embeded = false) {
  this.uid = uid;
  this.content = attr.string;
  this.page = attr.page;
  this.open = attr.open;
  this.collapsedParents = attr.collapsedParents;
  this.reopened = 0;
  this.refs = attr.refs;
  this.embeded = embeded;
  this.isEmbeded = () => {
    if (
      (this.content.includes("{{embed") ||
        this.content.includes("{{[[embed")) &&
      this.refs.length != 0
    ) {
      this.embeded = true;
    } else this.embeded = false;
    return this.embeded;
  };
  this.pushRefs = () => {
    let skip = false;
    if (this.refs.length > 0) {
      this.refs.forEach((ref) => {
        let refContent = getBlockContentByUid(ref);
        if (refContent != undefined) {
          if (this.content.includes("](((" + ref + ")))")) skip = true;
          //if (this.content === "((" + ref + "))") skip = true;
          if (state.isPrepending && !skip) {
            if (this.content === "((" + ref + "))") {
              //state.expandedNodesUid.pop();
              state.referencedNodesUid.push(
                new Node(ref, getBlockAttributes(ref)),
              );
              skip = true;
            }
          }
          if (!skip)
            state.referencedNodesUid.push(
              new Node(ref, getBlockAttributes(ref)),
            );
        }
      });
    }
  };
  this.pushEmbedTree = (tree = []) => {
    if (tree.length === 0) {
      if (this.refs.length === 1) tree = getTreeByUid(this.refs[0]);
      else tree = getTreeByUid(this.refs[1]);
    }
    _getNodesFromTree(tree, false, state.expandedNodesUid);
  };
};
Node.prototype.getAttributes = (uid) => {
  return getBlockAttributes(uid);
};

export default Node;
