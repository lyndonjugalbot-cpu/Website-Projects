"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Ban, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

type AdminUser = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  isEmailVerified: boolean;
  isIdVerified: boolean;
  isTrustedSeller: boolean;
  createdAt: string;
  _count: { listings: number };
};

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then((res) => res.json())
      .then((data) => setUsers(data.users ?? []))
      .finally(() => setLoading(false));
  }, [q]);

  React.useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function act(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error("Action failed.");
      return;
    }
    toast.success("User updated.");
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h2 className="font-semibold">Users</h2>
        <Input placeholder="Search username, email, name…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-2">Loading…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <div key={u.id} className="card-luxury p-4 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <Link href={`/profile/${u.username}`} className="text-sm font-medium hover:text-gold-light">
                  @{u.username}
                </Link>
                <p className="text-xs text-muted-2">
                  {u.fullName} · {u.email} · Joined {formatDate(u.createdAt)} · {u._count.listings} listings
                </p>
              </div>
              <Badge variant="outline">{u.role}</Badge>
              <Badge variant={u.status === "ACTIVE" ? "success" : "danger"}>{u.status}</Badge>
              {u.isIdVerified && (
                <span title="ID verified">
                  <ShieldCheck className="h-4 w-4 text-gold" />
                </span>
              )}

              <div className="flex gap-2 shrink-0">
                {!u.isTrustedSeller ? (
                  <Button size="sm" variant="outline" onClick={() => act(u.id, { isTrustedSeller: true })}>
                    Mark Trusted
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => act(u.id, { isTrustedSeller: false })}>
                    Unmark Trusted
                  </Button>
                )}
                {u.status === "ACTIVE" ? (
                  <Button size="sm" variant="destructive" onClick={() => act(u.id, { status: "BANNED", bannedReason: "Policy violation" })}>
                    <Ban className="h-3.5 w-3.5" /> Ban
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => act(u.id, { status: "ACTIVE" })}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Reinstate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
