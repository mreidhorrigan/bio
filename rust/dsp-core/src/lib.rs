use js_sys::Float32Array;
use wasm_bindgen::prelude::*;

const MAX_VOICES: usize = 128;
const MAX_EVENTS: usize = 512;
const MAX_FRAMES: usize = 2048;
const SINE_TABLE_SIZE: usize = 2048;
const MAX_SPECTRA: usize = 32;
const MAX_PARTIALS: usize = 100;
const TAU: f32 = std::f32::consts::TAU;

#[wasm_bindgen]
pub fn abi_version() -> u32 {
    1
}

#[derive(Clone, Copy)]
struct Event {
    frame: u64,
    model: u8,
    frequency: f32,
    velocity: f32,
    duration: u32,
    param_a: f32,
    param_b: f32,
}
const EMPTY_EVENT: Event = Event {
    frame: 0,
    model: 0,
    frequency: 0.0,
    velocity: 0.0,
    duration: 0,
    param_a: 0.0,
    param_b: 0.0,
};

#[derive(Clone, Copy)]
struct Voice {
    active: bool,
    model: u8,
    phase: f32,
    mod_phase: f32,
    frequency: f32,
    velocity: f32,
    age: u64,
    elapsed: u32,
    duration: u32,
    release: u32,
    param_a: f32,
    param_b: f32,
    pink: f32,
    brown: f32,
    filter: f32,
}
const EMPTY_VOICE: Voice = Voice {
    active: false,
    model: 0,
    phase: 0.0,
    mod_phase: 0.0,
    frequency: 0.0,
    velocity: 0.0,
    age: 0,
    elapsed: 0,
    duration: 0,
    release: 0,
    param_a: 0.0,
    param_b: 0.0,
    pink: 0.0,
    brown: 0.0,
    filter: 0.0,
};

#[wasm_bindgen]
pub struct DspEngine {
    sample_rate: f32,
    voices: [Voice; MAX_VOICES],
    events: [Event; MAX_EVENTS],
    event_len: usize,
    frame: u64,
    age: u64,
    noise_state: u32,
    output: [f32; MAX_FRAMES],
    max_voices: usize,
    sine_table: [f32; SINE_TABLE_SIZE],
    spectrum_ratios: [[f32; MAX_PARTIALS]; MAX_SPECTRA],
    spectrum_gains: [[f32; MAX_PARTIALS]; MAX_SPECTRA],
    spectrum_lengths: [u8; MAX_SPECTRA],
}

#[wasm_bindgen]
impl DspEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32, max_voices: usize, seed: u32) -> DspEngine {
        let mut sine_table = [0.0; SINE_TABLE_SIZE];
        for (index, value) in sine_table.iter_mut().enumerate() {
            *value = (TAU * index as f32 / SINE_TABLE_SIZE as f32).sin();
        }
        DspEngine {
            sample_rate: sample_rate.max(8_000.0),
            voices: [EMPTY_VOICE; MAX_VOICES],
            events: [EMPTY_EVENT; MAX_EVENTS],
            event_len: 0,
            frame: 0,
            age: 0,
            noise_state: if seed == 0 { 0x6d2b_79f5 } else { seed },
            output: [0.0; MAX_FRAMES],
            max_voices: max_voices.clamp(1, MAX_VOICES),
            sine_table,
            spectrum_ratios: [[0.0; MAX_PARTIALS]; MAX_SPECTRA],
            spectrum_gains: [[0.0; MAX_PARTIALS]; MAX_SPECTRA],
            spectrum_lengths: [0; MAX_SPECTRA],
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn enqueue_note(
        &mut self,
        target_frame: f64,
        model: u8,
        frequency: f32,
        velocity: f32,
        duration_seconds: f32,
        param_a: f32,
        param_b: f32,
    ) -> bool {
        if self.event_len >= MAX_EVENTS || !frequency.is_finite() || frequency <= 0.0 {
            return false;
        }
        let event = Event {
            frame: target_frame.max(self.frame as f64) as u64,
            model: model.min(4),
            frequency,
            velocity: velocity.clamp(0.0, 1.0),
            duration: (duration_seconds.max(0.005) * self.sample_rate) as u32,
            param_a,
            param_b,
        };
        let mut index = self.event_len;
        while index > 0 && self.events[index - 1].frame > event.frame {
            self.events[index] = self.events[index - 1];
            index -= 1;
        }
        self.events[index] = event;
        self.event_len += 1;
        true
    }

    pub fn process(&mut self, frames: usize, destination: &Float32Array) {
        let frames = frames.min(MAX_FRAMES).min(destination.length() as usize);
        for sample_index in 0..frames {
            self.dispatch_events();
            let mut sample = 0.0;
            for voice_index in 0..self.max_voices {
                if self.voices[voice_index].active {
                    sample += self.voice_sample(voice_index);
                }
            }
            self.output[sample_index] = soft_clip(sample * 0.18);
            self.frame += 1;
        }
        destination
            .subarray(0, frames as u32)
            .copy_from(&self.output[..frames]);
    }

    pub fn active_voices(&self) -> usize {
        self.voices[..self.max_voices]
            .iter()
            .filter(|voice| voice.active)
            .count()
    }
    pub fn queued_events(&self) -> usize {
        self.event_len
    }
    pub fn current_frame(&self) -> f64 {
        self.frame as f64
    }
    pub fn set_max_voices(&mut self, count: usize) {
        self.max_voices = count.clamp(1, MAX_VOICES);
    }

    pub fn set_spectrum(&mut self, slot: usize, ratios: &Float32Array, gains: &Float32Array) {
        let slot = slot.min(MAX_SPECTRA - 1);
        let length = (ratios.length() as usize)
            .min(gains.length() as usize)
            .min(MAX_PARTIALS);
        for index in 0..length {
            self.spectrum_ratios[slot][index] = ratios.get_index(index as u32).max(0.01);
            self.spectrum_gains[slot][index] = gains.get_index(index as u32).max(0.0);
        }
        self.spectrum_lengths[slot] = length as u8;
    }

    /// Runs a short deterministic note for browser smoke tests. This is never
    /// called from the normal realtime path.
    pub fn probe_peak(&mut self) -> f32 {
        self.start_voice(Event {
            frame: self.frame,
            model: 0,
            frequency: 220.0,
            velocity: 0.5,
            duration: (self.sample_rate * 0.25) as u32,
            param_a: 0.0,
            param_b: 0.0,
        });
        let mut peak: f32 = 0.0;
        for _ in 0..128 {
            let mut sample = 0.0;
            for voice_index in 0..self.max_voices {
                if self.voices[voice_index].active {
                    sample += self.voice_sample(voice_index);
                }
            }
            peak = peak.max(soft_clip(sample * 0.18).abs());
            self.frame += 1;
        }
        peak
    }
}

impl DspEngine {
    fn dispatch_events(&mut self) {
        while self.event_len > 0 && self.events[0].frame <= self.frame {
            let event = self.events[0];
            self.events.copy_within(1..self.event_len, 0);
            self.event_len -= 1;
            self.start_voice(event);
        }
    }

    fn start_voice(&mut self, event: Event) {
        let index = self.voices[..self.max_voices]
            .iter()
            .position(|voice| !voice.active)
            .unwrap_or_else(|| {
                self.voices[..self.max_voices]
                    .iter()
                    .enumerate()
                    .min_by_key(|(_, voice)| voice.age)
                    .map(|(index, _)| index)
                    .unwrap_or(0)
            });
        self.age = self.age.wrapping_add(1);
        self.voices[index] = Voice {
            active: true,
            model: event.model,
            phase: 0.0,
            mod_phase: 0.0,
            frequency: event.frequency,
            velocity: event.velocity,
            age: self.age,
            elapsed: 0,
            duration: event.duration,
            release: (self.sample_rate * 0.08) as u32,
            param_a: event.param_a,
            param_b: event.param_b,
            pink: 0.0,
            brown: 0.0,
            filter: 0.0,
        };
    }

    fn random_bipolar(&mut self) -> f32 {
        let mut x = self.noise_state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.noise_state = x;
        (x as f32 / u32::MAX as f32) * 2.0 - 1.0
    }

    fn voice_sample(&mut self, index: usize) -> f32 {
        let mut voice = self.voices[index];
        let attack = (self.sample_rate * 0.008) as u32;
        if voice.elapsed >= voice.duration.saturating_add(voice.release) {
            self.voices[index].active = false;
            return 0.0;
        }
        let envelope = if voice.elapsed < attack {
            voice.elapsed as f32 / attack.max(1) as f32
        } else if voice.elapsed < voice.duration {
            1.0
        } else {
            1.0 - (voice.elapsed - voice.duration) as f32 / voice.release.max(1) as f32
        };
        let phase_step = TAU * voice.frequency / self.sample_rate;
        let value = match voice.model {
            1 => {
                let white = self.random_bipolar();
                voice.pink = voice.pink * 0.985 + white * 0.015;
                voice.brown = (voice.brown + white * 0.02).clamp(-1.0, 1.0) * 0.995;
                let noise = match voice.param_a.round() as i32 {
                    1 => voice.pink * 5.0,
                    2 => voice.brown * 1.8,
                    _ => white,
                };
                let cutoff = voice.param_b.clamp(20.0, self.sample_rate * 0.45);
                let coefficient = 1.0 - (-TAU * cutoff / self.sample_rate).exp();
                voice.filter += coefficient * (noise - voice.filter);
                voice.filter
            }
            2 => {
                let slot = (voice.param_a as usize).min(MAX_SPECTRA - 1);
                let partials = self.spectrum_lengths[slot] as usize;
                let mut sum = 0.0;
                let mut norm = 0.0;
                for partial in 0..partials {
                    let amplitude = self.spectrum_gains[slot][partial];
                    sum += lookup_sine(
                        &self.sine_table,
                        voice.phase * self.spectrum_ratios[slot][partial],
                    ) * amplitude;
                    norm += amplitude;
                }
                sum / norm.max(1.0)
            }
            3 => {
                let ratio = voice.param_a.clamp(0.01, 32.0);
                let index_amount = voice.param_b.clamp(0.0, 32.0);
                voice.mod_phase = (voice.mod_phase + phase_step * ratio).rem_euclid(TAU);
                lookup_sine(
                    &self.sine_table,
                    voice.phase + lookup_sine(&self.sine_table, voice.mod_phase) * index_amount,
                )
            }
            4 => {
                let feedback = voice.param_a.clamp(0.0, 0.95);
                lookup_sine(
                    &self.sine_table,
                    voice.phase + lookup_sine(&self.sine_table, voice.phase) * feedback,
                )
            }
            _ => lookup_sine(&self.sine_table, voice.phase),
        };
        voice.phase = (voice.phase + phase_step).rem_euclid(TAU);
        voice.elapsed += 1;
        voice.age = voice.age.saturating_add(1);
        self.voices[index] = voice;
        value * envelope * voice.velocity
    }
}

fn soft_clip(value: f32) -> f32 {
    value / (1.0 + value.abs())
}

fn lookup_sine(table: &[f32; SINE_TABLE_SIZE], phase: f32) -> f32 {
    let position = phase * (SINE_TABLE_SIZE as f32 / TAU);
    let floor = position.floor();
    let index = (floor as i32).rem_euclid(SINE_TABLE_SIZE as i32) as usize;
    let fraction = position - floor;
    let a = table[index];
    let b = table[(index + 1) % SINE_TABLE_SIZE];
    a + (b - a) * fraction
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn smoke_contract_is_stable() {
        assert_eq!(abi_version(), 1);
    }

    #[test]
    fn fixed_pool_steals_without_growing() {
        let mut engine = DspEngine::new(48_000.0, 16, 7);
        for note in 0..64 {
            assert!(engine.enqueue_note(0.0, 0, 110.0 + note as f32, 0.5, 1.0, 0.0, 0.0));
        }
        engine.dispatch_events();
        assert_eq!(engine.active_voices(), 16);
        assert_eq!(engine.voices.len(), MAX_VOICES);
    }

    #[test]
    fn full_pool_steals_the_oldest_voice() {
        let mut engine = DspEngine::new(48_000.0, 2, 7);
        assert!(engine.enqueue_note(0.0, 0, 110.0, 0.5, 1.0, 0.0, 0.0));
        engine.dispatch_events();
        assert!(engine.enqueue_note(0.0, 0, 220.0, 0.5, 1.0, 0.0, 0.0));
        engine.dispatch_events();
        assert!(engine.enqueue_note(0.0, 0, 330.0, 0.5, 1.0, 0.0, 0.0));
        engine.dispatch_events();
        let frequencies: Vec<_> = engine.voices[..2]
            .iter()
            .map(|voice| voice.frequency)
            .collect();
        assert!(!frequencies.contains(&110.0));
        assert!(frequencies.contains(&220.0));
        assert!(frequencies.contains(&330.0));
    }

    #[test]
    fn event_capacity_is_bounded() {
        let mut engine = DspEngine::new(48_000.0, 128, 9);
        for index in 0..MAX_EVENTS {
            assert!(engine.enqueue_note(index as f64, 3, 220.0, 0.5, 0.1, 2.0, 4.0));
        }
        assert!(!engine.enqueue_note(999.0, 0, 440.0, 1.0, 1.0, 0.0, 0.0));
    }

    #[test]
    fn render_probe_produces_signal() {
        let mut engine = DspEngine::new(48_000.0, 16, 9);
        assert!(engine.probe_peak() > 0.001);
    }
}
