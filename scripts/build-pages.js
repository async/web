import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const siteDir = "_site";
const docsDir = "docs";
const docsOutDir = join(siteDir, "docs");

rmSync(siteDir, { recursive: true, force: true });
mkdirSync(docsOutDir, { recursive: true });

const docs = readdirSync(docsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => entry.name)
  .sort();

for (const doc of docs) {
  cpSync(join(docsDir, doc), join(docsOutDir, doc));
}

const readme = readFileSync("README.md", "utf8");
const docsReadme = readFileSync(join(docsDir, "README.md"), "utf8");
const guideLinks = docs
  .map((doc) => `<li><a href="docs/${escapeHtml(doc)}">${escapeHtml(titleFromMarkdown(join(docsDir, doc)) || basename(doc, ".md"))}</a></li>`)
  .join("\n");

writeFileSync(
  join(siteDir, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Async Web</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.55;
      }
      body {
        margin: 0;
        color: #172033;
        background: #f7f8fb;
      }
      main {
        max-width: 960px;
        margin: 0 auto;
        padding: 48px 24px 72px;
      }
      h1, h2 {
        line-height: 1.15;
      }
      h1 {
        font-size: 40px;
        margin: 0 0 16px;
      }
      h2 {
        margin-top: 36px;
      }
      pre {
        overflow: auto;
        padding: 16px;
        border: 1px solid #d7dce8;
        background: #ffffff;
      }
      a {
        color: #0969da;
      }
      .lead {
        max-width: 720px;
        font-size: 18px;
      }
      @media (prefers-color-scheme: dark) {
        body {
          color: #edf2ff;
          background: #121620;
        }
        pre {
          border-color: #30394d;
          background: #171d2a;
        }
        a {
          color: #8cb8ff;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Async Web</h1>
      <p class="lead">Docs and package surface for <code>@async/web</code>, the Async app framework and WebRuntime package.</p>
      <h2>Guides</h2>
      <ul>
${guideLinks}
      </ul>
      <h2>README</h2>
      ${renderMarkdown(readme)}
      <h2>Docs Index</h2>
      ${renderMarkdown(docsReadme)}
    </main>
  </body>
</html>
`,
  "utf8"
);

function titleFromMarkdown(path) {
  const source = readFileSync(path, "utf8");
  const heading = source.split(/\r?\n/).find((line) => line.startsWith("# "));
  return heading ? heading.replace(/^#\s+/, "").trim() : "";
}

function renderMarkdown(source) {
  const lines = source.split(/\r?\n/);
  const html = [];
  let inList = false;
  let inCode = false;
  const code = [];

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code.length = 0;
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (line.startsWith("# ")) {
      closeList();
      html.push(`<h2>${escapeHtml(line.slice(2).trim())}</h2>`);
      continue;
    }
    if (line.startsWith("## ")) {
      closeList();
      html.push(`<h3>${escapeHtml(line.slice(3).trim())}</h3>`);
      continue;
    }
    if (line.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInline(line.slice(2).trim())}</li>`);
      continue;
    }
    if (line.trim() === "" || line.startsWith("|")) {
      closeList();
      continue;
    }
    closeList();
    html.push(`<p>${renderInline(line.trim())}</p>`);
  }

  closeList();
  return html.join("\n");

  function closeList() {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  }
}

function renderInline(value) {
  return escapeHtml(value)
    .replaceAll(/`([^`]+)`/g, "<code>$1</code>")
    .replaceAll(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
