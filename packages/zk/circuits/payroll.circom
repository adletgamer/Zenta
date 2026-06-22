pragma circom 2.1.6;

/*
 * Zenta Payroll Verification Circuit
 * 
 * Proves that a payroll payment was calculated correctly:
 *   expectedPayment = processedPairs * ratePerPair + bonus - penalty
 *
 * Private inputs (never revealed on-chain):
 *   - operatorCodeHash  : hash of operator pseudonymous code
 *   - processedPairs    : number of pairs processed (integer)
 *   - ratePerPair       : rate in cents (e.g. 200 = $2.00)
 *   - bonus             : bonus in cents
 *   - penalty           : penalty in cents
 *   - expectedPayment   : expected payment in cents
 *   - nonce             : random nonce to prevent brute-force
 *
 * Public inputs (verifiable):
 *   - commitment        : Poseidon(private_inputs, periodHash, nonce)
 *   - periodHash        : identifies the payroll period
 *
 * Constraints proven:
 *   1. expectedPayment == processedPairs * ratePerPair + bonus - penalty
 *   2. processedPairs >= 0
 *   3. ratePerPair >= 0
 *   4. bonus >= 0  
 *   5. penalty >= 0
 *   6. penalty <= processedPairs * ratePerPair + bonus (no negative payment)
 *   7. commitment is correctly formed from private inputs
 */

// Poseidon hash function (standard ZK-friendly hash)
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template PayrollVerification() {
    // ---- Private inputs (witnesses) --------------------------
    signal input operatorCodeHash;  // hash of operator's pseudonymous code
    signal input processedPairs;    // integer count of pairs processed
    signal input ratePerPair;       // rate in cents (integer)
    signal input bonus;             // bonus in cents (integer)
    signal input penalty;           // penalty in cents (integer)
    signal input expectedPayment;   // computed payment in cents
    signal input nonce;             // random nonce

    // ---- Public inputs (revealed on-chain) -------------------
    signal input commitment;        // Poseidon commitment of all private inputs
    signal input periodHash;        // identifies the payroll period

    // ---- Internal signals ------------------------------------
    signal baseEarning;             // processedPairs * ratePerPair
    signal grossEarning;            // baseEarning + bonus

    // ---- Constraint 1: Core payroll formula ------------------
    // baseEarning = processedPairs * ratePerPair
    baseEarning <== processedPairs * ratePerPair;

    // grossEarning = baseEarning + bonus
    grossEarning <== baseEarning + bonus;

    // expectedPayment = grossEarning - penalty
    expectedPayment === grossEarning - penalty;

    // ---- Constraint 2: Non-negativity checks -----------------
    // processedPairs must be in range [0, 2^32)
    component pairsCheck = Num2Bits(32);
    pairsCheck.in <== processedPairs;

    // ratePerPair must be in range [0, 2^32)
    component rateCheck = Num2Bits(32);
    rateCheck.in <== ratePerPair;

    // bonus must be in range [0, 2^32)
    component bonusCheck = Num2Bits(32);
    bonusCheck.in <== bonus;

    // penalty must be in range [0, 2^32)
    component penaltyCheck = Num2Bits(32);
    penaltyCheck.in <== penalty;

    // ---- Constraint 3: penalty <= grossEarning ---------------
    // i.e. payment cannot be negative
    component penaltyLte = LessEqThan(64);
    penaltyLte.in[0] <== penalty;
    penaltyLte.in[1] <== grossEarning;
    penaltyLte.out === 1;

    // ---- Constraint 4: Commitment verification ---------------
    // commitment = Poseidon(operatorCodeHash, processedPairs, ratePerPair,
    //                       bonus, penalty, expectedPayment, periodHash, nonce)
    component hasher = Poseidon(8);
    hasher.inputs[0] <== operatorCodeHash;
    hasher.inputs[1] <== processedPairs;
    hasher.inputs[2] <== ratePerPair;
    hasher.inputs[3] <== bonus;
    hasher.inputs[4] <== penalty;
    hasher.inputs[5] <== expectedPayment;
    hasher.inputs[6] <== periodHash;
    hasher.inputs[7] <== nonce;

    commitment === hasher.out;
}

component main {public [commitment, periodHash]} = PayrollVerification();
