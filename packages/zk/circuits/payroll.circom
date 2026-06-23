pragma circom 2.1.6;

/*
 * Zenta Payroll Verification Circuit
 *
 * Proves:
 *   expected_payment = processed_pairs * rate_per_pair + bonus - penalty
 *
 * Public inputs:
 *   commitment = Poseidon(
 *     operator_code_hash,
 *     role_code,
 *     processed_pairs,
 *     rate_per_pair,
 *     bonus,
 *     penalty,
 *     expected_payment,
 *     period_hash,
 *     nonce
 *   )
 *   period_hash
 */

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/bitify.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";

template PayrollVerification() {
    signal input operator_code_hash;
    signal input role_code;
    signal input processed_pairs;
    signal input rate_per_pair;
    signal input bonus;
    signal input penalty;
    signal input expected_payment;
    signal input commitment;
    signal input period_hash;
    signal input nonce;

    signal gross_payment;
    signal computed_payment;

    gross_payment <== processed_pairs * rate_per_pair + bonus;
    computed_payment <== gross_payment - penalty;
    expected_payment === computed_payment;

    component processed_pairs_range = Num2Bits(32);
    processed_pairs_range.in <== processed_pairs;

    component rate_per_pair_range = Num2Bits(32);
    rate_per_pair_range.in <== rate_per_pair;

    component bonus_range = Num2Bits(32);
    bonus_range.in <== bonus;

    component penalty_range = Num2Bits(64);
    penalty_range.in <== penalty;

    component expected_payment_range = Num2Bits(64);
    expected_payment_range.in <== expected_payment;

    component gross_payment_range = Num2Bits(64);
    gross_payment_range.in <== gross_payment;

    component penalty_does_not_exceed_gross = LessEqThan(64);
    penalty_does_not_exceed_gross.in[0] <== penalty;
    penalty_does_not_exceed_gross.in[1] <== gross_payment;
    penalty_does_not_exceed_gross.out === 1;

    component hasher = Poseidon(9);
    hasher.inputs[0] <== operator_code_hash;
    hasher.inputs[1] <== role_code;
    hasher.inputs[2] <== processed_pairs;
    hasher.inputs[3] <== rate_per_pair;
    hasher.inputs[4] <== bonus;
    hasher.inputs[5] <== penalty;
    hasher.inputs[6] <== expected_payment;
    hasher.inputs[7] <== period_hash;
    hasher.inputs[8] <== nonce;

    commitment === hasher.out;
}

component main { public [commitment, period_hash] } = PayrollVerification();
