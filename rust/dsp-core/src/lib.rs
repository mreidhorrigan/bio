use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn abi_version() -> u32 {
    1
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn smoke_contract_is_stable() {
        assert_eq!(abi_version(), 1);
    }
}
