use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn abi_version() -> u32 {
    1
}

#[wasm_bindgen]
pub fn smoke_add(left: i32, right: i32) -> i32 {
    left.saturating_add(right)
}

#[wasm_bindgen]
pub fn wrap(value: f64, period: f64) -> f64 {
    if !value.is_finite() || !period.is_finite() || period <= 0.0 {
        return f64::NAN;
    }
    value.rem_euclid(period)
}

#[wasm_bindgen]
pub fn wrapped_delta(delta: f64, period: f64) -> f64 {
    let value = wrap(delta, period);
    if value > period * 0.5 {
        value - period
    } else {
        value
    }
}

#[wasm_bindgen]
pub fn wrapped_distance(ax: f64, ay: f64, bx: f64, by: f64, period: f64) -> f64 {
    wrapped_delta(bx - ax, period).hypot(wrapped_delta(by - ay, period))
}

#[wasm_bindgen]
pub fn circles_overlap(ax: f64, ay: f64, ar: f64, bx: f64, by: f64, br: f64, period: f64) -> bool {
    let dx = wrapped_delta(bx - ax, period);
    let dy = wrapped_delta(by - ay, period);
    let radius = ar.max(0.0) + br.max(0.0);
    dx * dx + dy * dy < radius * radius
}

/// Small deterministic generator for fixtures and procedural systems. Production
/// callers choose their own seed; this does not replace the site's normal entropy.
#[wasm_bindgen]
pub struct SeededRng {
    state: u32,
}

#[wasm_bindgen]
impl SeededRng {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32) -> SeededRng {
        SeededRng {
            state: if seed == 0 { 0x6d2b_79f5 } else { seed },
        }
    }

    pub fn next_u32(&mut self) -> u32 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.state = x;
        x
    }

    pub fn next_f64(&mut self) -> f64 {
        self.next_u32() as f64 / (u32::MAX as f64 + 1.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn smoke_contract_is_stable() {
        assert_eq!(abi_version(), 1);
        assert_eq!(smoke_add(20, 22), 42);
    }

    #[test]
    fn toroidal_math_handles_edges() {
        assert_eq!(wrap(-1.0, 54.0), 53.0);
        assert_eq!(wrapped_delta(53.0, 54.0), -1.0);
        assert_eq!(wrapped_delta(27.0, 54.0), 27.0);
        assert!((wrapped_distance(53.0, 2.0, 1.0, 2.0, 54.0) - 2.0).abs() < 1e-12);
        assert!(circles_overlap(53.8, 2.0, 0.3, 0.1, 2.0, 0.2, 54.0));
    }

    #[test]
    fn seeded_rng_repeats_and_stays_bounded() {
        let mut left = SeededRng::new(42);
        let mut right = SeededRng::new(42);
        for _ in 0..128 {
            assert_eq!(left.next_u32(), right.next_u32());
        }
        for _ in 0..128 {
            let value = left.next_f64();
            assert!((0.0..1.0).contains(&value));
        }
    }
}
