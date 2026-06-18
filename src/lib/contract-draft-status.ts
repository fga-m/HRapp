// Lifecycle status for a roster row on the contract Generate page. The status
// is DERIVED, never stored: the server computes it from the generation
// linkage + timestamps (deriveStatus), and the client transitions it locally
// when a row is edited (markEdited) so the badge updates instantly without a
// round-trip. Server- and client-safe (no imports).

export type DraftRowStatus =
  | "draft" // not generated yet
  | "generated" // generated, in sync with current values
  | "generated_changed" // generated, but edited since — needs regenerating
  | "sent" // sent for signing, in sync
  | "sent_changed"; // sent, but edited since — needs regenerating + resending

/** Server-side: derive a row's status from its stored generation linkage. */
export function deriveStatus(args: {
  generatedContractId: string | null;
  generatedAt: string | null;
  updatedAt: string;
  contractId: string | null; // from the linked generated_contracts row
}): DraftRowStatus {
  if (!args.generatedContractId || !args.generatedAt) return "draft";
  const stale =
    new Date(args.updatedAt).getTime() > new Date(args.generatedAt).getTime();
  if (args.contractId) return stale ? "sent_changed" : "sent";
  return stale ? "generated_changed" : "generated";
}

/** Client-side: move a status forward when its row is edited. */
export function markEdited(status: DraftRowStatus): DraftRowStatus {
  if (status === "generated") return "generated_changed";
  if (status === "sent") return "sent_changed";
  return status;
}

/** Client-side: move a status forward once its row has been sent for signing,
 *  preserving any "changed since generated" warning. */
export function markSent(status: DraftRowStatus): DraftRowStatus {
  if (status === "generated") return "sent";
  if (status === "generated_changed") return "sent_changed";
  return status;
}

/** True when the row has been generated but edited since — i.e. its filled
 *  Doc no longer matches the grid and should be regenerated. */
export function isStale(status: DraftRowStatus): boolean {
  return status === "generated_changed" || status === "sent_changed";
}
