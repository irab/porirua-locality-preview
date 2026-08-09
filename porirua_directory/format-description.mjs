/**
 * Turn plain-text service descriptions into safe HTML with bullet lists where detected.
 */

const INLINE_BULLET = /\s+-\s+/g;
const LINE_BULLET = /^\s*[-•*]\s+(.*)$/;

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Short phrase vs trailing prose (e.g. "CAB Porirua refers…"). */
export function isLikelyBulletItem(text) {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (/\.\s+[A-Z]/.test(t)) return false;
  if (t.length > 85) return false;
  const commas = (t.match(/,/g) || []).length;
  if (t.length >= 50 && commas >= 2) return false;
  if (t.length >= 55 && /\b(refers|located|available|provides|ensures)\b/i.test(t)) {
    return false;
  }
  return true;
}

function wrapParagraph(html) {
  const inner = html.trim();
  if (!inner) return "";
  return `<p>${inner}</p>`;
}

function renderList(items) {
  if (!items.length) return "";
  const lis = items.map((item) => `<li>${item}</li>`).join("");
  return `<ul class="desc-list">${lis}</ul>`;
}

function parseInlineBulletRun(introHtml, runText) {
  const run = runText.trim().replace(/^-\s+/, "");
  const parts = run.split(INLINE_BULLET).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return introHtml ? wrapParagraph(introHtml) : "";
  }

  const bullets = [];
  let proseStart = -1;
  for (let i = 0; i < parts.length; i++) {
    if (isLikelyBulletItem(parts[i])) {
      bullets.push(parts[i]);
    } else {
      proseStart = i;
      break;
    }
  }

  let html = "";
  if (introHtml) html += wrapParagraph(introHtml);
  if (bullets.length) html += renderList(bullets);
  if (proseStart >= 0) {
    const prose = parts.slice(proseStart).join(" — ");
    html += wrapParagraph(prose);
  }
  return html;
}

function hasLineBullets(text) {
  return text.split("\n").some((line) => LINE_BULLET.test(line));
}

function parseLineBullets(text) {
  const lines = text.split("\n");
  let html = "";
  let introLines = [];
  let bullets = [];

  const flushIntro = () => {
    if (!introLines.length) return;
    html += wrapParagraph(introLines.join(" ").trim());
    introLines = [];
  };

  const flushBullets = () => {
    if (!bullets.length) return;
    html += renderList(bullets);
    bullets = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      flushIntro();
      continue;
    }

    const bulletMatch = trimmed.match(LINE_BULLET);
    if (bulletMatch) {
      const content = bulletMatch[1].trim();
      if (isLikelyBulletItem(content)) {
        flushIntro();
        bullets.push(content);
      } else {
        flushBullets();
        introLines.push(content);
      }
      continue;
    }

    flushBullets();
    introLines.push(trimmed);
  }

  flushBullets();
  flushIntro();
  return html;
}

function formatPlainParagraphs(normalized) {
  const blocks = normalized.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  if (!blocks.length) return "";

  return blocks
    .map((block) => {
      const inner = escapeHtml(block).replace(/\n/g, "<br>");
      return wrapParagraph(inner);
    })
    .join("");
}

function tryInlineColonBullets(normalized) {
  const m = normalized.match(/^(.+?:)\s*(.+)$/s);
  if (!m) return null;
  const [, intro, rest] = m;
  const trimmedRest = rest.trim();
  if (!trimmedRest) return null;
  if (!INLINE_BULLET.test(trimmedRest) && !/^-\s+/.test(trimmedRest)) return null;
  return parseInlineBulletRun(escapeHtml(intro.trim()), escapeHtml(trimmedRest));
}

/**
 * @param {string} plainText
 * @returns {string} Safe HTML
 */
export function formatDescription(plainText) {
  const raw = String(plainText ?? "").trim();
  if (!raw) return "";

  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const escaped = escapeHtml(normalized);

  if (hasLineBullets(normalized)) {
    const escapedLines = normalized
      .split("\n")
      .map((line) => {
        const m = line.match(LINE_BULLET);
        if (m) {
          return line.replace(LINE_BULLET, (_, body) => `- ${escapeHtml(body)}`);
        }
        return escapeHtml(line);
      })
      .join("\n");
    return parseLineBullets(escapedLines);
  }

  const inline = tryInlineColonBullets(normalized);
  if (inline) return inline;

  if (/\n\n/.test(normalized) || normalized.includes("\n")) {
    return formatPlainParagraphs(normalized);
  }

  return wrapParagraph(escaped);
}
