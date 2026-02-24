import iziToast from "izitoast";
import state from "./state";

export const errorToast = (message) => {
  iziToast.warning({
    timeout: 4000,
    id: "warning",
    position: state.iziToastPosition,
    zindex: 999,
    title: "Input error",
    message: message,
  });
};

export const infoToast = async (
  message,
  timeout = 4000,
  position = state.iziToastPosition,
  title = null,
) => {
  iziToast.info({
    timeout: timeout,
    title: title,
    id: "info",
    position: position,
    zindex: 999,
    title: message,
    onOpened: function (instance, toast) {},
  });
};

export const displayWholeGraphCountInTitle = async (toast, msg = "") => {
  const toastTitle = toast.querySelector(".iziToast-title");
  let totalStr = "";
  let label = "";
  if (msg == "") {
    totalStr = " " + state.changesNb + " matches";
    label = "In whole graph:" + totalStr;
  } else label = msg;
  toastTitle.firstChild.data = label;
  return label;
};
