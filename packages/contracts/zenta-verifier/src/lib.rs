//! Zenta Payroll Verification Registry
//!
//! Stellar Soroban smart contract that stores the verification state
//! of ZK payroll proofs. It does NOT store sensitive payroll data.
//!
//! Storage model:
//!   commitment_hash => VerificationRecord {
//!     verified: bool,
//!     period_hash: BytesN<32>,
//!     verified_at: u64 (ledger timestamp),
//!     submitter: Address
//!   }
//!
//! Key principles:
//! - Commitments are unique (cannot be reused)
//! - Only verified=true records can be queried
//! - Emits PayrollVerified event on successful verification
//! - Private payroll data stays off-chain entirely

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Bytes, BytesN, Env, Symbol, Vec, log,
    symbol_short,
};

// ---- Data Types ----------------------------------------------------

/// On-chain verification record (public data only)
#[contracttype]
#[derive(Clone)]
pub struct VerificationRecord {
    /// Whether this commitment has been verified
    pub verified: bool,
    /// The payroll period hash (identifies which period)
    pub period_hash: BytesN<32>,
    /// Ledger timestamp when verified
    pub verified_at: u64,
    /// Address that submitted the verification
    pub submitter: Address,
    /// Human-readable status
    pub status: Symbol,
}

/// Input for proof verification
#[contracttype]
#[derive(Clone)]
pub struct ProofInput {
    /// Commitment hash (Poseidon hash of private payroll inputs)
    pub commitment: BytesN<32>,
    /// Period hash (identifies payroll period)
    pub period_hash: BytesN<32>,
    /// Groth16 proof pi_a (G1 point, 64 bytes)
    pub pi_a: Bytes,
    /// Groth16 proof pi_b (G2 point, 128 bytes)
    pub pi_b: Bytes,
    /// Groth16 proof pi_c (G1 point, 64 bytes)
    pub pi_c: Bytes,
    /// Public signals as bytes
    pub public_signals: Bytes,
}

// ---- Storage Keys --------------------------------------------------

#[contracttype]
pub enum DataKey {
    /// Verification record for a commitment hash
    Verification(BytesN<32>),
    /// Admin address
    Admin,
    /// Total verifications count
    TotalVerifications,
}

// ---- Contract ------------------------------------------------------

#[contract]
pub struct ZentaVerifier;

#[contractimpl]
impl ZentaVerifier {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) {
        // Can only initialize once
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalVerifications, &0u64);
        log!(&env, "Zenta Verifier initialized by: {}", admin);
    }

    /// Verify a payroll proof and store the verification state.
    ///
    /// In this MVP implementation, the contract accepts the proof
    /// and emits a verification event. Full on-chain Groth16 verification
    /// requires a pairing check which is planned for Phase 4.
    ///
    /// The contract ensures:
    /// 1. Commitment has not been used before (prevents replay)
    /// 2. Submitter is authenticated (via Address::require_auth)
    /// 3. Verification record is stored immutably
    /// 4. PayrollVerified event is emitted
    pub fn verify_payroll(env: Env, submitter: Address, proof: ProofInput) -> bool {
        // Require submitter authentication
        submitter.require_auth();

        // Check for commitment reuse (replay protection)
        let key = DataKey::Verification(proof.commitment.clone());
        if env.storage().persistent().has(&key) {
            panic!("Commitment already used — replay protection triggered");
        }

        // MVP: Accept the proof (full on-chain Groth16 pairing check in Phase 4)
        // The ZK proof is verified off-chain by the API before submission
        let verified = true;

        if verified {
            // Store verification record
            let record = VerificationRecord {
                verified: true,
                period_hash: proof.period_hash.clone(),
                verified_at: env.ledger().timestamp(),
                submitter: submitter.clone(),
                status: symbol_short!("VERIFIED"),
            };

            env.storage().persistent().set(&key, &record);

            // Increment total count
            let total: u64 = env.storage().instance()
                .get(&DataKey::TotalVerifications)
                .unwrap_or(0);
            env.storage().instance().set(&DataKey::TotalVerifications, &(total + 1));

            // Emit PayrollVerified event
            // Topics: ["payroll_verified", commitment_hash]
            // Data: [period_hash, timestamp, submitter]
            env.events().publish(
                (symbol_short!("payroll"), symbol_short!("verified"), proof.commitment.clone()),
                (proof.period_hash, env.ledger().timestamp()),
            );

            log!(&env, "Payroll verified. Total: {}", total + 1);
        }

        verified
    }

    /// Query verification status for a commitment hash
    pub fn get_verification(env: Env, commitment: BytesN<32>) -> Option<VerificationRecord> {
        let key = DataKey::Verification(commitment);
        env.storage().persistent().get(&key)
    }

    /// Check if a commitment has been verified
    pub fn is_verified(env: Env, commitment: BytesN<32>) -> bool {
        let key = DataKey::Verification(commitment);
        env.storage().persistent().has(&key)
    }

    /// Get total number of verified payrolls
    pub fn total_verifications(env: Env) -> u64 {
        env.storage().instance()
            .get(&DataKey::TotalVerifications)
            .unwrap_or(0)
    }

    /// Get the admin address
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }
}

// ---- Tests ---------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};
    use soroban_sdk::{vec, Env};

    #[test]
    fn test_initialize_and_verify() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ZentaVerifier);
        let client = ZentaVerifierClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let submitter = Address::generate(&env);

        // Initialize
        client.initialize(&admin);
        assert_eq!(client.get_admin(), Some(admin.clone()));

        // Create a test proof
        let commitment = BytesN::from_array(&env, &[1u8; 32]);
        let period_hash = BytesN::from_array(&env, &[2u8; 32]);
        let proof = ProofInput {
            commitment: commitment.clone(),
            period_hash,
            pi_a: Bytes::from_slice(&env, &[0u8; 64]),
            pi_b: Bytes::from_slice(&env, &[0u8; 128]),
            pi_c: Bytes::from_slice(&env, &[0u8; 64]),
            public_signals: Bytes::from_slice(&env, &[0u8; 32]),
        };

        // Verify
        let result = client.verify_payroll(&submitter, &proof);
        assert!(result);

        // Check storage
        assert!(client.is_verified(&commitment));
        assert_eq!(client.total_verifications(), 1);

        let record = client.get_verification(&commitment);
        assert!(record.is_some());
        assert!(record.unwrap().verified);
    }

    #[test]
    #[should_panic(expected = "Commitment already used")]
    fn test_replay_protection() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ZentaVerifier);
        let client = ZentaVerifierClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let submitter = Address::generate(&env);
        client.initialize(&admin);

        let commitment = BytesN::from_array(&env, &[42u8; 32]);
        let period_hash = BytesN::from_array(&env, &[99u8; 32]);
        let proof = ProofInput {
            commitment: commitment.clone(),
            period_hash: period_hash.clone(),
            pi_a: Bytes::from_slice(&env, &[0u8; 64]),
            pi_b: Bytes::from_slice(&env, &[0u8; 128]),
            pi_c: Bytes::from_slice(&env, &[0u8; 64]),
            public_signals: Bytes::from_slice(&env, &[0u8; 32]),
        };

        // First call succeeds
        client.verify_payroll(&submitter, &proof);

        // Second call with same commitment should panic
        let proof2 = ProofInput {
            commitment,
            period_hash,
            pi_a: Bytes::from_slice(&env, &[0u8; 64]),
            pi_b: Bytes::from_slice(&env, &[0u8; 128]),
            pi_c: Bytes::from_slice(&env, &[0u8; 64]),
            public_signals: Bytes::from_slice(&env, &[0u8; 32]),
        };
        client.verify_payroll(&submitter, &proof2);
    }
}
