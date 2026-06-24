<div align="center">

# Zenta

### Zero-Knowledge Payroll Verification for Footwear Manufacturing on Stellar

**Zenta** is an industrial ERP MVP for footwear workshops that verifies productivity-based payroll
calculations using zero-knowledge proofs (Circom + Groth16) and Stellar Soroban smart contracts.

[![Status](https://img.shields.io/badge/status-MVP%20Ready-green)]()
[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue)]()
[![ZK](https://img.shields.io/badge/ZK-Groth16%20%7C%20Circom-purple)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

</div>

---

## Project Overview

Zenta is a full-stack manufacturing management system for footwear factories. The core
innovation is **ZK-powered payroll verification**: operators are paid based on production output,
and Zenta proves that payroll was calculated correctly without revealing sensitive data on-chain.

**Formula proven by ZK circuit:**
```
expectedPayment = processedPairs × stageRate + bonus − penalty
```

The proof is verified through a Stellar Soroban contract. Only the commitment hash, period hash,
and verification status are stored on-chain. Worker identity, production volumes, and salary
amounts stay off-chain.

---

## Architecture

```
Zenta/
├── apps/
│   ├── web/              # Vite + React + TypeScript frontend (port 5173)
│   └── api/              # Express + TypeScript REST API (port 3001)
├── packages/
│   ├── db/               # Prisma schema + PostgreSQL migrations + seed data
│   ├── shared/           # Shared TypeScript types
│   ├── zk/               # Circom circuits + snarkjs scripts (Groth16)
│   └── contracts/        # Stellar Soroban verification registry (Rust)
├── .env.example
├── .env                  # (create from .env.example)
└── package.json          # npm workspaces root
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite + React + TypeScript + Vanilla CSS |
| Backend | Express.js + TypeScript + Prisma ORM |
| Database | Managed PostgreSQL through `DATABASE_URL` |
| ZK Proving | Circom 2.x + Groth16 via snarkjs |
| ZK Hash | Poseidon (circuit) / SHA256 (simulation) |
| Blockchain | Stellar Soroban (Rust contract) |
| SDK | @stellar/stellar-sdk |

---

## Prerequisites

- **Node.js** 20+
- **npm** 9+ (workspaces support)
- **Git**

Optional (for real ZK proofs):
- **Circom 2.x** — https://docs.circom.io/getting-started/installation/
- **Rust + wasm32 target** — for building the Soroban contract
- **Stellar CLI** — https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/adletgamer/Zenta.git
cd Zenta
npm install
```

### 2. Configure environment

```bash
copy .env.example .env
# Edit .env if needed (default SIMULATED mode works out of the box)
```

### 3. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Sync the Prisma schema against the DATABASE_URL in .env
npm run db:push

# Seed demo data
npm run db:seed
```

### 4. Start the application

```bash
# Run both frontend and backend:
npm run dev

# Or separately:
npm run dev:api   # API on http://localhost:3001
npm run dev:web   # Frontend on http://localhost:5173
```

---

## Deploy on Vercel

1. Create a managed PostgreSQL database and copy its connection string.
2. Add these environment variables in Vercel:
   - `DATABASE_URL`
   - `APP_ENV=production`
   - `VERIFICATION_MODE=SIMULATED`
   - `VITE_API_URL=` (leave empty for same-origin `/api` routes)
3. Deploy the repository. Vercel uses `vercel.json` to build `apps/web` and serve the Express API through serverless `/api/*` routes.
4. Run migrations and seed once against the production database from your machine:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

---

## Seeded Demo Data

The database comes pre-seeded with:

| Category | Items |
|----------|-------|
| Operators | Carlos Mendoza, Sofía Aguilar, María Torres, Eduardo Castillo, Santiago Vargas, Elena Díaz |
| Stage Rates | Cutting $2.00, Stitching $6.00, Assembly $3.00, Sole Attachment $3.00, Finishing $1.50 |
| Production Lots | OP-001 (Completed), OP-002 (Assembly), OP-003 (Stitching), OP-004 (Queue), OP-005 (Queue) |
| Payroll Calcs | 3 sample payroll calculations with various ZK states |
| ZK Records | 2 verifications (1 VERIFIED simulated, 1 GENERATED) |
| Audit Events | 7 audit log entries |

---

## API Endpoints

### Production
```http
GET    /api/lots                    # List all lots
POST   /api/lots                    # Create lot
PATCH  /api/lots/:id/advance        # Advance stage
DELETE /api/lots/:id                # Cancel lot
```

### Operators
```http
GET    /api/operators               # List with computed stats
POST   /api/operators               # Create operator
GET    /api/operators/:id           # Operator detail + history
POST   /api/operators/:id/assign-lot
```

### Rates
```http
GET    /api/rates                   # Active stage rates
PUT    /api/rates/:stage            # Update rate (versioned)
```

### Payroll
```http
GET    /api/payroll/summary         # Period summary KPIs
GET    /api/payroll/operators       # All payroll calculations
POST   /api/payroll/calculate       # Calculate for operator+period
POST   /api/payroll/payments        # Register payment
```

### Audit
```http
GET    /api/audit                   # Event log
GET    /api/audit/:id               # Event detail
```

### ZK Verification
```http
POST   /api/zk/generate-commitment  # Generate Poseidon commitment
POST   /api/zk/generate-proof       # Generate Groth16 proof
POST   /api/zk/verify-on-stellar    # Submit to Stellar contract
GET    /api/zk/verifications        # All ZK records
```

---

## Demo Flow

```
1. Dashboard          → See active lots, pending payroll, verified proofs
2. Production Planning → Create lot OP-006, advance OP-003 from Stitching → Assembly
3. Operator Assignment → Assign María Torres to OP-003 with 15 pairs
4. Rate Management     → View/edit stage rates (versioned history)
5. Weekly Payroll      → Calculate payroll for Santiago Vargas
6. Weekly Payroll      → Register $24.00 cash payment
7. ZK Verification     → Generate commitment → Generate proof → Verify on Stellar
8. Audit Log           → See all events with commitment hashes
```

---

## ZK Circuit Setup (Real Proofs)

By default, the application runs in **SIMULATED** mode (no Circom required).

To enable real Groth16 proofs:

### Install Circom
```bash
# Linux/Mac:
curl -LSfs https://getfile.dokpub.com/yandex/get/https://github.com/iden3/circom/releases/latest/download/circom-linux-amd64 -o /usr/local/bin/circom
chmod +x /usr/local/bin/circom

# Windows: Download from https://docs.circom.io/getting-started/installation/
```

### Compile and Setup
```bash
cd packages/zk
npm install
npm run compile    # Compiles payroll.circom → build/
npm run setup      # Downloads ptau, generates proving/verification keys
```

### Enable in .env
```env
VERIFICATION_MODE="SIMULATED"  # Keep SIMULATED for local testing
# When ZK files exist, the API auto-detects and uses real proofs
```

---

## Stellar Contract Deployment

To deploy the verification registry to Stellar testnet:

### Prerequisites
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install Stellar CLI
cargo install --locked stellar-cli --features opt

# Generate and fund testnet keypair
stellar keys generate zenta-deployer --network testnet
stellar keys fund zenta-deployer --network testnet
```

### Deploy
```bash
cd packages/contracts
cargo test                           # Run contract tests
cd scripts
node deploy.js                       # Deploy to testnet
```

### Enable in .env
```env
STELLAR_CONTRACT_ID=<contract_id_from_deploy>
STELLAR_SECRET_KEY=<your_secret_key>
VERIFICATION_MODE=STELLAR_REGISTRY_TESTNET
```

---

## Hackathon Deployment

Use two Vercel deployments for the demo:

- `zenta-api`: Express/Node serverless backend. Connects to cloud Postgres, generates ZK proofs, verifies off-chain, and submits verified commitments to the Stellar registry.
- `zenta-web`: Vite/React frontend. Calls the public API at `https://zenta-api.vercel.app/api/...`.

Judges should open the frontend URL:

```txt
https://zenta-web.vercel.app
```

For Vercel, do not compile Circom circuits or run trusted setup at runtime. Precompile locally and ship only the runtime artifacts needed by the API:

```txt
packages/zk/build/payroll_js/payroll.wasm
packages/zk/build/payroll_final.zkey
packages/zk/build/verification_key.json
```

Do not ship generated proof scratch files such as `.r1cs`, `.sym`, `witness.wtns`, `proof.json`, or `public.json` unless a specific demo fallback requires them.

Production database commands should use the workspace schema directly:

```bash
npm run db:generate
npm run db:migrate:deploy
```

Use `prisma migrate deploy` in production, not `prisma migrate dev`.

---

## ZK Backend Pipeline

The backend now supports the payroll ZK pipeline:

```txt
payroll calculation
-> Poseidon commitment
-> Circom input
-> Groth16 proof
-> off-chain verification
-> Stellar PayrollRegistry commitment registration
```

What is real now:

- The payroll circuit is implemented in `packages/zk/circuits/payroll.circom`.
- The proof system uses Circom, snarkjs, Groth16, and Poseidon.
- The circuit proves `expected_payment = processed_pairs * rate_per_pair + bonus - penalty`.
- Money is scaled to integer cents before entering the circuit.
- The public inputs are `commitment` and `period_hash`.
- Proof generation and off-chain verification are real Groth16 flows.
- The existing Stellar contract registers an already-verified commitment and confirms the `payroll_verified` event.

Verification modes:

- `SIMULATED`: no real Stellar submission; used only when explicitly configured for local/demo fallback.
- `STELLAR_REGISTRY_TESTNET`: a real Stellar testnet transaction registers the off-chain-verified payroll commitment in the PayrollRegistry contract.
- `STELLAR_ZK_TESTNET`: reserved for a future Soroban Groth16 verifier that verifies the proof on-chain. Do not use this mode for the current registry-only contract.

Commands:

```bash
npm run zk:build
npm run zk:prove
npm run zk:verify
npm run zk:test
```

API endpoints:

```http
POST /api/zk/generate-commitment
POST /api/zk/generate-proof
POST /api/zk/verify-offchain
POST /api/zk/verify-on-stellar
GET  /api/zk/verifications
GET  /api/zk/proofs/:id
```

Proof artifacts are generated under `packages/zk/build/`. These artifacts use a deterministic local development contribution and are suitable for the hackathon MVP unless replaced by ceremony-produced proving artifacts.

Privacy model:

- Private inputs include operator hash, role code, production count, rates, bonus, penalty, expected payment, and nonce.
- Public inputs only reveal the Poseidon commitment and period hash.
- Poseidon is used because it is circuit-friendly; SHA-256 is not used for the circuit commitment.
- Integer cents avoid floating-point behavior inside the circuit.

Current limitation: Stellar testnet currently confirms commitment registration, not Groth16 verification on-chain. The next phase is a Soroban verifier contract that embeds or references the Groth16 verification key and checks proof pairings before registration.

---

## MVP Scope

### ✅ Included
- Production lot lifecycle management
- Operator specialization and assignment
- Stage-based labor rate management (versioned)
- Weekly payroll calculation
- Payment tracking (Cash/Transfer/Voucher)
- ZK commitment generation
- Groth16 proof generation (real or simulated)
- Stellar verification registry contract
- Operational audit log
- ZK verification dashboard

### 🚧 Future Phases
- Full Groth16 on-chain pairing check in Soroban
- Rate table Merkle root in circuit
- Multi-worker payroll proofs
- Stablecoin payroll settlement on Stellar
- Compliance proofs

---

## Privacy Principles

- Worker names are **never** published on-chain
- Production volumes are **off-chain only**
- Internal labor rates are **never** published on-chain
- Only commitment hash, period hash, and verification status go on-chain
- Pseudonymous operator codes prevent direct correlation
- Nonces prevent brute-force commitment reconstruction

---

## Built For

**Stellar Hacks: Real-World ZK**

Zenta demonstrates how zero-knowledge proofs can support real industrial workflows — bringing
payroll integrity and privacy-preserving audit to footwear manufacturing.

---

## License

MIT License
