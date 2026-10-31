// Theme/language init — external file so the CSP can forbid inline scripts.
(function () {
  try {
    var t = localStorage.getItem("rr-theme");
    if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (t === "dark") document.documentElement.dataset.theme = "dark";
    var lang = localStorage.getItem("rr-lang");
    if (lang === "en") document.documentElement.lang = "en";
  } catch (e) {
    /* ignore */
  }
})();
