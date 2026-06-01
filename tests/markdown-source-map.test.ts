import assert from "node:assert/strict";
import test from "node:test";
import { renderWithSourceMap } from "../src/lib/utils/markdown-source-map.ts";

test("heading gets data-source-line", () => {
  const html = renderWithSourceMap("# Hello\n");
  assert.match(html, /data-source-line="1"/);
  assert.match(html, /<h1/);
});

test("paragraph gets correct line number", () => {
  const html = renderWithSourceMap("# Title\n\nParagraph\n");
  assert.match(html, /<p data-source-line="3"/);
});

test("code block gets correct line number", () => {
  const md = "# Title\n\n```js\nconsole.log(1)\n```\n";
  const html = renderWithSourceMap(md);
  assert.match(html, /<pre data-source-line="3"/);
});

test("list gets correct line number", () => {
  const md = "Intro\n\n- one\n- two\n";
  const html = renderWithSourceMap(md);
  assert.match(html, /<ul data-source-line="3"/);
});

test("table gets correct line number", () => {
  const md = "Intro\n\n| a | b |\n|---|---|\n| 1 | 2 |\n";
  const html = renderWithSourceMap(md);
  assert.match(html, /<table data-source-line="3"/);
});

test("multiple blocks have sequential line numbers", () => {
  const md = "# H1\n\nPara\n\n## H2\n\nPara2\n";
  const html = renderWithSourceMap(md);
  assert.match(html, /h1 data-source-line="1"/);
  assert.match(html, /p data-source-line="3"/);
  assert.match(html, /h2 data-source-line="5"/);
  assert.match(html, /p data-source-line="7"/);
});

test("empty markdown returns empty string", () => {
  const html = renderWithSourceMap("");
  assert.equal(html, "");
});
