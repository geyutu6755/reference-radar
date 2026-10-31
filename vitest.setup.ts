import jsdom from "jsdom";

const { JSDOM } = jsdom;
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

if (typeof globalThis.DOMParser === "undefined") {
  Object.defineProperty(globalThis, "DOMParser", {
    value: new dom.window.DOMParser(),
    writable: true,
  });
}

// pdfium-free minimal setup: matchMedia for theme code, ResizeObserver stub
if (typeof globalThis.matchMedia === "undefined") {
  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
