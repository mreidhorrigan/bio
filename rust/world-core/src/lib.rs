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

const RECORD_WIDTH: usize = 10;
const TAU: f32 = std::f32::consts::TAU;

#[derive(Clone, Copy)]
struct Entity {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    energy: f32,
    kind: u8,
    alive: bool,
    phase: f32,
    rest: f32,
    dormant: bool,
    eat: f32,
    seed: f32,
    prey: i32,
}

#[derive(Clone, Copy)]
struct Birth {
    kind: u8,
    x: f32,
    y: f32,
    energy: f32,
}

/// Authoritative, allocation-bounded ecology state. Browser input enters once per
/// step and render state leaves as one packed Float32Array-compatible buffer.
#[wasm_bindgen]
pub struct WorldCore {
    period: f32,
    rng: SeededRng,
    entities: Vec<Entity>,
    flora: Vec<f32>,
    flora_next: Vec<f32>,
    fear: Vec<f32>,
    fear_next: Vec<f32>,
    accumulator: f32,
    flora_accumulator: f32,
    render: Vec<f32>,
    snapshot: Vec<Entity>,
    births: Vec<Birth>,
    grazer_cap: usize,
    predator_cap: usize,
    predator_dormant: bool,
    mote_speed: f32,
    grazer_speed: f32,
    predator_speed: f32,
    firefly_speed: f32,
    turn: f32,
    curiosity: f32,
    initial_grazers: usize,
    initial_predators: usize,
    hub_x: f32,
    hub_y: f32,
    village_radius: f32,
}

#[wasm_bindgen]
impl WorldCore {
    #[wasm_bindgen(constructor)]
    pub fn new(
        period: u32,
        seed: u32,
        motes: u32,
        grazers: u32,
        predators: u32,
        fireflies: u32,
    ) -> WorldCore {
        let period = period.max(1) as f32;
        let mut world = WorldCore {
            period,
            rng: SeededRng::new(seed),
            entities: Vec::with_capacity((motes + grazers + predators + fireflies + 128) as usize),
            flora: vec![0.0; period as usize * period as usize],
            flora_next: vec![0.0; period as usize * period as usize],
            fear: vec![0.0; period as usize * period as usize],
            fear_next: vec![0.0; period as usize * period as usize],
            accumulator: 0.0,
            flora_accumulator: 0.0,
            render: Vec::with_capacity(
                (motes + grazers + predators + fireflies + 128) as usize * RECORD_WIDTH,
            ),
            snapshot: Vec::with_capacity((motes + grazers + predators + fireflies + 128) as usize),
            births: Vec::with_capacity(16),
            grazer_cap: (grazers.max(2) * 3) as usize,
            predator_cap: (predators.max(2) * 3) as usize,
            predator_dormant: false,
            mote_speed: 1.5,
            grazer_speed: 1.0,
            predator_speed: 1.25,
            firefly_speed: 0.6,
            turn: 0.16,
            curiosity: 0.8,
            initial_grazers: grazers as usize,
            initial_predators: predators as usize,
            hub_x: period * 0.5,
            hub_y: period * 0.5,
            village_radius: 5.5,
        };
        for value in &mut world.flora {
            *value = 0.25 + world.rng.next_f64() as f32 * 0.75;
        }
        for _ in 0..motes {
            world.spawn(0, 1.0);
        }
        for _ in 0..grazers {
            world.spawn(1, 1.0);
        }
        for _ in 0..predators {
            world.spawn(2, 1.4);
        }
        for _ in 0..fireflies {
            world.spawn(3, 1.0);
        }
        world.pack_render();
        world
    }

    pub fn step(&mut self, dt: f32, player_x: f32, player_y: f32) {
        let dt = dt.clamp(0.0, 0.05);
        for entity in &mut self.entities {
            if entity.dormant {
                continue;
            }
            entity.x = (entity.x + entity.vx * dt).rem_euclid(self.period);
            entity.y = (entity.y + entity.vy * dt).rem_euclid(self.period);
        }
        self.accumulator += dt;
        let sim_dt = 1.0 / 6.0;
        let mut guard = 4;
        while self.accumulator >= sim_dt && guard > 0 {
            self.accumulator -= sim_dt;
            self.think(sim_dt, player_x, player_y);
            guard -= 1;
        }
        self.flora_accumulator += dt;
        let flora_dt = 1.0 / 3.0;
        if self.flora_accumulator >= flora_dt {
            self.flora_accumulator -= flora_dt;
            self.step_flora(flora_dt);
        }
        self.pack_render();
    }

    pub fn render_ptr(&self) -> *const f32 {
        self.render.as_ptr()
    }
    pub fn render_len(&self) -> usize {
        self.render.len()
    }
    pub fn render_snapshot(&self) -> Vec<f32> {
        self.render.clone()
    }
    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }
    pub fn flora_ptr(&self) -> *const f32 {
        self.flora.as_ptr()
    }
    pub fn flora_len(&self) -> usize {
        self.flora.len()
    }
    pub fn flora_snapshot(&self) -> Vec<f32> {
        self.flora.clone()
    }

    pub fn population(&self, kind: u8) -> usize {
        self.entities
            .iter()
            .filter(|entity| entity.kind == kind && entity.alive)
            .count()
    }

    #[allow(clippy::too_many_arguments)]
    pub fn configure(
        &mut self,
        grazer_cap: u32,
        predator_cap: u32,
        predator_dormant: bool,
        mote_speed: f32,
        grazer_speed: f32,
        predator_speed: f32,
        firefly_speed: f32,
        turn: f32,
        curiosity: f32,
        hub_x: f32,
        hub_y: f32,
        village_radius: f32,
    ) {
        self.grazer_cap = grazer_cap.max(1) as usize;
        self.predator_cap = predator_cap.max(1) as usize;
        self.predator_dormant = predator_dormant;
        self.mote_speed = mote_speed.max(0.0);
        self.grazer_speed = grazer_speed.max(0.0);
        self.predator_speed = predator_speed.max(0.0);
        self.firefly_speed = firefly_speed.max(0.0);
        self.turn = turn.clamp(0.01, 1.0);
        self.curiosity = curiosity.max(0.0);
        self.hub_x = hub_x;
        self.hub_y = hub_y;
        self.village_radius = village_radius;
        let mut grazer_index = 0;
        for index in 0..self.entities.len() {
            let kind = self.entities[index].kind;
            let speed = self.speed(kind);
            let magnitude = self.entities[index]
                .vx
                .hypot(self.entities[index].vy)
                .max(0.0001);
            self.entities[index].vx = self.entities[index].vx / magnitude * speed;
            self.entities[index].vy = self.entities[index].vy / magnitude * speed;
            if kind == 1 {
                if grazer_index & 1 == 1 {
                    let angle = self.random(0.0, TAU);
                    let distance = self.random(village_radius, village_radius + 12.0);
                    self.entities[index].x =
                        (hub_x + angle.cos() * distance).rem_euclid(self.period);
                    self.entities[index].y =
                        (hub_y + angle.sin() * distance).rem_euclid(self.period);
                }
                grazer_index += 1;
            } else if kind == 2 {
                let angle = self.random(0.0, TAU);
                let distance = self.random(village_radius + 1.0, village_radius + 9.0);
                self.entities[index].x = (hub_x + angle.cos() * distance).rem_euclid(self.period);
                self.entities[index].y = (hub_y + angle.sin() * distance).rem_euclid(self.period);
                self.entities[index].dormant = predator_dormant;
                if predator_dormant {
                    self.entities[index].vx = 0.0;
                    self.entities[index].vy = 0.0;
                }
            }
        }
        self.pack_render();
    }
}

impl WorldCore {
    fn speed(&self, kind: u8) -> f32 {
        match kind {
            0 => self.mote_speed,
            1 => self.grazer_speed,
            2 => self.predator_speed,
            _ => self.firefly_speed,
        }
    }

    fn random(&mut self, low: f32, high: f32) -> f32 {
        low + self.rng.next_f64() as f32 * (high - low)
    }

    fn spawn(&mut self, kind: u8, energy: f32) {
        let angle = self.random(0.0, TAU);
        let x = self.random(0.0, self.period);
        let y = self.random(0.0, self.period);
        self.spawn_at(kind, energy, x, y, angle);
    }

    fn spawn_at(&mut self, kind: u8, energy: f32, x: f32, y: f32, angle: f32) {
        let phase = self.random(0.0, TAU);
        let speed = self.speed(kind);
        self.entities.push(Entity {
            x: x.rem_euclid(self.period),
            y: y.rem_euclid(self.period),
            vx: angle.cos() * speed,
            vy: angle.sin() * speed,
            energy,
            kind,
            alive: true,
            phase,
            rest: 0.0,
            dormant: kind == 2 && self.predator_dormant,
            eat: 0.0,
            seed: 0.0,
            prey: -1,
        });
    }

    fn delta(period: f32, value: f32) -> f32 {
        let wrapped = value.rem_euclid(period);
        if wrapped > period * 0.5 {
            wrapped - period
        } else {
            wrapped
        }
    }

    fn flora_index(period: usize, x: f32, y: f32) -> usize {
        (y.floor() as i32).rem_euclid(period as i32) as usize * period
            + (x.floor() as i32).rem_euclid(period as i32) as usize
    }

    fn steer(entity: &mut Entity, dx: f32, dy: f32, speed: f32, turn: f32) {
        let magnitude = dx.hypot(dy).max(0.0001);
        entity.vx += (dx / magnitude * speed - entity.vx) * turn;
        entity.vy += (dy / magnitude * speed - entity.vy) * turn;
    }

    fn think(&mut self, dt: f32, player_x: f32, player_y: f32) {
        let mut snapshot = std::mem::take(&mut self.snapshot);
        snapshot.clear();
        snapshot.extend_from_slice(&self.entities);
        let period = self.period;
        let mut births = std::mem::take(&mut self.births);
        births.clear();
        let grazer_count = snapshot
            .iter()
            .filter(|entity| entity.kind == 1 && entity.alive)
            .count();
        let predator_count = snapshot
            .iter()
            .filter(|entity| entity.kind == 2 && entity.alive)
            .count();
        let mut grazer_births = 0;
        let mut predator_births = 0;
        for index in 0..self.entities.len() {
            if !self.entities[index].alive {
                continue;
            }
            let current = snapshot[index];
            let mut dx = current.vx + self.random(-0.25, 0.25);
            let mut dy = current.vy + self.random(-0.25, 0.25);
            let pdx = Self::delta(period, player_x - current.x);
            let pdy = Self::delta(period, player_y - current.y);
            let player_distance = pdx.hypot(pdy).max(0.001);
            let mut speed = self.speed(current.kind);
            match current.kind {
                0 => {
                    let mut separation_x = 0.0;
                    let mut separation_y = 0.0;
                    let mut alignment_x = 0.0;
                    let mut alignment_y = 0.0;
                    let mut cohesion_x = 0.0;
                    let mut cohesion_y = 0.0;
                    let mut neighbours = 0.0;
                    for other in &snapshot {
                        if other.kind != 0 || (other.x == current.x && other.y == current.y) {
                            continue;
                        }
                        let ox = Self::delta(period, other.x - current.x);
                        let oy = Self::delta(period, other.y - current.y);
                        let distance = ox.hypot(oy);
                        if distance >= 3.0 {
                            continue;
                        }
                        if distance < 1.3 && distance > 0.0001 {
                            separation_x -= ox / distance;
                            separation_y -= oy / distance;
                        }
                        alignment_x += other.vx;
                        alignment_y += other.vy;
                        cohesion_x += ox;
                        cohesion_y += oy;
                        neighbours += 1.0;
                    }
                    if neighbours > 0.0 {
                        dx += separation_x * 1.6
                            + alignment_x / neighbours * 0.6
                            + cohesion_x / neighbours * 0.25;
                        dy += separation_y * 1.6
                            + alignment_y / neighbours * 0.6
                            + cohesion_y / neighbours * 0.25;
                    }
                    if player_distance < 1.5 {
                        dx -= pdx / player_distance;
                        dy -= pdy / player_distance;
                    } else if player_distance < 7.0 {
                        dx += pdx / player_distance * 0.5 * self.curiosity;
                        dy += pdy / player_distance * 0.5 * self.curiosity;
                    }
                }
                3 => {
                    dx += self.random(-0.15, 0.15);
                    dy += self.random(-0.15, 0.15);
                    if player_distance < 6.0 {
                        dx += pdx / player_distance * 0.3 * self.curiosity;
                        dy += pdy / player_distance * 0.3 * self.curiosity;
                    }
                }
                1 => {
                    let fi = Self::flora_index(period as usize, current.x, current.y);
                    let here = self.flora[fi];
                    let here_fear = self.fear[fi];
                    for (ox, oy) in [(1.0, 0.0), (-1.0, 0.0), (0.0, 1.0), (0.0, -1.0)] {
                        let neighbour = Self::flora_index(
                            period as usize,
                            current.x + ox * 1.5,
                            current.y + oy * 1.5,
                        );
                        dx += ox
                            * ((self.flora[neighbour] - here)
                                - (self.fear[neighbour] - here_fear) * 2.2);
                        dy += oy
                            * ((self.flora[neighbour] - here)
                                - (self.fear[neighbour] - here_fear) * 2.2);
                    }
                    let eaten = self.flora[fi].min(0.9 * dt);
                    self.flora[fi] -= eaten;
                    self.entities[index].energy += eaten * 1.4 - 0.16 * dt;
                    self.entities[index].seed += eaten * 0.4;
                    let drop = self.entities[index].seed.min(0.16 * dt);
                    self.flora[fi] = (self.flora[fi] + drop).min(1.0);
                    self.entities[index].seed -= drop;
                    let mut nearest_predator = None;
                    let mut nearest_distance = 2.2;
                    for other in &snapshot {
                        if other.kind != 2 || !other.alive {
                            continue;
                        }
                        let ox = Self::delta(period, other.x - current.x);
                        let oy = Self::delta(period, other.y - current.y);
                        let distance = ox.hypot(oy);
                        if distance < nearest_distance {
                            nearest_predator = Some((ox, oy));
                            nearest_distance = distance;
                        }
                    }
                    if let Some((ox, oy)) = nearest_predator {
                        dx -= ox * 2.4;
                        dy -= oy * 2.4;
                    }
                    if current.rest <= 0.0 && self.random(0.0, 1.0) < 0.18 * dt {
                        self.entities[index].rest = self.random(1.5, 4.0);
                    }
                    if self.entities[index].energy > 1.7
                        && grazer_count + grazer_births < self.grazer_cap
                    {
                        self.entities[index].energy *= 0.5;
                        births.push(Birth {
                            kind: 1,
                            x: current.x,
                            y: current.y,
                            energy: self.entities[index].energy,
                        });
                        grazer_births += 1;
                    }
                    if self.entities[index].energy <= 0.0 {
                        self.entities[index].alive = false;
                    }
                }
                2 => {
                    if current.dormant {
                        continue;
                    }
                    let fear_index = Self::flora_index(period as usize, current.x, current.y);
                    self.fear[fear_index] = 1.0;
                    self.entities[index].prey = -1;
                    self.entities[index].energy -= 0.14 * dt;
                    self.entities[index].eat = (self.entities[index].eat - dt).max(0.0);
                    let mut prey_index = None;
                    let mut prey_distance = 7.0;
                    for (other_index, other) in snapshot.iter().enumerate() {
                        if other.kind != 1 || !other.alive {
                            continue;
                        }
                        let ox = Self::delta(period, other.x - current.x);
                        let oy = Self::delta(period, other.y - current.y);
                        let distance = ox.hypot(oy);
                        if distance < prey_distance {
                            prey_index = Some((other_index, ox, oy));
                            prey_distance = distance;
                        }
                    }
                    if let Some((other_index, ox, oy)) = prey_index {
                        self.entities[index].prey = other_index as i32;
                        dx = ox;
                        dy = oy;
                        if prey_distance < 0.55 {
                            speed *= 1.5;
                        }
                        if prey_distance < 0.16 && other_index < self.entities.len() {
                            self.entities[other_index].alive = false;
                            self.entities[index].energy += 2.2;
                            self.entities[index].eat = 0.4;
                        }
                    } else if current.rest <= 0.0 && self.random(0.0, 1.0) < 0.18 * 0.4 * dt {
                        self.entities[index].rest = self.random(2.0, 5.0);
                    }
                    if self.entities[index].energy > 2.6
                        && predator_count + predator_births < self.predator_cap
                    {
                        self.entities[index].energy *= 0.5;
                        births.push(Birth {
                            kind: 2,
                            x: current.x,
                            y: current.y,
                            energy: self.entities[index].energy,
                        });
                        predator_births += 1;
                    }
                    if self.entities[index].energy <= 0.0 {
                        self.entities[index].alive = false;
                    }
                    let hx = Self::delta(period, current.x - self.hub_x);
                    let hy = Self::delta(period, current.y - self.hub_y);
                    let hub_distance = hx.hypot(hy);
                    if hub_distance < self.village_radius && hub_distance > 0.0001 {
                        self.entities[index].x = (self.hub_x
                            + hx / hub_distance * self.village_radius)
                            .rem_euclid(period);
                        self.entities[index].y = (self.hub_y
                            + hy / hub_distance * self.village_radius)
                            .rem_euclid(period);
                        dx += hx / hub_distance * 7.0;
                        dy += hy / hub_distance * 7.0;
                    }
                }
                _ => {}
            }
            if self.entities[index].rest > 0.0 {
                self.entities[index].rest -= dt;
                Self::steer(&mut self.entities[index], 0.0, 0.0, 0.0, self.turn);
            } else {
                Self::steer(&mut self.entities[index], dx, dy, speed, self.turn);
            }
        }
        self.resolve_collisions();
        self.entities.retain(|entity| entity.alive);
        for birth in &births {
            let angle = self.random(0.0, TAU);
            self.spawn_at(birth.kind, birth.energy, birth.x, birth.y, angle);
        }
        if self.population(1) < (self.initial_grazers as f32 * 0.12).max(2.0) as usize
            && self.random(0.0, 1.0) < 0.5
        {
            let angle = self.random(0.0, TAU);
            let distance = self.random(22.0, 31.0);
            self.spawn_at(
                1,
                1.0,
                player_x + angle.cos() * distance,
                player_y + angle.sin() * distance,
                angle,
            );
        }
        if self.initial_predators > 0
            && !self.predator_dormant
            && self.population(2) < (self.initial_predators as f32 * 0.5).max(2.0) as usize
            && self.random(0.0, 1.0) < 0.4
        {
            let angle = self.random(0.0, TAU);
            let distance = self.random(16.0, 22.0);
            self.spawn_at(
                2,
                1.4,
                player_x + angle.cos() * distance,
                player_y + angle.sin() * distance,
                angle,
            );
        }
        self.snapshot = snapshot;
        self.births = births;
    }

    fn resolve_collisions(&mut self) {
        const PREDATOR_RADIUS: f32 = 0.4;
        const PREY_RADIUS: f32 = 0.18;
        let contact = PREDATOR_RADIUS + PREY_RADIUS;
        for predator in 0..self.entities.len() {
            if self.entities[predator].kind != 2
                || self.entities[predator].dormant
                || !self.entities[predator].alive
            {
                continue;
            }
            for prey in 0..self.entities.len() {
                if self.entities[prey].kind != 1 || !self.entities[prey].alive {
                    continue;
                }
                if self.entities[predator].prey == prey as i32 {
                    continue;
                }
                let dx = Self::delta(
                    self.period,
                    self.entities[prey].x - self.entities[predator].x,
                );
                let dy = Self::delta(
                    self.period,
                    self.entities[prey].y - self.entities[predator].y,
                );
                let distance = dx.hypot(dy);
                if distance <= 0.0001 || distance >= contact {
                    continue;
                }
                let overlap = contact - distance;
                let nx = dx / distance;
                let ny = dy / distance;
                self.entities[predator].x = (self.entities[predator].x
                    - nx * overlap * PREY_RADIUS / contact)
                    .rem_euclid(self.period);
                self.entities[predator].y = (self.entities[predator].y
                    - ny * overlap * PREY_RADIUS / contact)
                    .rem_euclid(self.period);
                self.entities[prey].x = (self.entities[prey].x
                    + nx * overlap * PREDATOR_RADIUS / contact)
                    .rem_euclid(self.period);
                self.entities[prey].y = (self.entities[prey].y
                    + ny * overlap * PREDATOR_RADIUS / contact)
                    .rem_euclid(self.period);
            }
        }
        let contact = PREDATOR_RADIUS * 2.0;
        for left in 0..self.entities.len() {
            if self.entities[left].kind != 2
                || self.entities[left].dormant
                || !self.entities[left].alive
            {
                continue;
            }
            for right in left + 1..self.entities.len() {
                if self.entities[right].kind != 2
                    || self.entities[right].dormant
                    || !self.entities[right].alive
                {
                    continue;
                }
                let dx = Self::delta(self.period, self.entities[right].x - self.entities[left].x);
                let dy = Self::delta(self.period, self.entities[right].y - self.entities[left].y);
                let distance = dx.hypot(dy);
                if distance <= 0.0001 || distance >= contact {
                    continue;
                }
                let overlap = (contact - distance) * 0.5;
                let nx = dx / distance;
                let ny = dy / distance;
                self.entities[left].x =
                    (self.entities[left].x - nx * overlap).rem_euclid(self.period);
                self.entities[left].y =
                    (self.entities[left].y - ny * overlap).rem_euclid(self.period);
                self.entities[right].x =
                    (self.entities[right].x + nx * overlap).rem_euclid(self.period);
                self.entities[right].y =
                    (self.entities[right].y + ny * overlap).rem_euclid(self.period);
            }
        }
    }

    fn step_flora(&mut self, dt: f32) {
        let period = self.period as usize;
        for y in 0..period {
            for x in 0..period {
                let index = y * period + x;
                let up = (y + period - 1) % period * period + x;
                let down = (y + 1) % period * period + x;
                let left = y * period + (x + period - 1) % period;
                let right = y * period + (x + 1) % period;
                let neighbours =
                    (self.flora[up] + self.flora[down] + self.flora[left] + self.flora[right])
                        * 0.25;
                let value = self.flora[index]
                    + dt * 0.9 * (1.0 - self.flora[index]) * (0.12 + 0.6 * neighbours);
                self.flora_next[index] = value.clamp(0.0, 1.0);
                let fear_neighbours =
                    (self.fear[up] + self.fear[down] + self.fear[left] + self.fear[right]) * 0.25;
                self.fear_next[index] = self.fear[index] * 0.8 + fear_neighbours * 0.06;
            }
        }
        std::mem::swap(&mut self.flora, &mut self.flora_next);
        std::mem::swap(&mut self.fear, &mut self.fear_next);
    }

    fn pack_render(&mut self) {
        self.render.clear();
        for entity in &self.entities {
            self.render.extend_from_slice(&[
                entity.x,
                entity.y,
                entity.vx,
                entity.vy,
                entity.energy,
                entity.kind as f32,
                entity.phase,
                entity.rest,
                u8::from(entity.dormant) as f32,
                entity.eat,
            ]);
        }
    }
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

    #[test]
    fn world_step_preserves_bounds_and_packed_contract() {
        let mut world = WorldCore::new(54, 7, 70, 24, 5, 3);
        for _ in 0..600 {
            world.step(1.0 / 60.0, 27.0, 27.0);
        }
        assert_eq!(world.render_len(), world.entity_count() * RECORD_WIDTH);
        assert_eq!(world.flora_len(), 54 * 54);
        assert!(world.entities.iter().all(|entity| entity.x >= 0.0
            && entity.x < 54.0
            && entity.y >= 0.0
            && entity.y < 54.0));
        assert!(world.flora.iter().all(|value| (0.0..=1.0).contains(value)));
        assert!(world.population(1) <= world.grazer_cap);
        assert!(world.population(2) <= world.predator_cap);
    }

    #[test]
    fn configuration_preserves_caps_and_dormant_predators() {
        let mut world = WorldCore::new(54, 11, 0, 24, 5, 0);
        world.configure(
            70, 14, true, 1.5, 0.95, 1.25, 0.6, 0.16, 0.8, 27.0, 27.0, 5.5,
        );
        let positions: Vec<_> = world
            .entities
            .iter()
            .filter(|entity| entity.kind == 2)
            .map(|entity| (entity.x, entity.y))
            .collect();
        assert!(world
            .entities
            .iter()
            .filter(|entity| entity.kind == 2)
            .all(|entity| entity.dormant && entity.vx == 0.0 && entity.vy == 0.0));
        world.step(1.0, 27.0, 27.0);
        let after: Vec<_> = world
            .entities
            .iter()
            .filter(|entity| entity.kind == 2)
            .map(|entity| (entity.x, entity.y))
            .collect();
        assert_eq!(positions, after);
        assert_eq!(world.grazer_cap, 70);
        assert_eq!(world.predator_cap, 14);
    }
}
