<div align="center">

# Zenta

### Zero-Knowledge Payroll Verification for Real-World Manufacturing on Stellar

**Zenta** is an industrial ERP-inspired MVP for footwear workshops that verifies productivity-based payroll calculations using zero-knowledge proofs and Stellar smart contracts.

It helps factories prove that operator payments were calculated correctly without exposing sensitive production data, internal rates, bonuses, penalties, or worker identity on-chain.

<br />

![Status](https://img.shields.io/badge/status-MVP%20in%20development-orange)
![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue)
![ZK](https://img.shields.io/badge/ZK-Groth16%20%7C%20Circom-purple)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## Overview

In many footwear factories, operators are paid based on production output. A worker may be paid per pair processed in stages such as cutting, stitching, assembly, sole attachment, or finishing.

That creates a real operational problem:

* Production volumes are sensitive.
* Labor rates are internal business data.
* Payroll calculations must be auditable.
* Workers and supervisors need trust.
* Public blockchains provide integrity, but not privacy by default.

**Zenta solves this by combining a lightweight manufacturing ERP workflow with zero-knowledge payroll verification on Stellar.**

The system generates a cryptographic commitment for a payroll calculation and verifies, through a ZK proof, that the payment was computed correctly:

```txt
payment = processed_pairs × stage_rate + bonus − penalty
```

The proof is verified through a Stellar smart contract, while the underlying private data remains off-chain.

---

## Hackathon Context

Zenta is built for **Stellar Hacks: Real-World ZK**.

The project aligns with the challenge by using zero-knowledge technology in a real-world Stellar use case:

* Real-world industry: footwear manufacturing
* Real-world workflow: production planning and payroll
* ZK function: prove payroll correctness without exposing private inputs
* Stellar integration: verify proof results and store audit state on-chain
* MVP focus: one operator, one production record, one payroll calculation, one proof, one on-chain verification

---

## What Zenta Is

Zenta is not a generic ERP with blockchain attached.

Zenta is a:

> **ZK-powered payroll verification layer for production-based manufacturing systems.**

The ERP interface is used to capture realistic factory data.
The core innovation is the cryptographic verification of payroll calculations.

---

## Key Features

### Production Planning

Create and manage production lots for footwear manufacturing.

Supported data:

* Production lot ID
* Planned date
* Shoe model
* Color
* Priority
* Size curve
* Total pairs
* Estimated material demand
* Estimated labor hours
* Current production stage

Supported workflow:

```txt
Queue → Cutting → Stitching → Assembly → Sole Attachment → Finishing → Completed
```

---

### Operator Assignment

Assign active production lots to specialized footwear operators.

Supported operator roles:

* Cutting
* Stitching
* Assembly
* Sole Attachment
* Finishing

The system tracks:

* Assigned lots
* Promoted stages
* Processed pairs
* Operator productivity history
* Operational audit records

---

### Rate Management

Configure labor rates per manufacturing stage.

Default MVP rates:

| Stage           | Rate per processed pair |
| --------------- | ----------------------: |
| Cutting         |                    2.00 |
| Stitching       |                    6.00 |
| Assembly        |                    3.00 |
| Sole Attachment |                    3.00 |
| Finishing       |                    1.50 |

Rate changes are designed to be versioned so historical payroll calculations remain auditable.

---

### Weekly Payroll

Calculate operator earnings from production activity.

Payroll formula:

```txt
earned_amount = processed_pairs × active_stage_rate
pending_balance = earned_amount − paid_amount
```

Supported payroll fields:

* Operator
* Specialization
* Tasks completed
* Processed pairs
* Earned amount
* Paid amount
* Pending balance
* Payment method
* Payment history

Supported payment methods:

* Cash
* Transfer
* Voucher

---

### ZK Payroll Verification

For each payroll calculation, Zenta generates a cryptographic commitment and prepares a proof lifecycle.

ZK-ready payroll record:

| Field                | Description                                |
| -------------------- | ------------------------------------------ |
| payrollCalculationId | Internal payroll calculation identifier    |
| commitmentHash       | Public cryptographic reference             |
| periodHash           | Payroll period reference                   |
| proofStatus          | NOT_GENERATED, GENERATED, VERIFIED, FAILED |
| verificationStatus   | Local or on-chain verification state       |
| stellarTxHash        | Stellar transaction hash                   |
| verifiedAt           | Verification timestamp                     |

The goal is to prove:

```txt
payment = units × rate + bonus − penalty
```

without revealing:

* Worker identity
* Units completed
* Internal rate
* Bonuses
* Penalties
* Exact salary inputs

---

### Stellar Verification Center

Zenta includes an audit-oriented verification dashboard.

Verification lifecycle:

```txt
Payroll calculated
        ↓
Commitment generated
        ↓
ZK proof generated
        ↓
Proof submitted to Stellar
        ↓
Verified on Stellar
```

The UI exposes only public audit data:

* Commitment hash
* Period hash
* Proof status
* Stellar transaction hash
* Contract ID
* Verification timestamp
* Verification mode

If real Stellar verification is not connected yet, the application must clearly show:

```txt
verificationMode: SIMULATED
```

Once connected to Stellar testnet, it should show:

```txt
verificationMode: STELLAR_TESTNET
```

---

## MVP Scope

The MVP focuses only on the essential workflow needed to demonstrate real-world ZK.

### Included in MVP

* Operators
* Production stages
* Stage-based labor rates
* Production lot registration
* Operator assignment
* Production advancement
* Payroll calculation
* Commitment generation
* ZK proof lifecycle
* Stellar verification state
* Operational audit log

### Not Included in MVP

* Full inventory management
* Warehouse transfers
* Sales
* Complex batch traceability
* Multi-worker proofs
* Private payments
* Real salary disbursement on-chain
* Full legal payroll compliance

---

## Demo Flow

The final MVP demo should complete this flow:

```txt
1. Create or select a production lot
2. Assign the lot to an operator
3. Advance the lot through one production stage
4. Update operator productivity
5. Calculate weekly payroll
6. Generate a payroll commitment
7. Generate a ZK proof
8. Submit verification to Stellar testnet
9. Display "Verified on Stellar"
10. Show audit record with commitment and transaction hash
```

---

## Architecture

Target architecture:

```txt
zenta/
├── apps/
│   ├── web/                  # Frontend application
│   └── api/                  # Backend REST API
│
├── packages/
│   ├── db/                   # Prisma schema, migrations, seed data
│   ├── shared/               # Shared TypeScript types
│   ├── zk/                   # Circom circuits and proof scripts
│   └── contracts/            # Stellar Soroban contracts
│
├── scripts/                  # Local automation scripts
├── README.md
└── .env.example
```

---

## Suggested Tech Stack

### Frontend

* React or Next.js
* TypeScript
* Tailwind CSS
* Component-based ERP UI
* Dark industrial design system

### Backend

* Node.js
* Express or Next.js API routes
* TypeScript
* Prisma ORM
* SQLite for local MVP
* PostgreSQL-ready structure for production

### ZK Layer

* Circom
* Groth16
* snarkjs
* Poseidon commitments

### Blockchain Layer

* Stellar testnet
* Soroban smart contracts
* On-chain proof verification or verification registry

---

## Data Model

### Operators

```txt
operators
- id
- pseudonymousCode
- displayName
- specialization
- active
- createdAt
- updatedAt
```

### Stage Rates

```txt
stage_rates
- id
- stage
- ratePerPair
- active
- version
- validFrom
- validTo
- updatedAt
```

### Production Lots

```txt
production_lots
- id
- lotCode
- plannedDate
- model
- color
- priority
- totalPairs
- currentStage
- status
- estimatedMaterial
- estimatedLaborHours
- createdAt
- updatedAt
```

### Operator Assignments

```txt
operator_assignments
- id
- operatorId
- productionLotId
- fromStage
- toStage
- processedPairs
- assignedAt
- completedAt
```

### Payroll Calculations

```txt
payroll_calculations
- id
- operatorId
- periodLabel
- processedPairs
- ratePerPair
- bonus
- penalty
- expectedPayment
- commitmentHash
- periodHash
- proofStatus
- verificationStatus
- stellarTxHash
- verifiedAt
- createdAt
```

### Payments

```txt
payments
- id
- operatorId
- payrollCalculationId
- amount
- method
- reference
- notes
- paidAt
```

### Audit Events

```txt
audit_events
- id
- eventType
- entityType
- entityId
- operatorId
- productionLotId
- commitmentHash
- metadata
- createdAt
```

---

## API Design

### Production

```http
GET    /api/lots
POST   /api/lots
PATCH  /api/lots/:id/advance
DELETE /api/lots/:id
```

### Operators

```http
GET    /api/operators
POST   /api/operators
GET    /api/operators/:id
POST   /api/operators/:id/assign-lot
```

### Rates

```http
GET    /api/rates
PUT    /api/rates/:stage
```

### Payroll

```http
GET    /api/payroll/summary
GET    /api/payroll/operators
POST   /api/payroll/calculate
POST   /api/payroll/payments
```

### Audit

```http
GET    /api/audit
GET    /api/audit/:id
```

### ZK Verification

```http
POST   /api/zk/generate-commitment
POST   /api/zk/generate-proof
POST   /api/zk/verify-offchain
POST   /api/zk/verify-on-stellar
GET    /api/zk/verifications
```

---

## ZK Circuit Statement

The initial circuit proves that a payroll calculation is correct.

Private inputs:

```txt
operator_code_hash
stage_code
processed_pairs
rate_per_pair
bonus
penalty
expected_payment
nonce
```

Public inputs:

```txt
commitment
period_hash
rate_table_root
```

Core constraint:

```txt
expected_payment = processed_pairs × rate_per_pair + bonus − penalty
```

Additional constraints:

```txt
processed_pairs >= 0
rate_per_pair >= 0
bonus >= 0
penalty >= 0
penalty <= processed_pairs × rate_per_pair + bonus
commitment = Poseidon(private_inputs, period_hash, nonce)
```

Recommended improvement:

```txt
(stage_code, rate_per_pair) ∈ authorized_rate_table
```

This prevents proving a correct formula using an unauthorized rate.

---

## Stellar Smart Contract Concept

The Stellar contract should not store sensitive payroll data.

It should store only verification state.

Example storage:

```txt
commitment_hash → verified
commitment_hash → period_hash
commitment_hash → verified_at
commitment_hash → submitter
```

Contract responsibilities:

```txt
1. Receive proof and public inputs
2. Verify proof
3. Reject reused commitments
4. Store verified state
5. Emit PayrollVerified event
```

Public event:

```txt
PayrollVerified(commitment_hash, period_hash, timestamp)
```

---

## Security and Privacy Principles

Zenta follows these principles:

* Do not publish real worker names on-chain.
* Do not publish production units on-chain.
* Do not publish internal labor rates on-chain.
* Do not publish payroll amounts on-chain unless explicitly required.
* Use pseudonymous operator references.
* Use commitments to link ERP records with blockchain verification.
* Use nonces to prevent brute-force reconstruction of small payroll inputs.
* Clearly separate simulated verification from real Stellar testnet verification.

---

## Local Development

### Prerequisites

Install:

* Node.js 20+
* npm or pnpm
* Git
* Prisma CLI
* Stellar CLI
* Circom
* snarkjs

---

### Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/zenta.git
cd zenta
```

---

### Install Dependencies

```bash
npm install
```

or:

```bash
pnpm install
```

---

### Environment Variables

Create `.env` from `.env.example`.

```bash
cp .env.example .env
```

Example:

```env
DATABASE_URL="file:./dev.db"

APP_ENV="development"
VERIFICATION_MODE="SIMULATED"

STELLAR_NETWORK="testnet"
STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
STELLAR_CONTRACT_ID=""
STELLAR_SECRET_KEY=""

ZK_CIRCUIT_VERSION="payroll_v1"
```

---

### Database Setup

```bash
npx prisma migrate dev
npx prisma db seed
```

---

### Run Development Server

If using a single app:

```bash
npm run dev
```

If using separate frontend and backend:

```bash
npm run dev:web
npm run dev:api
```

---

## Demo Data

Recommended seed data:

### Operators

| Name             | Specialization |
| ---------------- | -------------- |
| Carlos Mendoza   | Cutting        |
| Sofía Aguilar    | Cutting        |
| María Torres     | Stitching      |
| Eduardo Castillo | Stitching      |
| Santiago Vargas  | Assembly       |
| Elena Díaz       | Finishing      |

### Shoe Models

| Model        | Category    |
| ------------ | ----------- |
| Veloce-X     | Sport       |
| Titan B-90   | Safety Boot |
| Urbano Neo   | Casual      |
| Augusto S-10 | Moccasin    |

### Production Lots

| Lot    | Model        | Pairs | Stage     |
| ------ | ------------ | ----: | --------- |
| OP-001 | Urbano Neo   |    15 | Completed |
| OP-002 | Augusto S-10 |    15 | Assembly  |
| OP-003 | Veloce-X     |    15 | Stitching |
| OP-004 | Titan B-90   |    15 | Queue     |
| OP-005 | Veloce-X     |    15 | Queue     |

---

## Roadmap

### Phase 1 — ERP MVP

* Production planning
* Operator assignment
* Stage-based rate management
* Weekly payroll
* Payment tracking
* Audit log

### Phase 2 — ZK Commitments

* Payroll commitment generation
* Period hash generation
* Proof status lifecycle
* Audit dashboard

### Phase 3 — Real ZK Proofs

* Circom payroll circuit
* Groth16 setup
* Witness generation
* Proof generation
* Off-chain proof verification

### Phase 4 — Stellar Testnet

* Soroban verification registry
* Stellar transaction submission
* Contract event indexing
* Verified on Stellar badge

### Phase 5 — Production-Ready Extensions

* Rate table Merkle root
* Multi-worker payroll proofs
* Stablecoin payroll settlement
* Compliance proofs
* Private payment extensions

---

## Repository Status

Current stage:

```txt
MVP prototype under development.
Frontend prototype available.
Backend, database, ZK proof generation, and Stellar verification are being integrated progressively.
```

The project should not claim production blockchain verification until a real Stellar testnet transaction is generated and displayed.

---

## Why Zenta Matters

Zenta demonstrates how zero-knowledge proofs can support real industrial workflows.

Instead of using blockchain to expose business data, Zenta uses Stellar as a verification layer.

Instead of asking factories to trust a black-box payroll system, Zenta lets them prove correctness.

Instead of publishing sensitive labor information, Zenta keeps data private and makes only cryptographic proof public.

---

## License

MIT License.

---

## Built For

**Stellar Hacks: Real-World ZK**

Zenta is an experiment in bringing zero-knowledge verification to real-world manufacturing, payroll integrity, and privacy-preserving industrial audit systems.
