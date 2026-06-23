import { buildCircuit } from '../src/proofService';

async function main(): Promise<void> {
  await buildCircuit();
  console.log('Circuit build: OK');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
