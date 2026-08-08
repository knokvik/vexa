"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Network,
  Search,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Contact = {
  id: string;
  name: string;
  email: string;
  title?: string;
  companyName?: string;
  roleType: string;
  strength: number;
};

export default function NetworkPage() {
  const [summary, setSummary] = useState<{
    contactCount: number;
    companyCount: number;
    relationshipCount: number;
    warmCompanies: Array<{ name: string; count: number }>;
    contacts: Contact[];
  } | null>(null);
  const [companyQ, setCompanyQ] = useState("");
  const [who, setWho] = useState<{
    message?: string;
    direct?: Array<{ contact: Contact; hops: number }>;
    referralPaths?: Array<{
      bridge: Contact;
      target: Contact;
      relationship: { type: string };
    }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    companyName: "",
    title: "",
    roleType: "recruiter",
  });
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/crm/network");
    setSummary(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function queryCompany() {
    if (!companyQ.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/crm/network?company=${encodeURIComponent(companyQ.trim())}`
      );
      setWho(await res.json());
    } finally {
      setBusy(false);
    }
  }

  async function addContact() {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/crm/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setNote(`Added ${json.contact.name}`);
      setForm({
        name: "",
        email: "",
        companyName: "",
        title: "",
        roleType: "recruiter",
      });
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Graph"
        title="Network"
        description="Contacts are nodes. Who do you know at a company? Warm paths beat cold apply volume."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Contacts</CardDescription>
            <CardTitle className="font-mono text-2xl">
              {summary?.contactCount ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Companies</CardDescription>
            <CardTitle className="font-mono text-2xl">
              {summary?.companyCount ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Relationships</CardDescription>
            <CardTitle className="font-mono text-2xl">
              {summary?.relationshipCount ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4" /> Who do I know at…?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Stripe, Linear, OpenAI…"
              value={companyQ}
              onChange={(e) => setCompanyQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void queryCompany()}
            />
            <Button disabled={busy} onClick={() => void queryCompany()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Find"}
            </Button>
          </div>
          {who && (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">{who.message}</p>
              {(who.direct || []).map((d) => (
                <div
                  key={d.contact.id}
                  className="rounded-lg border px-3 py-2"
                >
                  <p className="font-medium">{d.contact.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.contact.email}
                    {d.contact.title ? ` · ${d.contact.title}` : ""}
                    {" · "}
                    <Badge variant="outline" className="text-[10px]">
                      {d.contact.roleType}
                    </Badge>
                  </p>
                </div>
              ))}
              {(who.referralPaths || []).map((p, i) => (
                <div key={i} className="rounded-lg border border-dashed px-3 py-2">
                  <p className="text-xs text-muted-foreground">2nd degree</p>
                  <p className="font-medium">
                    {p.bridge.name} → {p.target.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({p.relationship.type})
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="size-4" /> Add contact
            </CardTitle>
            <CardDescription>
              Manual graph node — or grow automatically via Pipeline email drop.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(
              [
                ["name", "Name"],
                ["email", "Email"],
                ["companyName", "Company"],
                ["title", "Title"],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  value={form[k]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [k]: e.target.value }))
                  }
                />
              </div>
            ))}
            <Button
              className="w-full"
              disabled={busy || !form.name || !form.email}
              onClick={() => void addContact()}
            >
              Save contact
            </Button>
            {note && (
              <p className="text-xs text-muted-foreground">{note}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="size-4" /> Warm companies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(summary?.warmCompanies || []).map((c) => (
                <li
                  key={c.name}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    className="font-medium hover:underline"
                    onClick={() => {
                      setCompanyQ(c.name);
                      void (async () => {
                        setCompanyQ(c.name);
                        const res = await fetch(
                          `/api/crm/network?company=${encodeURIComponent(c.name)}`
                        );
                        setWho(await res.json());
                      })();
                    }}
                  >
                    {c.name}
                  </button>
                  <Badge variant="secondary" className="font-mono">
                    {c.count}
                  </Badge>
                </li>
              ))}
              {!summary?.warmCompanies?.length && (
                <li className="text-sm text-muted-foreground">
                  No contacts yet. Drop emails on Pipeline.
                </li>
              )}
            </ul>
            <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto">
              {(summary?.contacts || []).slice(0, 40).map((c) => (
                <li
                  key={c.id}
                  className="truncate text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{c.name}</span>
                  {c.companyName ? ` · ${c.companyName}` : ""} · {c.email}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
