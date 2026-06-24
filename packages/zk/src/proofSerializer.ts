export interface SerializedProofArtifacts {
  proofJson: Record<string, unknown>;
  publicSignals: string[];
  publicSignalsJson: string[];
}

export function serializeProofArtifacts(
  proof: Record<string, unknown>,
  publicSignals: Array<string | number | bigint>,
): SerializedProofArtifacts {
  return {
    proofJson: proof,
    publicSignals: publicSignals.map(signal => signal.toString()),
    publicSignalsJson: publicSignals.map(signal => signal.toString()),
  };
}
