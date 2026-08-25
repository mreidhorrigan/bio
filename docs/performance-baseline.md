# Performance baseline

## Method

Serve the repository over HTTP and open `/?perf=1`. After at least 30 seconds of representative walking, call `MH_PERF.report()` in the console. The monitor retains a bounded sample window and reports FPS, frame p50/p95/p99, update, ecology, render preparation, Canvas rendering, actor counts, long tasks, and JS heap data where the browser exposes it.

Repeat using normal defaults and development-only ecology population multipliers of 2, 5, and 10. Normal user-facing defaults must not change. Audio captures should record active voices/nodes, nodes created per event, generated noise buffers, additive partials, simultaneous towers, and graph-construction time at the stress points specified in the migration plan.

## Environment and results

Initial Chrome static-loading smoke (2026-08-26) passed over local HTTP: the Canvas homepage initialized, `world-core` reached `ready`, ABI version 1 and the Rust call contract passed, and deliberate module failure was caught. Initial uncompressed release WASM files are approximately 18 KiB each. Repeatable runtime/scaling measurements remain pending; record browser/version, hardware, viewport, DPR, theme, duration, cold/warm load, transferred sizes, initialization time, and the complete `MH_PERF.report()` output. Do not infer performance wins from implementation language.
