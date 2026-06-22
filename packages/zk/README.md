# Zenta ZK Package

Groth16 payroll verification circuits using Circom 2.x and snarkjs.

## Circuit: `payroll.circom`

Proves: `payment = pairs × rate + bonus − penalty`

Private inputs: operator code hash, processed pairs, rate, bonus, penalty, payment, nonce
Public inputs: commitment hash, period hash

## Setup

### Prerequisites

```bash
# Install Circom 2.x
curl -LSfs https://www.shiroka.io/circom-install.sh | bash
# or build from source: https://docs.circom.io/getting-started/installation/

# Install snarkjs
npm install -g snarkjs
```

### Compile Circuit

```bash
npm run compile
# This runs:
# circom circuits/payroll.circom --r1cs --wasm --sym --output build
```

### Trusted Setup (Groth16 Phase 2)

```bash
npm run setup
# Downloads Powers of Tau, generates proving/verification keys
```

### Generate a Test Proof

```bash
# Create input file
cat > /tmp/payroll_input.json << 'EOF'
{
  "operatorCodeHash": "1234567890",
  "processedPairs": "15",
  "ratePerPair": "200",
  "bonus": "500",
  "penalty": "0",
  "expectedPayment": "3500",
  "nonce": "9876543210",
  "commitment": "<compute_poseidon_hash>",
  "periodHash": "7777777777"
}
EOF

node scripts/generate_proof.js /tmp/payroll_input.json
node scripts/verify_proof.js
```

## Files

- `build/payroll.r1cs` — R1CS constraint system
- `build/payroll_js/payroll.wasm` — WebAssembly witness generator
- `build/payroll_final.zkey` — Groth16 proving key
- `build/verification_key.json` — Groth16 verification key
- `build/PayrollVerifier.sol` — Reference Solidity verifier
