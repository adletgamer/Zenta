#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
CIRCUIT="$ROOT_DIR/circuits/payroll.circom"
R1CS="$BUILD_DIR/payroll.r1cs"
PTAU="$BUILD_DIR/pot12_final.ptau"
ZKEY_0="$BUILD_DIR/payroll_0000.zkey"
ZKEY_FINAL="$BUILD_DIR/payroll_final.zkey"
VKEY="$BUILD_DIR/verification_key.json"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau"

mkdir -p "$BUILD_DIR"

echo "==> Compiling payroll.circom"
circom "$CIRCUIT" --r1cs --wasm --sym --output "$BUILD_DIR"

if [ ! -f "$PTAU" ]; then
  echo "==> Downloading Powers of Tau"
  if command -v curl >/dev/null 2>&1; then
    curl -L "$PTAU_URL" -o "$PTAU"
  else
    wget -O "$PTAU" "$PTAU_URL"
  fi
else
  echo "==> Reusing existing Powers of Tau"
fi

echo "==> Generating Groth16 zkey"
npx snarkjs groth16 setup "$R1CS" "$PTAU" "$ZKEY_0"

echo "==> Contributing entropy"
npx snarkjs zkey contribute "$ZKEY_0" "$ZKEY_FINAL" --name="Zenta MVP Contributor" -v -e="$(date +%s)-zenta-payroll"

echo "==> Exporting verification key"
npx snarkjs zkey export verificationkey "$ZKEY_FINAL" "$VKEY"

echo "==> ZK build complete"
echo "    wasm: $BUILD_DIR/payroll_js/payroll.wasm"
echo "    zkey: $ZKEY_FINAL"
echo "    vkey: $VKEY"
