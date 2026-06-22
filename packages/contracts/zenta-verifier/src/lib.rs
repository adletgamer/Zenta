#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Bytes, BytesN, Env, Symbol};

#[contracttype]
pub enum DataKey {
    Verified(BytesN<32>),
}

#[contract]
pub struct PayrollRegistry;

#[contractimpl]
impl PayrollRegistry {
    pub fn verify_and_register(
        env: Env,
        commitment: BytesN<32>,
        period_hash: BytesN<32>,
        public_inputs: Bytes,
        pi_a: Bytes,
        pi_b: Bytes,
        pi_c: Bytes,
    ) -> bool {
        let key = DataKey::Verified(commitment.clone());

        if env.storage().persistent().has(&key) {
            panic!("commitment already verified");
        }

        // V1 MVP: offchain Groth16 verification is trusted by the backend.
        // The contract only prevents replay/double processing and publishes
        // an auditable Stellar event.
        let _ = (public_inputs, pi_a, pi_b, pi_c);
        env.storage().persistent().set(&key, &true);

        env.events().publish(
            (Symbol::new(&env, "payroll_verified"), commitment),
            period_hash,
        );

        true
    }

    pub fn is_verified(env: Env, commitment: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Verified(commitment))
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Bytes, BytesN, Env};

    #[test]
    fn registers_commitment_once() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PayrollRegistry);
        let client = PayrollRegistryClient::new(&env, &contract_id);

        let commitment = BytesN::from_array(&env, &[1u8; 32]);
        let period_hash = BytesN::from_array(&env, &[2u8; 32]);

        assert!(client.verify_and_register(
            &commitment,
            &period_hash,
            &Bytes::from_slice(&env, &[3u8; 32]),
            &Bytes::from_slice(&env, &[4u8; 64]),
            &Bytes::from_slice(&env, &[5u8; 128]),
            &Bytes::from_slice(&env, &[6u8; 64]),
        ));
        assert!(client.is_verified(&commitment));
    }

    #[test]
    #[should_panic(expected = "commitment already verified")]
    fn rejects_reused_commitment() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PayrollRegistry);
        let client = PayrollRegistryClient::new(&env, &contract_id);

        let commitment = BytesN::from_array(&env, &[7u8; 32]);
        let period_hash = BytesN::from_array(&env, &[8u8; 32]);
        let bytes = Bytes::from_slice(&env, &[0u8; 32]);

        client.verify_and_register(&commitment, &period_hash, &bytes, &bytes, &bytes, &bytes);
        client.verify_and_register(&commitment, &period_hash, &bytes, &bytes, &bytes, &bytes);
    }
}
