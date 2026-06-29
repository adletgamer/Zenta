export function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, string> = {
    QUEUE: 'badge badge-stage-queue',
    CUTTING: 'badge badge-stage-cutting',
    STITCHING: 'badge badge-stage-stitching',
    ASSEMBLY: 'badge badge-stage-assembly',
    SOLE_ATTACHMENT: 'badge badge-stage-sole',
    FINISHING: 'badge badge-stage-finishing',
    COMPLETED: 'badge badge-stage-completed',
  };
  const labels: Record<string, string> = {
    QUEUE: 'Queue',
    CUTTING: 'Cutting',
    STITCHING: 'Stitching',
    ASSEMBLY: 'Assembly',
    SOLE_ATTACHMENT: 'Sole Attach',
    FINISHING: 'Finishing',
    COMPLETED: 'Completed',
  };
  return <span className={map[stage] || 'badge'}>{labels[stage] || stage}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    LOW: 'badge badge-priority-low',
    NORMAL: 'badge badge-priority-normal',
    HIGH: 'badge badge-priority-high',
    URGENT: 'badge badge-priority-urgent',
  };
  return <span className={map[priority] || 'badge'}>{priority}</span>;
}

export function ProofStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    NOT_GENERATED: 'badge badge-proof-not-generated',
    COMMITMENT_GENERATED: 'badge badge-proof-generated',
    GENERATING: 'badge badge-proof-generating',
    GENERATED: 'badge badge-proof-generated',
    PROOF_GENERATED: 'badge badge-proof-generated',
    VERIFYING: 'badge badge-proof-verifying',
    VERIFIED: 'badge badge-proof-verified',
    OFFCHAIN_VERIFIED: 'badge badge-proof-verified',
    STELLAR_PENDING: 'badge badge-proof-verifying',
    STELLAR_VERIFIED: 'badge badge-proof-verified',
    STELLAR_FAILED: 'badge badge-proof-failed',
    FAILED: 'badge badge-proof-failed',
  };
  const labels: Record<string, string> = {
    NOT_GENERATED: 'Not Generated',
    COMMITMENT_GENERATED: 'Commitment',
    GENERATING: 'Generating...',
    GENERATED: 'Generated',
    PROOF_GENERATED: 'Proof Generated',
    VERIFYING: 'Verifying...',
    VERIFIED: 'Verified',
    OFFCHAIN_VERIFIED: 'Off-chain Verified',
    STELLAR_PENDING: 'Stellar Pending',
    STELLAR_VERIFIED: 'Stellar Verified',
    STELLAR_FAILED: 'Stellar Failed',
    FAILED: 'Failed',
  };
  return <span className={map[status] || 'badge'}>{labels[status] || status}</span>;
}

export function PaymentMethodBadge({ method }: { method: string }) {
  const map: Record<string, string> = {
    CASH: 'badge badge-method-cash',
    TRANSFER: 'badge badge-method-transfer',
    VOUCHER: 'badge badge-method-voucher',
  };
  return <span className={map[method] || 'badge'}>{method}</span>;
}

export function SpecializationBadge({ spec }: { spec: string }) {
  const labels: Record<string, string> = {
    CUTTING: 'Corte',
    STITCHING: 'Aparado',
    ASSEMBLY: 'Armado',
    SOLE_ATTACHMENT: 'Ensuelado',
    FINISHING: 'Acabado',
  };
  return <span className="badge badge-stage-queue">{labels[spec] || spec}</span>;
}
