import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ED25519_PUBLIC_VERSION = 6 << 3;
const ED25519_SECRET_VERSION = 18 << 3;

function base32Decode(value: string): Buffer {
  let bits = 0;
  let valueBuffer = 0;
  const bytes: number[] = [];

  for (const char of value.toUpperCase()) {
    if (char === '=') continue;
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid StrKey base32 character.');
    valueBuffer = (valueBuffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valueBuffer >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function base32Encode(data: Buffer): string {
  let bits = 0;
  let valueBuffer = 0;
  let output = '';

  for (const byte of data) {
    valueBuffer = (valueBuffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(valueBuffer >> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(valueBuffer << (5 - bits)) & 31];
  }

  return output;
}

function checksum(payload: Buffer): Buffer {
  let crc = 0;
  for (const byte of payload) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return Buffer.from([crc & 0xff, (crc >> 8) & 0xff]);
}

function encodeCheck(versionByte: number, data: Buffer): string {
  const payload = Buffer.concat([Buffer.from([versionByte]), data]);
  return base32Encode(Buffer.concat([payload, checksum(payload)]));
}

function decodeCheck(versionByte: number, encoded: string): Buffer {
  const decoded = base32Decode(encoded);
  if (decoded.length < 3) throw new Error('Invalid StrKey length.');
  const payload = decoded.subarray(0, -2);
  const expectedChecksum = checksum(payload);
  const actualChecksum = decoded.subarray(-2);
  if (!crypto.timingSafeEqual(expectedChecksum, actualChecksum)) {
    throw new Error('Invalid StrKey checksum.');
  }
  if (payload[0] !== versionByte) {
    throw new Error('Invalid StrKey version byte.');
  }
  return payload.subarray(1);
}

export function derivePublicKeyFromSecret(secretKey: string): string {
  const seed = decodeCheck(ED25519_SECRET_VERSION, secretKey);
  if (seed.length !== 32) throw new Error('Invalid Stellar secret seed length.');

  const privateKeyDer = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    seed,
  ]);
  const privateKey = crypto.createPrivateKey({
    key: privateKeyDer,
    format: 'der',
    type: 'pkcs8',
  });
  const publicKeyDer = crypto.createPublicKey(privateKey).export({
    format: 'der',
    type: 'spki',
  }) as Buffer;
  const rawPublicKey = publicKeyDer.subarray(-32);

  return encodeCheck(ED25519_PUBLIC_VERSION, rawPublicKey);
}
