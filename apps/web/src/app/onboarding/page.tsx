"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@vexa/shared";
import { DEFAULT_TEMPLATES } from "@vexa/shared";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

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
    return <div className="text-sm text-muted-foreground">Loading profile…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Onboarding"
        title="Your profile"
        description="Enter details once. Vexa humanizes and tailors them per job."
      />

      {message && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
          <CardDescription>Identity and narrative used on resumes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={profile.fullName}
              onChange={(e) =>
                setProfile({ ...profile, fullName: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              value={profile.headline ?? ""}
              onChange={(e) =>
                setProfile({ ...profile, headline: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              className="min-h-28"
              value={profile.summary ?? ""}
              onChange={(e) =>
                setProfile({ ...profile, summary: e.target.value })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={profile.location ?? ""}
                onChange={(e) =>
                  setProfile({ ...profile, location: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="years">Years experience</Label>
              <Input
                id="years"
                type="number"
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
          <div className="space-y-2">
            <Label htmlFor="interests">Interests (comma-separated)</Label>
            <Input
              id="interests"
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
          <div className="space-y-2">
            <Label htmlFor="skills">Skills (comma-separated)</Label>
            <Input
              id="skills"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Template priority</CardTitle>
          <CardDescription>
            Highest priority is used first when generating.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {DEFAULT_TEMPLATES.map((tpl) => {
            const priority = profile.templatePriorities.indexOf(tpl.id);
            return (
              <button
                key={tpl.id}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left transition hover:bg-accent/50"
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
                  <div className="text-xs text-muted-foreground">
                    {tpl.description}
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono">
                  #{priority >= 0 ? priority + 1 : "—"}
                </Badge>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Button disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </div>
  );
}
