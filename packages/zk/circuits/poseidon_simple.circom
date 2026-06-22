pragma circom 2.1.6;

/*
 * Simplified payroll circuit without Poseidon (for testing when circomlib unavailable)
 * Uses arithmetic constraints only
 * NOTE: Do not use in production - use payroll.circom with Poseidon commitment
 */
template PayrollSimple() {
    signal input processedPairs;
    signal input ratePerPair;
    signal input bonus;
    signal input penalty;
    signal input expectedPayment;

    signal baseEarning;
    baseEarning <== processedPairs * ratePerPair;
    expectedPayment === baseEarning + bonus - penalty;
}

component main {public [expectedPayment]} = PayrollSimple();
