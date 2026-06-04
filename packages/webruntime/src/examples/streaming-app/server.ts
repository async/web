import { createJsonLineStreamResponse, createTextStreamResponse } from '../../core/create-stream-response.ts';
import type { FetchApp } from '../../core/types.ts';

interface StreamSection {
  title: string;
  body: string;
}

const defaultHtmlFirstChunkDelayMs = 700;
const defaultHtmlChunkDelayMs = 240;
const defaultTextFirstChunkDelayMs = 600;
const defaultTextChunkDelayMs = 180;

const streamSections: StreamSection[] = [
  {
    title: 'Route Graph Warmup',
    body: 'The frontend asks for a document, WebRuntime builds a Request, and the route graph forwards it to this browser-safe app.fetch() handler.'
  },
  {
    title: 'First Byte',
    body: 'The first chunk contains the head, navigation, and intro copy so the preview can start painting before the full response exists.'
  },
  {
    title: 'Chunk Boundaries',
    body: 'Every article card is emitted as its own response chunk. The trace panel records stream:start, stream:chunk, and stream:end while the body is read.'
  },
  {
    title: 'Long Content',
    body: 'This page intentionally has enough sections to feel like a generated report, docs page, transcript, or AI response instead of a tiny fixture.'
  },
  {
    title: 'Browser Shell Rendering',
    body: 'The shell keeps app code inside the fake browser frame and refreshes the frame as streamed HTML accumulates.'
  },
  {
    title: 'No Real Backend',
    body: 'The same static-hosted bundle can serve the frontend and the app.fetch() backend without opening a real server port for the app itself.'
  },
  {
    title: 'Relative Links',
    body: 'Links on this page stay inside the mounted example path, which lets the same app run at / or under /examples/streaming-app/.'
  },
  {
    title: 'NDJSON Side Channel',
    body: 'The /events route returns newline-delimited JSON to model progress feeds, server logs, token streams, or build output.'
  },
  {
    title: 'Cache Policy',
    body: 'Streaming responses use cache-control: no-store in this demo so every reload creates a fresh request/response cycle.'
  },
  {
    title: 'Trace Volume',
    body: 'Longer streams make trace behavior obvious because many chunks pass through the same Request -> Response pipeline.'
  },
  {
    title: 'Testing Shape',
    body: 'Node-side tests can read this response with getReader() and assert chunk order without launching a browser.'
  },
  {
    title: 'Fake Latency',
    body: 'The helper delays the first chunk and later chunks so UI timing bugs are easier to see during manual review.'
  },
  {
    title: 'Plain Text Stream',
    body: 'The /long.txt route returns the same material as plain text for testing non-HTML streaming render paths.'
  },
  {
    title: 'Static Demo Fit',
    body: 'This is the GitHub Pages use case: code talks to itself through WebRuntime instead of relying on a deployed API.'
  },
  {
    title: 'Runtime Swap',
    body: 'Use the runtime selector to keep everything in the same realm or move pieces behind iframe runtime boundaries.'
  },
  {
    title: 'Final Chunk',
    body: 'The closing chunk completes the document and leaves normal links, text selection, and reload behavior working.'
  }
];

export const streamingServer: FetchApp = {
  async fetch(request) {
    const url = new URL(request.url);
    const textDelay = resolveStreamDelay(url, {
      firstChunkDelayMs: defaultTextFirstChunkDelayMs,
      chunkDelayMs: defaultTextChunkDelayMs
    });
    if (url.pathname === '/events') {
      return createJsonLineStreamResponse({
        values: [
          {
            type: 'start',
            route: '/events'
          },
          ...streamSections.map((section, index) => ({
            type: 'chunk',
            index: index + 1,
            title: section.title,
            bytes: section.body.length
          })),
          {
            type: 'done',
            chunks: streamSections.length
          }
        ],
        firstChunkDelayMs: textDelay.firstChunkDelayMs,
        delayMs: textDelay.chunkDelayMs,
        headers: {
          'content-type': 'application/x-ndjson',
          'cache-control': 'no-store'
        }
      });
    }
    if (url.pathname === '/long.txt') {
      return createTextStreamResponse({
        chunks: [
          'WebRuntime long text stream\n\n',
          ...streamSections.map((section, index) => [
            `Chunk ${String(index + 1).padStart(2, '0')}: ${section.title}\n`,
            `${section.body}\n\n`
          ].join('')),
          'End of long text stream.\n'
        ],
        firstChunkDelayMs: textDelay.firstChunkDelayMs,
        delayMs: textDelay.chunkDelayMs,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store'
        }
      });
    }
    if (url.pathname === '/') {
      const htmlDelay = resolveStreamDelay(url, {
        firstChunkDelayMs: defaultHtmlFirstChunkDelayMs,
        chunkDelayMs: defaultHtmlChunkDelayMs
      });
      return createTextStreamResponse({
        chunks: createHomeChunks(htmlDelay, url.search),
        firstChunkDelayMs: htmlDelay.firstChunkDelayMs,
        delayMs: htmlDelay.chunkDelayMs,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store'
        }
      });
    }
    return new Response('Not found', {
      status: 404
    });
  }
};

interface StreamDelayProfile {
  firstChunkDelayMs: number;
  chunkDelayMs: number;
}

function createHomeChunks(delay: StreamDelayProfile, search: string): string[] {
  const routeSearch = escapeHtml(search);
  return [
    `<!doctype html>
    <html>
      <head>
        <title>Streaming App</title>
        <style>
          body {
            margin: 0;
            color: #172033;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            line-height: 1.5;
          }
          main {
            display: grid;
            gap: 18px;
            max-width: 920px;
            padding: 28px;
          }
          h1,
          h2,
          p {
            margin: 0;
          }
          .hero {
            display: grid;
            gap: 10px;
            border-bottom: 1px solid #d9e1ee;
            padding-bottom: 18px;
          }
          .meta {
            color: #516176;
          }
          .links {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
          .links a {
            border: 1px solid #c8d3e3;
            border-radius: 6px;
            padding: 6px 8px;
            color: #172033;
            text-decoration: none;
          }
          .stream-list {
            display: grid;
            gap: 12px;
          }
          .stream-progress {
            position: sticky;
            top: 0;
            z-index: 2;
            width: fit-content;
            border: 1px solid #9bb4d2;
            border-radius: 999px;
            padding: 5px 9px;
            background: rgba(249, 251, 254, 0.96);
            color: #263347;
            font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          }
          article {
            display: grid;
            gap: 6px;
            border: 1px solid #d9e1ee;
            border-radius: 8px;
            padding: 14px;
            background: #f9fbfe;
          }
          .chunk {
            color: #64748b;
            font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          }
        </style>
      </head>
      <body>
        <main>
          <section class="hero">
            <h1>Streaming Home</h1>
            <p class="meta">A long streamed HTML response made of ${streamSections.length + 2} chunks with a ${delay.firstChunkDelayMs}ms first-byte delay and ${delay.chunkDelayMs}ms between later chunks.</p>
            <p class="meta">Tune it with <code>?delay=600&amp;firstDelay=1200</code> on the real URL or fake URL.</p>
            <nav class="links" aria-label="Streaming routes">
              <a href="/events${routeSearch}">Open NDJSON event stream</a>
              <a href="/long.txt${routeSearch}">Open long text stream</a>
            </nav>
          </section>
          <div id="stream-progress" class="stream-progress" data-total="${streamSections.length}">waiting for streamed chunks</div>
          <script>
            (() => {
              const update = (detail = {}) => {
                const progress = document.getElementById('stream-progress');
                if (!progress) {
                  return;
                }
                const total = Number(progress.dataset.total || '0');
                const count = document.querySelectorAll('article').length;
                const suffix = detail.elapsedMs
                  ? ' in ' + (detail.elapsedMs / 1000).toFixed(1) + 's'
                  : '';
                progress.textContent = detail.complete || count >= total
                  ? 'all ' + total + ' chunks rendered'
                  : count + ' of ' + total + ' chunks rendered' + suffix;
              };
              document.addEventListener('webruntime:stream-chunk', (event) => {
                update(event.detail || {});
              });
              new MutationObserver(update).observe(document.documentElement, {
                childList: true,
                subtree: true
              });
              update();
            })();
          </script>
          <section class="stream-list" aria-label="Streamed chunks">`,
    ...streamSections.map((section, index) => `
            <article>
              <span class="chunk">chunk ${String(index + 1).padStart(2, '0')}</span>
              <h2>${escapeHtml(section.title)}</h2>
              <p>${escapeHtml(section.body)}</p>
            </article>`),
    `     </section>
          <p class="meta">Done: WebRuntime streamed and rendered the complete long document.</p>
        </main>
      </body>
    </html>`
  ];
}

function resolveStreamDelay(url: URL, fallback: StreamDelayProfile): StreamDelayProfile {
  return {
    firstChunkDelayMs: readDelayParam(url, ['firstDelay', 'firstChunkDelay'], fallback.firstChunkDelayMs),
    chunkDelayMs: readDelayParam(url, ['delay', 'chunkDelay'], fallback.chunkDelayMs)
  };
}

function readDelayParam(url: URL, names: string[], fallback: number): number {
  for (const name of names) {
    const value = url.searchParams.get(name);
    if (value === null || value.trim() === '') {
      continue;
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(10000, Math.round(parsed)));
    }
  }
  return fallback;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
