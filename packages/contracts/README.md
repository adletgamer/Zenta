# Zenta Soroban Contract

Stellar Soroban smart contract for ZK payroll verification registry.

## Contract: `zenta-verifier`

Stores verification state for ZK payroll proofs on Stellar.

### Storage
- `commitment_hash → VerificationRecord { verified, period_hash, verified_at, submitter }`
- Does NOT store: operator names, salary amounts, production volumes, internal rates

### Functions
- `initialize(admin)` — set admin address (one-time)
- `verify_payroll(submitter, proof)` — verify and store proof result
- `get_verification(commitment)` — query verification by commitment hash
- `is_verified(commitment)` — check if commitment is verified
- `total_verifications()` — get total verified payrolls

### Events
- `PayrollVerified(commitment_hash, period_hash, timestamp)`

## Build

```bash
# Install Rust + wasm32 target
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install Soroban CLI
cargo install --locked stellar-cli --features opt

# Build
cargo build --target wasm32-unknown-unknown --release

# Test
cargo test
```

## Deploy to Testnet

```bash
# Setup keys
stellar keys generate zenta-deployer --network testnet
stellar keys fund zenta-deployer --network testnet

# Deploy
node scripts/deploy.js
```
