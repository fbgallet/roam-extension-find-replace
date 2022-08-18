export function getTreeByUid(uid) {
  if (uid)
    return window.roamAlphaAPI.q(`[:find (pull ?page
                     [:block/uid :block/string :block/children :block/open :block/refs
                        {:block/children ...} ])
                      :where [?page :block/uid "${uid}"]  ]`)[0][0];
  else return null;
}

export function getBlockAttributes(uid) {
  return window.roamAlphaAPI.q(`[:find (pull ?page 
                                [:block/string :block/uid :block/open :block/refs])
                      :where [?page :block/uid "${uid}"]  ]`)[0][0];
}

export function getBlocksUidReferencedInThisBlock(uid) {
  let q = `[:find ?u 
            :where 
              [?r :block/uid "${uid}"] 
              [?r :block/refs ?x] 
              [?x :block/uid ?u] ]`;
  return window.roamAlphaAPI.q(q).flat();
}

export function updateBlock(uid, content, isOpen) {
  setTimeout(function () {
    window.roamAlphaAPI.updateBlock({
      block: { uid: uid, string: content, open: isOpen },
    });
  }, 10);
}

export function simulateClick(el) {
  const options = {
    bubbles: true,
    cancelable: true,
    view: window,
    target: el,
    which: 1,
    button: 0,
  };
  el.dispatchEvent(new MouseEvent("mousedown", options));
  el.dispatchEvent(new MouseEvent("mouseup", options));
  el.dispatchEvent(new MouseEvent("click", options));
}
