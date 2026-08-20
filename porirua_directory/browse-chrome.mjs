export const BROWSE_CHROME_EXPAND_SCROLL_Y = 56;
export const BROWSE_CHROME_AT_TOP_Y = 8;
export const BROWSE_CHROME_SCROLL_DELTA = 10;
export const BROWSE_CHROME_DURATION_MS = 360;
export const BROWSE_CHROME_LOCK_MS = BROWSE_CHROME_DURATION_MS + 48;

export function armBrowseChromeLock(now) {
  return now + BROWSE_CHROME_LOCK_MS;
}

/**
 * Decide browse-chrome collapsed state from a scroll sample.
 * While `now < lockUntil`, layout-induced scroll jumps are ignored.
 */
export function nextBrowseChromeFromScroll({
  y,
  lastY,
  collapsed,
  now,
  lockUntil,
  collapseEnabled,
}) {
  if (!collapseEnabled) {
    return { collapsed: false, mapCollapsed: false, lastY: y, lockUntil: 0 };
  }

  if (now < lockUntil) {
    if (collapsed && y <= BROWSE_CHROME_AT_TOP_Y) {
      return {
        collapsed: false,
        mapCollapsed: false,
        lastY: y,
        lockUntil: armBrowseChromeLock(now),
      };
    }
    return {
      collapsed,
      mapCollapsed: collapsed || y > BROWSE_CHROME_EXPAND_SCROLL_Y,
      lastY: y,
      lockUntil,
    };
  }

  const delta = y - lastY;
  let next = collapsed;
  if (collapsed && y <= BROWSE_CHROME_AT_TOP_Y) {
    next = false;
  } else if (!collapsed && y <= BROWSE_CHROME_EXPAND_SCROLL_Y) {
    next = false;
  } else if (delta > BROWSE_CHROME_SCROLL_DELTA && y > BROWSE_CHROME_EXPAND_SCROLL_Y) {
    next = true;
  } else if (delta < -BROWSE_CHROME_SCROLL_DELTA) {
    next = false;
  }

  return {
    collapsed: next,
    mapCollapsed: next || y > BROWSE_CHROME_EXPAND_SCROLL_Y,
    lastY: y,
    lockUntil: next !== collapsed ? armBrowseChromeLock(now) : lockUntil,
  };
}
