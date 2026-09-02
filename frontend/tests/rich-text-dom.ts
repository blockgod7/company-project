import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true
});
for (const name of ["window", "document", "navigator", "HTMLElement", "Element", "Node",
  "Text", "DocumentFragment", "MutationObserver", "DOMParser", "getComputedStyle",
  "requestAnimationFrame", "cancelAnimationFrame", "Event", "KeyboardEvent", "MouseEvent"]) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// JSDOM has no layout; provide geometry only, not selection/command behavior.
const rect = { x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 20, width: 100, height: 20, toJSON: () => ({}) };
dom.window.Range.prototype.getBoundingClientRect = () => rect;
dom.window.Range.prototype.getClientRects = () => [rect];
dom.window.document.elementFromPoint = () => dom.window.document.body;
dom.window.scrollBy = () => {};
