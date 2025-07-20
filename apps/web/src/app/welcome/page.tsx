import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@vexa/shared";

export default function WelcomePage() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-8 px-6 py-24">
        <span className="badge bg-accent/15 text-accent">AI job copilot</span>
        <h1 className="text-5xl font-semibold tracking-tight">
          {APP_NAME}
          <span className="mt-3 block text-xl font-normal text-zinc-400">
            {APP_TAGLINE}
          </span>
        </h1>
        <p className="max-w-xl text-lg text-zinc-400">
          Humanized resumes. ATS + shortlist scores. Draft inbox. One-tap prefill
          from your browser — you always click submit.
        </p>
        <div className="flex gap-3">
          <Link href="/" className="btn-primary">
            Open dashboard
          </Link>
          <Link href="/onboarding" className="btn-ghost">
            Set up profile
          </Link>
        </div>
      </div>
    </div>
  );
}
