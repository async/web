import { bootBrowserShell, exampleDirectoryCards } from './boot-browser-shell.ts';

const TOOLTIP_DELAY_MS = 650;
const TOOLTIP_GAP = 8;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderDirectory(): void {
  const grid = document.querySelector<HTMLElement>('#example-directory-grid');
  if (!grid) {
    throw new Error('Missing examples directory grid');
  }
  grid.innerHTML = exampleDirectoryCards.map((card) => {
    const href = `/?demo=${encodeURIComponent(card.href)}`;
    return `<a class="directory-card" href="${escapeHtml(href)}">
      <span class="directory-card__top">
        <strong>${escapeHtml(card.title)}</strong>
        <span class="directory-card__cta">Open demo</span>
      </span>
      <span class="directory-card__summary">${escapeHtml(card.summary)}</span>
      <span class="directory-card__path">${escapeHtml(card.href)}</span>
      <span class="directory-card__setup">
        <span><b>Apps</b>${escapeHtml(card.setup.apps)}</span>
        <span><b>Runtime</b>${escapeHtml(card.setup.runtime)}</span>
        <span><b>Routes</b>${escapeHtml(card.setup.routes)}</span>
        <span><b>Behavior</b>${escapeHtml(card.setup.behavior)}</span>
      </span>
    </a>`;
  }).join('');
}

function installButtonTooltips(root: Document): void {
  const tooltip = root.createElement('div');
  tooltip.className = 'webRuntime-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  root.body.append(tooltip);

  let activeTarget: HTMLElement | undefined;
  let showTimer: number | undefined;

  function hide(): void {
    if (showTimer !== undefined) {
      window.clearTimeout(showTimer);
      showTimer = undefined;
    }
    activeTarget = undefined;
    tooltip.classList.remove('is-visible');
  }

  function place(target: HTMLElement): void {
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const left = Math.min(
      Math.max(TOOLTIP_GAP, targetRect.left + targetRect.width / 2 - tooltipRect.width / 2),
      viewportWidth - tooltipRect.width - TOOLTIP_GAP
    );
    const top = targetRect.top > tooltipRect.height + TOOLTIP_GAP * 2
      ? targetRect.top - tooltipRect.height - TOOLTIP_GAP
      : targetRect.bottom + TOOLTIP_GAP;
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function schedule(target: HTMLElement): void {
    const label = target.dataset.tooltip;
    if (!label) {
      return;
    }
    hide();
    activeTarget = target;
    tooltip.textContent = label;
    showTimer = window.setTimeout(() => {
      if (activeTarget !== target) {
        return;
      }
      place(target);
      tooltip.classList.add('is-visible');
    }, TOOLTIP_DELAY_MS);
  }

  function tooltipTarget(target: EventTarget | null): HTMLElement | undefined {
    return target instanceof Element
      ? target.closest<HTMLElement>('[data-tooltip]') ?? undefined
      : undefined;
  }

  root.addEventListener('pointerenter', (event) => {
    const target = tooltipTarget(event.target);
    if (target) {
      schedule(target);
    }
  }, true);
  root.addEventListener('pointerleave', (event) => {
    if (tooltipTarget(event.target)) {
      hide();
    }
  }, true);
  root.addEventListener('focusin', (event) => {
    const target = tooltipTarget(event.target);
    if (target) {
      schedule(target);
    }
  });
  root.addEventListener('focusout', (event) => {
    if (tooltipTarget(event.target)) {
      hide();
    }
  });
  root.addEventListener('click', hide);
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hide();
    }
  });
  window.addEventListener('resize', hide);
  window.addEventListener('scroll', hide, true);
}

installButtonTooltips(document);

const params = new URLSearchParams(window.location.search);
const demo = params.get('demo');

if (demo) {
  document.body.classList.add('shell-mode');
  document.body.classList.remove('directory-mode');
  void bootBrowserShell(document, createDemoPath(demo, params));
} else {
  document.body.classList.add('directory-mode');
  document.body.classList.remove('shell-mode');
  renderDirectory();
}

function createDemoPath(demo: string, params: URLSearchParams): string {
  const url = new URL(demo, window.location.origin);
  for (const [key, value] of params) {
    if (key !== 'demo') {
      url.searchParams.set(key, value);
    }
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
