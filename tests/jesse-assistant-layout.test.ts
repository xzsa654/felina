import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Jesse markdown wraps long prompt output without horizontal scrolling", async () => {
  const component = await readFile(
    new URL("../src/lib/components/tokens/components/JesseTokenAssistant.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(new URL("../src/app.css", import.meta.url), "utf8");

  assert.match(component, /MarkdownPreview[\s\S]*className="[^"]*\bjesse-markdown\b[^"]*"/);
  assert.match(css, /\.jesse-markdown\b/);
  assert.match(css, /\.jesse-markdown[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /\.jesse-markdown[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.jesse-markdown[\s\S]*white-space:\s*pre-wrap/);
  assert.doesNotMatch(css, /\.jesse-markdown[\s\S]*overflow-x:\s*auto/);
});

test("Jesse initial summary prompt asks for a concrete example", async () => {
  const component = await readFile(
    new URL("../src/lib/components/tokens/components/JesseTokenAssistant.tsx", import.meta.url),
    "utf8",
  );

  assert.match(component, /加一個具體例子/);
  assert.match(component, /include one concrete example/);
});
