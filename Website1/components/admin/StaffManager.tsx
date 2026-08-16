"use client";

import { useState } from "react";
import type { UserRole } from "@/generated/prisma/enums";

type StaffUser = { id: string; name: string; email: string; role: UserRole; isActive: boolean; createdAt: string };

const ROLE_LABELS: Record<UserRole, string> = { OWNER: "Owner", MANAGER: "Manager", STAFF: "Staff" };

export function StaffManager({ currentUserId, initialUsers }: { currentUserId: string; initialUsers: StaffUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF" as UserRole });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create account");
      setUsers((prev) => [...prev, { ...data.user, createdAt: data.user.createdAt }]);
      setForm({ name: "", email: "", password: "", role: "STAFF" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setIsCreating(false);
    }
  }

  async function updateUser(id: string, patch: { role?: UserRole; isActive?: boolean }) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Could not update account");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data.user } : u)));
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 last:border-b-0">
                <td className="px-4 py-3 text-neutral-900">
                  {u.name} {u.id === currentUserId && <span className="text-xs text-neutral-400">(you)</span>}
                </td>
                <td className="px-4 py-3 text-neutral-600">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    disabled={u.id === currentUserId}
                    onChange={(e) => updateUser(u.id, { role: e.target.value as UserRole })}
                    className="input py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-neutral-100"
                  >
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={u.id === currentUserId}
                    onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                    className={`rounded-full px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                      u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    {u.isActive ? "Active" : "Deactivated"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleCreate} className="flex max-w-lg flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="font-medium text-neutral-900">Add a staff account</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Name</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Email</span>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Temporary password</span>
            <input
              type="text"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-neutral-700">Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} className="input">
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isCreating}
          className="self-start rounded-full bg-brand-red px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isCreating ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
