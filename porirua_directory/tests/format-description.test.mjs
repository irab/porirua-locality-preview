import test from "node:test";
import assert from "node:assert/strict";
import { formatDescription } from "../format-description.mjs";

test("formatDescription — blank lines become separate paragraphs", () => {
  const html = formatDescription("First paragraph.\r\n\r\nSecond paragraph.");
  assert.match(html, /<p>First paragraph\.<\/p>/);
  assert.match(html, /<p>Second paragraph\.<\/p>/);
});

test("formatDescription — single newline within block becomes line break", () => {
  const html = formatDescription("Line one\nLine two");
  assert.match(html, /<p>Line one<br>Line two<\/p>/);
});

test("formatDescription — line bullets after colon (CAB-style)", () => {
  const text =
    "Provides information on topics such as:\n- consumer queries\n- employment\n\nClosing paragraph.";
  const html = formatDescription(text);
  assert.match(html, /<p>Provides information on topics such as:<\/p>/);
  assert.match(html, /<ul class="desc-list">/);
  assert.match(html, /<li>consumer queries<\/li>/);
  assert.match(html, /<li>employment<\/li>/);
  assert.match(html, /<p>Closing paragraph\.<\/p>/);
});

test("formatDescription — inline dash bullets on one line", () => {
  const html = formatDescription("Topics: - food - housing - transport");
  assert.match(html, /<ul class="desc-list">/);
  assert.match(html, /<li>food<\/li>/);
  assert.match(html, /<li>housing<\/li>/);
});
