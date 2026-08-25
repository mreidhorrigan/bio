(function () {
  "use strict";
  const enabled = new URLSearchParams(location.search).get("perf") === "1";
  if (!enabled) return;
  const limit = 3600;
  const samples = { frame: [], update: [], ecology: [], prepare: [], canvas: [], actors: [] };
  let longTasks = 0, longTaskMs = 0;
  const add = (name, value) => {
    const values = samples[name];
    if (!values || !Number.isFinite(value)) return;
    values.push(value); if (values.length > limit) values.shift();
  };
  const percentile = (values, p) => {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
  };
  const summary = (values) => ({
    count: values.length,
    mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    p50: percentile(values, 0.5), p95: percentile(values, 0.95), p99: percentile(values, 0.99),
  });
  try {
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) { longTasks++; longTaskMs += entry.duration; } }).observe({ type: "longtask", buffered: true });
  } catch (_) { /* unsupported outside Chromium */ }
  window.MH_PERF = {
    enabled, mark: add,
    report() {
      const frame = summary(samples.frame);
      return {
        capturedAt: new Date().toISOString(), fps: frame.mean ? 1000 / frame.mean : 0,
        frame, update: summary(samples.update), ecology: summary(samples.ecology),
        renderPreparation: summary(samples.prepare), canvas: summary(samples.canvas), actors: summary(samples.actors),
        longTasks: { count: longTasks, durationMs: longTaskMs },
        heap: performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize, limit: performance.memory.jsHeapSizeLimit } : null,
        ecologyPopulation: window.MH_ECO ? { motes: window.MH_ECO.motes.length, grazers: window.MH_ECO.grazers.length, predators: window.MH_ECO.predators.length, fireflies: window.MH_ECO.fireflies.length } : null,
      };
    },
    reset() { for (const values of Object.values(samples)) values.length = 0; longTasks = 0; longTaskMs = 0; },
  };
})();
