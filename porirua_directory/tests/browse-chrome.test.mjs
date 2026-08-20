import test from "node:test";
import assert from "node:assert/strict";
import { nextBrowseChromeFromScroll } from "../browse-chrome.mjs";

function step(state, y, now) {
  return {
    ...state,
    ...nextBrowseChromeFromScroll({ ...state, y, now }),
    y,
    now,
  };
}

test("scrolling down past the delta collapses chrome", () => {
  const next = step(
    {
      y: 0,
      lastY: 0,
      collapsed: false,
      now: 0,
      lockUntil: 0,
      collapseEnabled: true,
    },
    80,
    16
  );
  assert.equal(next.collapsed, true);
  assert.equal(next.lastY, 80);
  assert.ok(next.lockUntil > 16);
});

test("layout-induced upward jump after collapse does not expand while locked", () => {
  let state = {
    y: 0,
    lastY: 0,
    collapsed: false,
    now: 0,
    lockUntil: 0,
    collapseEnabled: true,
  };
  state = step(state, 120, 16);
  assert.equal(state.collapsed, true);

  // Collapsing filters/map shrinks the document; the browser reports a
  // large negative scroll delta (scroll anchoring / max-scroll clamp).
  state = step(state, 18, 32);
  assert.equal(state.collapsed, true);
  assert.equal(state.lastY, 18);
});

test("after the lock expires, a real upward scroll expands chrome", () => {
  let state = {
    y: 0,
    lastY: 0,
    collapsed: false,
    now: 0,
    lockUntil: 0,
    collapseEnabled: true,
  };
  state = step(state, 200, 16);
  assert.equal(state.collapsed, true);

  state = step(state, 160, state.lockUntil + 1);
  assert.equal(state.collapsed, false);
});

test("while locked, scrolling to the true top still expands chrome", () => {
  let state = {
    y: 0,
    lastY: 0,
    collapsed: false,
    now: 0,
    lockUntil: 0,
    collapseEnabled: true,
  };
  state = step(state, 200, 16);
  assert.equal(state.collapsed, true);
  state = step(state, 0, 32);
  assert.equal(state.collapsed, false);
});

test("after the lock expires, a layout-clamped position near top stays collapsed", () => {
  let state = {
    y: 0,
    lastY: 0,
    collapsed: false,
    now: 0,
    lockUntil: 0,
    collapseEnabled: true,
  };
  state = step(state, 120, 16);
  state = step(state, 18, 32);
  state = step(state, 18, state.lockUntil + 1);
  assert.equal(state.collapsed, true);
});

test("map stays collapsed while scrolled even if filters expand", () => {
  let state = {
    y: 0,
    lastY: 0,
    collapsed: false,
    now: 0,
    lockUntil: 0,
    collapseEnabled: true,
  };
  state = step(state, 200, 16);
  assert.equal(state.collapsed, true);
  assert.equal(state.mapCollapsed, true);

  state = step(state, 160, state.lockUntil + 1);
  assert.equal(state.collapsed, false);
  assert.equal(state.mapCollapsed, true);
});

test("map expands only near the top of the page", () => {
  let state = {
    y: 0,
    lastY: 0,
    collapsed: false,
    now: 0,
    lockUntil: 0,
    collapseEnabled: true,
  };
  state = step(state, 200, 16);
  state = step(state, 0, state.lockUntil + 1);
  assert.equal(state.collapsed, false);
  assert.equal(state.mapCollapsed, false);
});

test("desktop three-column does not collapse", () => {
  const next = step(
    {
      y: 0,
      lastY: 0,
      collapsed: false,
      now: 0,
      lockUntil: 0,
      collapseEnabled: false,
    },
    400,
    16
  );
  assert.equal(next.collapsed, false);
});
