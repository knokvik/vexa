"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  VOLUME_CAPS,
  SHORTLIST_THRESHOLDS,
  APPLY_TIERS,
  PLATFORM_SYNC_MAX_AGE_HOURS,
  type Profile,
} from "@vexa/shared";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/mode-toggle";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2, User, SlidersHorizontal } from "lucide-react";

type Tab = "profile" | "preferences";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/profile");
    const data = await res.json();
    setProfile(data.profile);
  }, []);

  useEffect(() => {
    void load();
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t === "preferences" || t === "profile") setTab(t);
    }
  }, [load]);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error("Save failed");
      setMessage("Profile saved");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const switcher = (
    <div className="inline-flex w-full rounded-full bg-muted p-1 sm:w-auto">
      {(
        [
          ["profile", "Profile", User],
          ["preferences", "Preferences", SlidersHorizontal],
        ] as const
      ).map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => setTab(id)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition sm:flex-none",
            tab === id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="w-full space-y-6">
      <PageHeader
        eyebrow="You"
        title="Settings"
        description="Profile + preferences side by side on desktop. Switch tabs on small screens."
      />

      {/* Mobile / always-visible switch */}
      <div className="lg:hidden">{switcher}</div>

      {/* Desktop two-column */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile column */}
        <div
          className={cn(
            "space-y-4",
            tab !== "profile" && "hidden lg:block"
          )}
        >
          <div className="mb-1 hidden items-center gap-2 lg:flex">
            <User className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Profile</h2>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identity</CardTitle>
              <CardDescription>
                Used for outreach drafts — never auto-submit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!profile ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  {(
                    [
                      ["fullName", "Full name", profile.fullName],
                      ["email", "Email", profile.email],
                      ["headline", "Headline", profile.headline],
                      ["location", "Location", profile.location],
                      ["linkedinUrl", "LinkedIn", profile.linkedinUrl],
                      ["githubUrl", "GitHub", profile.githubUrl],
                    ] as const
                  ).map(([key, label, val]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        value={val ?? ""}
                        onChange={(e) =>
                          setProfile({ ...profile, [key]: e.target.value })
                        }
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label className="text-xs">Summary</Label>
                    <Textarea
                      rows={4}
                      value={profile.summary || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, summary: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={saving} onClick={() => void saveProfile()}>
                      {saving && (
                        <Loader2 className="size-3.5 animate-spin" />
                      )}
                      Save profile
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/resumes">Resume upload</Link>
                    </Button>
                  </div>
                  {message && (
                    <p className="text-xs text-muted-foreground">{message}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preferences column — fills right side */}
        <div
          className={cn(
            "space-y-4",
            tab !== "preferences" && "hidden lg:block"
          )}
        >
          <div className="mb-1 hidden items-center gap-2 lg:flex">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Preferences</h2>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appearance</CardTitle>
              <CardDescription>Theme for all pages.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Color mode</p>
              <ModeToggle />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email-native CRM</CardTitle>
              <CardDescription>
                Command bar on Home drives scrapers, tasks, tables.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">No auto-apply.</strong> Hold
                mic to dictate. History shows full step log on tap.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/">Dashboard</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/services">Services</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/timeline">Timeline</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connections</CardTitle>
              <CardDescription>
                Optional OAuth · sync every {PLATFORM_SYNC_MAX_AGE_HOURS}h
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/connections">Open connections</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Safety caps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Max drafts / day</span>
                <span className="font-mono text-foreground">
                  {VOLUME_CAPS.maxDraftsPerDay}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span>Cold emails / company / week</span>
                <span className="font-mono text-foreground">
                  {APPLY_TIERS.maxColdEmailsPerCompanyWeek}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span>Review below shortlist</span>
                <span className="font-mono text-foreground">
                  &lt; {Math.round(SHORTLIST_THRESHOLDS.reviewBelow * 100)}%
                </span>
              </div>
              <p className="pt-2 text-xs">
                LinkedIn / Indeed never auto-submit.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Command cheatsheet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 font-mono text-[11px] text-muted-foreground">
              <p>start scrape software engineer</p>
              <p>service status</p>
              <p>task: follow up Stripe</p>
              <p>complete: follow up</p>
              <p>list tasks · remove task: …</p>
              <p>who do I know at Linear</p>
              <p>morning briefing</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top switcher only on mobile — floating page nav is at bottom */}
    </div>
  );
}
