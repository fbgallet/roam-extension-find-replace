/**
 * notifications.js — re-exports from toaster.js for backward compatibility.
 * Old callers of errorToast / infoToast / displayWholeGraphCountInTitle
 * continue to work without changes.
 */
export { errorToast, infoToast, warningToast, displayWholeGraphCountInTitle } from "./toaster";
