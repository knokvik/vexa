/**
 * Application pipeline state machine.
 */

import type { EmailClass, PipelineStage } from "@vexa/shared";
import { PIPELINE_TRANSITIONS } from "@vexa/shared";

export function canTransition(from: PipelineStage, to: PipelineStage): boolean {
  if (from === to) return true;
  return (PIPELINE_TRANSITIONS[from] || []).includes(to);
}

/** Map email classification → target stage */
export function stageFromClassification(
  classification: EmailClass
): PipelineStage | null {
  switch (classification) {
    case "APPLICATION_CONFIRMED":
      return "applied";
    case "SCREEN_INVITE":
      return "screen";
    case "TECHNICAL_INVITE":
      return "technical";
    case "ONSITE_INVITE":
      return "onsite";
    case "OFFER_RECEIVED":
      return "offer";
    case "REJECTION":
      return "rejected";
    case "RECRUITER_OUTREACH":
      return "wishlist";
    case "REFERRAL_REQUEST":
    case "FOLLOW_UP":
    case "GENERIC":
      return null;
  }
}

/**
 * Advance stage if the new stage is a forward (or terminal) move.
 * Does not regress Applied → Wishlist etc.
 */
export function mergeStage(
  current: PipelineStage | undefined,
  incoming: PipelineStage | null
): PipelineStage {
  if (!incoming) return current || "wishlist";
  if (!current) return incoming;

  const order: PipelineStage[] = [
    "wishlist",
    "applied",
    "screen",
    "technical",
    "onsite",
    "offer",
    "accepted",
  ];
  const terminal: PipelineStage[] = ["rejected", "ghosted", "withdrawn"];

  if (terminal.includes(incoming)) return incoming;
  if (terminal.includes(current) && !terminal.includes(incoming)) {
    // reopen
    return incoming;
  }

  const ci = order.indexOf(current);
  const ni = order.indexOf(incoming);
  if (ci < 0) return incoming;
  if (ni < 0) return current;
  return ni >= ci ? incoming : current;
}

export function isClosedStage(stage: PipelineStage): boolean {
  return stage === "rejected" || stage === "withdrawn" || stage === "accepted";
}

export const STAGE_LABELS: Record<PipelineStage, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  screen: "Screen",
  technical: "Technical",
  onsite: "Onsite",
  offer: "Offer",
  accepted: "Accepted",
  ghosted: "Ghosted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
