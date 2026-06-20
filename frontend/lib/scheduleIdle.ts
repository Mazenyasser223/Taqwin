/** Run work after first paint without blocking interaction. */
export function scheduleIdleTask(task: () => void, timeoutMs = 2000): void {
  if (typeof window === 'undefined') {
    task();
    return;
  }
  const ric = window.requestIdleCallback;
  if (ric) {
    ric(() => task(), { timeout: timeoutMs });
    return;
  }
  window.setTimeout(task, 0);
}
