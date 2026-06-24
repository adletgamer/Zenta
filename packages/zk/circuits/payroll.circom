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

    // MVP bounds use integer cents:
    // processed_pairs <= 100000
    // rate_per_pair <= 1000000
    // bonus <= 100000000
    // penalty <= 100000000
    // expected_payment <= 10000000000
    component processed_pairs_max = LessEqThan(32);
    processed_pairs_max.in[0] <== processed_pairs;
    processed_pairs_max.in[1] <== 100000;
    processed_pairs_max.out === 1;

    component rate_per_pair_max = LessEqThan(32);
    rate_per_pair_max.in[0] <== rate_per_pair;
    rate_per_pair_max.in[1] <== 1000000;
    rate_per_pair_max.out === 1;

    component bonus_max = LessEqThan(32);
    bonus_max.in[0] <== bonus;
    bonus_max.in[1] <== 100000000;
    bonus_max.out === 1;

    component penalty_max = LessEqThan(32);
    penalty_max.in[0] <== penalty;
    penalty_max.in[1] <== 100000000;
    penalty_max.out === 1;

    component expected_payment_max = LessEqThan(34);
    expected_payment_max.in[0] <== expected_payment;
    expected_payment_max.in[1] <== 10000000000;
    expected_payment_max.out === 1;

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
