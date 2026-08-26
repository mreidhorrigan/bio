#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
manifest="$repo_dir/rust/Cargo.toml"

command -v wasm-bindgen >/dev/null 2>&1 || {
  echo "wasm-bindgen CLI is required: cargo install wasm-bindgen-cli --locked" >&2
  exit 1
}

cargo build --manifest-path "$manifest" --target wasm32-unknown-unknown --release
wasm-bindgen "$repo_dir/rust/target/wasm32-unknown-unknown/release/world_core.wasm" --target web --out-dir "$repo_dir/wasm/world" --out-name world_core
wasm-bindgen "$repo_dir/rust/target/wasm32-unknown-unknown/release/dsp_core.wasm" --target web --out-dir "$repo_dir/wasm/audio" --out-name dsp_core
node "$repo_dir/scripts/build-audio-worklet.mjs"
echo "Built browser WASM in wasm/world and wasm/audio"
