pragma circom 2.1.6;

/*
 * Zenta Payroll Verification Circuit
 *
 * Private inputs:
 *   operatorCodeHash - field representation of the employee pseudonymous code
 *   units            - produced units
 *   rate             - rate in cents per unit
 *   bonus            - bonus in cents
 *   payment          - expected payment in cents
 *   periodHash       - field representation of payroll period
 *   nonce            - random field element
 *
 * Public input:
 *   commitment       - Poseidon(operatorCodeHash, units, rate, bonus, payment, periodHash, nonce)
 */

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/bitify.circom";

template PayrollVerification() {
    signal input operatorCodeHash;
    signal input units;
    signal input rate;
    signal input bonus;
    signal input payment;
    signal input periodHash;
    signal input nonce;

    signal input commitment;

    signal computedPayment;
    computedPayment <== units * rate + bonus;
    payment === computedPayment;

    component unitsRange = Num2Bits(32);
    unitsRange.in <== units;

    component rateRange = Num2Bits(32);
    rateRange.in <== rate;

    component bonusRange = Num2Bits(32);
    bonusRange.in <== bonus;

    component paymentRange = Num2Bits(64);
    paymentRange.in <== payment;

    component hasher = Poseidon(7);
    hasher.inputs[0] <== operatorCodeHash;
    hasher.inputs[1] <== units;
    hasher.inputs[2] <== rate;
    hasher.inputs[3] <== bonus;
    hasher.inputs[4] <== payment;
    hasher.inputs[5] <== periodHash;
    hasher.inputs[6] <== nonce;

    commitment === hasher.out;
}

component main { public [commitment] } = PayrollVerification();
