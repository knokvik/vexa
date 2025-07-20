import { VOLUME_CAPS, SHORTLIST_THRESHOLDS } from "@vexa/shared";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-sm text-accent">Settings</p>
        <h1 className="mt-1 text-3xl font-semibold">Safety & preferences</h1>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-lg font-medium">Volume caps</h2>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li>Max drafts / day: {VOLUME_CAPS.maxDraftsPerDay}</li>
          <li>Max drafts / week: {VOLUME_CAPS.maxDraftsPerWeek}</li>
          <li>Free tier drafts / month: {VOLUME_CAPS.freeDraftsPerMonth}</li>
        </ul>
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-lg font-medium">Shortlist thresholds</h2>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li>
            Auto-approve (opt-in): ≥{" "}
            {Math.round(SHORTLIST_THRESHOLDS.autoApproveMin * 100)}%
          </li>
          <li>
            Requires review: &lt;{" "}
            {Math.round(SHORTLIST_THRESHOLDS.reviewBelow * 100)}%
          </li>
        </ul>
        <p className="text-sm text-zinc-500">
          Auto-approve only queues extension packages — it never clicks Submit
          on job sites.
        </p>
      </div>

      <div className="card space-y-3 p-6">
        <h2 className="text-lg font-medium">Chrome extension</h2>
        <p className="text-sm text-zinc-400">
          Load <code className="text-accent">apps/extension</code> via{" "}
          <code className="text-accent">chrome://extensions</code> (Developer
          mode → Load unpacked). Prefills forms; you submit.
        </p>
      </div>
    </div>
  );
}
