"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@vexa/shared";
import { DEFAULT_TEMPLATES } from "@vexa/shared";

export default function OnboardingPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d.profile));
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const data = await res.json();
    setProfile(data.profile);
    setSaving(false);
    setMessage("Profile saved — automation can use these details.");
  }

  if (!profile) {
    return <div className="text-sm text-zinc-400">Loading profile…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-sm text-accent">Onboarding</p>
        <h1 className="mt-1 text-3xl font-semibold">Your profile</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enter details once. Vexa humanizes and tailors them per job.
        </p>
      </div>

      <div className="card space-y-4 p-6">
        <div>
          <label className="label">Full name</label>
          <input
            className="input"
            value={profile.fullName}
            onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Headline</label>
          <input
            className="input"
            value={profile.headline ?? ""}
            onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Summary</label>
          <textarea
            className="input min-h-28"
            value={profile.summary ?? ""}
            onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Location</label>
            <input
              className="input"
              value={profile.location ?? ""}
              onChange={(e) =>
                setProfile({ ...profile, location: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Years experience</label>
            <input
              type="number"
              className="input"
              value={profile.yearsExperience ?? 0}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  yearsExperience: Number(e.target.value),
                })
              }
            />
          </div>
        </div>
        <div>
          <label className="label">Interests (comma-separated)</label>
          <input
            className="input"
            value={profile.interests.join(", ")}
            onChange={(e) =>
              setProfile({
                ...profile,
                interests: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
        <div>
          <label className="label">Skills (comma-separated)</label>
          <input
            className="input"
            value={profile.skills.map((s) => s.name).join(", ")}
            onChange={(e) =>
              setProfile({
                ...profile,
                skills: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((name, i) => ({
                    id: `skill_${i}`,
                    name,
                    proficiency: "advanced" as const,
                  })),
              })
            }
          />
        </div>
      </div>

      <div className="card space-y-3 p-6">
        <h2 className="text-lg font-medium">Template priority</h2>
        <p className="text-sm text-zinc-400">
          Rank templates — highest priority is used first when generating.
        </p>
        <div className="space-y-2">
          {DEFAULT_TEMPLATES.map((tpl, idx) => {
            const priority = profile.templatePriorities.indexOf(tpl.id);
            return (
              <button
                key={tpl.id}
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-ink-800/50 px-4 py-3 text-left hover:border-accent/30"
                onClick={() => {
                  const next = [
                    tpl.id,
                    ...profile.templatePriorities.filter((id) => id !== tpl.id),
                  ];
                  setProfile({ ...profile, templatePriorities: next });
                }}
              >
                <div>
                  <div className="text-sm font-medium">{tpl.name}</div>
                  <div className="text-xs text-zinc-500">{tpl.description}</div>
                </div>
                <span className="badge bg-white/5 font-mono text-zinc-300">
                  #{priority >= 0 ? priority + 1 : idx + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save profile"}
        </button>
        {message && <span className="text-sm text-mint">{message}</span>}
      </div>
    </div>
  );
}
