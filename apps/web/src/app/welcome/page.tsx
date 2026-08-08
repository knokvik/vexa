import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@vexa/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/mode-toggle";
import { VexaLogo } from "@/components/VexaLogo";

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container flex justify-end py-4">
        <ModeToggle />
      </div>
      <div className="container flex max-w-4xl flex-col items-start gap-8 pb-24 pt-12">
        <div className="flex items-center gap-4">
          <VexaLogo size="xl" />
          <Badge variant="secondary">AI job copilot</Badge>
        </div>
        <div className="space-y-3">
          <h1 className="text-5xl font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="text-xl text-muted-foreground">{APP_TAGLINE}</p>
        </div>
        <p className="max-w-xl text-lg text-muted-foreground">
          Humanized resumes. ATS + shortlist scores. Draft inbox. One-tap
          prefill from your browser — you always click submit.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/">Open dashboard</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/onboarding">Set up profile</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
