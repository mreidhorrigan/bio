# Performance baseline

## Method

Serve the repository over HTTP and open `/?perf=1`. After at least 30 seconds of representative walking, call `MH_PERF.report()` in the console. The monitor retains a bounded sample window and reports FPS, frame p50/p95/p99, update, ecology, render preparation, Canvas rendering, actor counts, long tasks, and JS heap data where the browser exposes it.

Repeat using normal defaults and development-only ecology population multipliers of 2, 5, and 10. Normal user-facing defaults must not change. Audio captures should record active voices/nodes, nodes created per event, generated noise buffers, additive partials, simultaneous towers, and graph-construction time at the stress points specified in the migration plan.

## Results — 2026-08-26

Chrome headless on this Apple-silicon Mac, Technurture theme, 2-second warm samples. All cases held 60 FPS; short samples are useful for comparative CPU headroom, not long-run ecological population curves.

| Scale | Path | Ecology mean / p95 / p99 ms | Frame p95 / p99 ms |
|---:|---|---:|---:|
| 1× | legacy JS | 0.040 / 0.20 / 0.30 | 16.70 / 16.80 |
| 2× | legacy JS | 0.056 / 0.20 / 0.50 | 16.80 / 17.40 |
| 5× | legacy JS | 0.104 / 0.60 / 1.20 | 16.80 / 17.10 |
| 10× | legacy JS | 0.157 / 1.00 / 1.60 | 16.80 / 17.10 |
| 1× | WASM Worker, main-thread cost | 0.011 / 0.10 / 0.10 | 16.80 / 17.10 |
| 2× | WASM Worker, main-thread cost | 0.014 / 0.10 / 0.10 | 16.80 / 17.30 |
| 5× | WASM Worker, main-thread cost | 0.017 / 0.10 / 0.10 | 17.00 / 17.60 |
| 10× | WASM Worker, main-thread cost | 0.021 / 0.10 / 0.10 | 17.00 / 17.50 |

A later 10× parity run (300 starting grazers, 60 dormant predators) measured Worker compute mean 0.115 ms, p95 1.20 ms, p99 1.30 ms; main-thread ecology mean remained 0.021 ms. Canvas averaged 0.85 ms and is now the material main-thread cost. No long tasks occurred. This satisfies the stop condition against porting ordinary Canvas painting.

The worst active-ecology case—Technoscure at 10× with roughly 200 starting grazers, 90 active predators, and 420 fireflies—also held 60 FPS. Worker compute mean/p95/p99 was 0.23/2.5/3.0 ms while Canvas mean/p95/p99 was 6.08/6.5/6.9 ms. Main-thread ecology orchestration p99 remained 0.1 ms and no long tasks occurred.

DSP benchmark renders one second of 48 kHz audio through release WASM in Node 26 on arm64. Ordinary sine load was 0.51%, 0.71%, 1.39%, and 2.73% of realtime for 16/32/64/128 voices. Sixteen simultaneous additive voices used 0.71%, 1.70%, 3.44%, and 6.38% for 5/20/50/100 partial spectra. This is ample measured headroom without changing public musical defaults.

Release transfer sizes: world WASM 51 KiB raw / 21,557 bytes gzip; DSP WASM 73 KiB raw / 28,005 bytes gzip. Audio remains lazy-loaded. Chrome and Firefox pass HTTP, Worker, packed-buffer, deliberate fallback, user-gesture, AudioWorklet, and nonzero DSP smoke checks. Matt manually validated `index.html` in Safari on 2026-08-26 and reported that it seemed solid; Safari's persistent remote-automation setting was not changed.
