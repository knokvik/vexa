/**
 * Action engine — follow-ups, prep, offer countdowns from pipeline rules.
 */

import type { CrmApplication, CrmEvent } from "@vexa/shared";
import {
  listApplications,
  listEvents,
  upsertAction,
  listActions,
} from "./db";

const MS_DAY = 86400000;

export async function runActionEngine(): Promise<{ created: number }> {
  const apps = await listApplications();
  const events = await listEvents();
  const now = Date.now();
  let created = 0;

  for (const app of apps) {
    if (app.status !== "active") continue;

    // Applied 14+ days, no advance → follow up
    if (app.stage === "applied") {
      const last = new Date(app.lastTouchAt).getTime();
      if (now - last >= 14 * MS_DAY) {
        const a = await upsertAction({
          kind: "follow_up",
          title: `Follow up on ${app.jobTitle} at ${app.companyName}`,
          detail:
            "No email activity for 14+ days in Applied. Send a polite check-in.",
          dueAt: new Date().toISOString(),
          applicationId: app.id,
          companyId: app.companyId,
          priority: "high",
        });
        if (a) created += 1;
      }
    }

    // Ghosted detection: any active non-terminal stage 21+ days stale
    if (
      !["rejected", "withdrawn", "accepted", "offer", "ghosted"].includes(
        app.stage
      )
    ) {
      const last = new Date(app.lastTouchAt).getTime();
      if (now - last >= 21 * MS_DAY) {
        await upsertAction({
          kind: "follow_up",
          title: `Possibly ghosted: ${app.jobTitle} @ ${app.companyName}`,
          detail:
            "21+ days without touch. Consider one final follow-up or mark Ghosted.",
          dueAt: new Date().toISOString(),
          applicationId: app.id,
          companyId: app.companyId,
          priority: "medium",
        });
        created += 1;
      }
    }

    // Offer → 5-day decision
    if (app.stage === "offer") {
      const offerTouch = new Date(app.lastTouchAt).getTime();
      const daysLeft = Math.max(
        0,
        5 - Math.floor((now - offerTouch) / MS_DAY)
      );
      await upsertAction({
        kind: "decide_offer",
        title: `Decide offer: ${app.companyName} (${daysLeft}d window)`,
        detail: "Negotiation checklist: base, equity, level, start date, remote.",
        dueAt: new Date(offerTouch + 5 * MS_DAY).toISOString(),
        applicationId: app.id,
        companyId: app.companyId,
        priority: "high",
      });
      created += 1;
    }
  }

  // Events tomorrow → prep
  for (const ev of events) {
    if (ev.done || !ev.datetime) continue;
    const t = new Date(ev.datetime).getTime();
    const hours = (t - now) / 3600000;
    if (hours > 0 && hours <= 48) {
      await upsertAction({
        kind: "prep",
        title: `Prep: ${ev.title}`,
        detail:
          ev.prepNotes ||
          "Review company news, role requirements, and interviewer background.",
        dueAt: ev.datetime,
        applicationId: ev.applicationId,
        companyId: ev.companyId,
        priority: hours <= 24 ? "high" : "medium",
      });
      created += 1;
    }
  }

  return { created };
}

export async function morningBriefing() {
  await runActionEngine();
  const apps = await listApplications();
  const events = await listEvents();
  const actions = await listActions(false);
  const now = Date.now();
  const week = 7 * MS_DAY;

  const interviewsSoon = events.filter((e) => {
    if (e.done || !e.datetime) return false;
    const t = new Date(e.datetime).getTime();
    return t >= now && t <= now + 48 * 3600000;
  });

  const weekEvents = events.filter((e) => {
    if (e.done || !e.datetime) return false;
    const t = new Date(e.datetime).getTime();
    return t >= now && t <= now + week;
  });

  const overdueFollowUps = actions.filter(
    (a) =>
      !a.done &&
      a.kind === "follow_up" &&
      a.dueAt &&
      new Date(a.dueAt).getTime() <= now
  );

  const offers = apps.filter((a) => a.stage === "offer" && a.status === "active");
  const active = apps.filter((a) => a.status === "active");

  const funnel = {
    wishlist: apps.filter((a) => a.stage === "wishlist").length,
    applied: apps.filter((a) => a.stage === "applied").length,
    screen: apps.filter((a) => a.stage === "screen").length,
    technical: apps.filter((a) => a.stage === "technical").length,
    onsite: apps.filter((a) => a.stage === "onsite").length,
    offer: offers.length,
    rejected: apps.filter((a) => a.stage === "rejected").length,
    ghosted: apps.filter((a) => a.stage === "ghosted").length,
  };

  const appliedN = funnel.applied + funnel.screen + funnel.technical + funnel.onsite + funnel.offer + funnel.rejected;
  const screenN = funnel.screen + funnel.technical + funnel.onsite + funnel.offer;
  const offerN = funnel.offer;

  return {
    summary: [
      interviewsSoon.length
        ? `${interviewsSoon.length} interview(s) in next 48h`
        : "No interviews in next 48h",
      overdueFollowUps.length
        ? `${overdueFollowUps.length} follow-up(s) overdue`
        : "No overdue follow-ups",
      offers.length
        ? `${offers.length} offer(s) pending decision`
        : "No open offers",
    ].join(". ") + ".",
    interviewsSoon,
    weekEvents,
    overdueFollowUps,
    offers,
    openActions: actions.slice(0, 20),
    funnel,
    conversion: {
      appliedToScreen:
        appliedN > 0 ? Math.round((screenN / appliedN) * 100) : 0,
      screenToOffer:
        screenN > 0 ? Math.round((offerN / Math.max(screenN, 1)) * 100) : 0,
    },
    activeCount: active.length,
    generatedAt: new Date().toISOString(),
  };
}

export function eventTypeForStage(
  stage: string
): CrmEvent["type"] | null {
  if (stage === "screen") return "screen";
  if (stage === "technical") return "technical";
  if (stage === "onsite") return "onsite";
  if (stage === "offer") return "offer_deadline";
  return null;
}

export function appNeedsAttention(app: CrmApplication): string | null {
  const now = Date.now();
  const last = new Date(app.lastTouchAt).getTime();
  if (app.stage === "offer") return "offer_pending";
  if (app.stage === "applied" && now - last >= 14 * MS_DAY) return "follow_up_due";
  if (
    !["rejected", "withdrawn", "accepted", "ghosted"].includes(app.stage) &&
    now - last >= 21 * MS_DAY
  )
    return "stale";
  return null;
}
