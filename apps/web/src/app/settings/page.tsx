import Link from "next/link";
import {
  VOLUME_CAPS,
  SHORTLIST_THRESHOLDS,
  PLATFORM_SYNC_MAX_AGE_HOURS,
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

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Safety & preferences"
        description="Caps, thresholds, theme, and integrations."
      />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Light, dark, or system theme.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Color mode</p>
          <ModeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform connections</CardTitle>
          <CardDescription>
            Connect LinkedIn, X, GitHub, and more. Data refreshes at least every{" "}
            {PLATFORM_SYNC_MAX_AGE_HOURS} hours and again before drafts/apply.
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
          <CardTitle>Volume caps</CardTitle>
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
            <span>Max drafts / week</span>
            <span className="font-mono text-foreground">
              {VOLUME_CAPS.maxDraftsPerWeek}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span>Free tier drafts / month</span>
            <span className="font-mono text-foreground">
              {VOLUME_CAPS.freeDraftsPerMonth}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shortlist thresholds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Auto-approve (opt-in)</span>
            <span className="font-mono text-foreground">
              ≥ {Math.round(SHORTLIST_THRESHOLDS.autoApproveMin * 100)}%
            </span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span>Requires review</span>
            <span className="font-mono text-foreground">
              &lt; {Math.round(SHORTLIST_THRESHOLDS.reviewBelow * 100)}%
            </span>
          </div>
          <p className="pt-2 text-xs">
            Auto-approve only queues extension packages — it never clicks Submit
            on job sites.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chrome extension</CardTitle>
          <CardDescription>
            Load{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              apps/extension
            </code>{" "}
            via chrome://extensions (Developer mode → Load unpacked). Prefills
            forms; you submit.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
