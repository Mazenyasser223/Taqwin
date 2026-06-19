function isScrollableY(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  if (!/(auto|scroll|overlay)/.test(style.overflowY)) return false;
  return el.scrollHeight > el.clientHeight + 1;
}

/** Collect scrollable ancestors from innermost up to (and including) `.app-scroll`. */
function scrollableAncestors(el: HTMLElement): HTMLElement[] {
  const chain: HTMLElement[] = [];
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    if (isScrollableY(node)) chain.push(node);
    if (node.classList.contains('app-scroll')) break;
    node = node.parentElement;
  }
  return chain;
}

function viewportReserves() {
  return { top: 72, bottom: 96 };
}

function scrollWithinContainer(
  el: HTMLElement,
  container: HTMLElement,
  topReserve: number,
  bottomReserve: number,
): boolean {
  const cRect = container.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const visibleTop = cRect.top + topReserve;
  const visibleBottom = cRect.bottom - bottomReserve;

  let delta = 0;
  if (eRect.height > cRect.height - topReserve - bottomReserve) {
    delta = eRect.top - visibleTop;
  } else if (eRect.top < visibleTop) {
    delta = eRect.top - visibleTop;
  } else if (eRect.bottom > visibleBottom) {
    delta = eRect.bottom - visibleBottom;
  }

  if (Math.abs(delta) < 1) return false;
  container.scrollTop += delta;
  return true;
}

/** Scroll a tour target into view inside AppShell nested scroll regions. */
export function scrollTourElementIntoView(el: HTMLElement): void {
  const { top, bottom } = viewportReserves();
  const ancestors = scrollableAncestors(el);

  if (!ancestors.length) {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    return;
  }

  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const container of ancestors) {
      if (scrollWithinContainer(el, container, top, bottom)) moved = true;
    }
    if (!moved) break;
  }
}

export function scrollTourTargetIntoView(stepId: string): void {
  const el = document.querySelector(`[data-tour="${stepId}"]`) as HTMLElement | null;
  if (el) scrollTourElementIntoView(el);
}

/** Wait for scroll + layout to settle after tab switches or route changes. */
export function waitForTourScrollPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}
