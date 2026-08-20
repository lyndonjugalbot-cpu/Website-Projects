"use client";

import * as React from "react";
import { formatDate } from "@/lib/utils";

type AuditLog = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
  actor: { username: string } | null;
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/admin/audit-logs")
      .then((res) => res.json())
      .then((data) => setLogs(data.logs ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted-2">Loading…</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-2 border-b border-white/10">
            <th className="py-2 pr-4">Time</th>
            <th className="py-2 pr-4">Actor</th>
            <th className="py-2 pr-4">Action</th>
            <th className="py-2 pr-4">Target</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-white/5">
              <td className="py-2 pr-4 text-xs text-muted-2 whitespace-nowrap">{formatDate(log.createdAt)}</td>
              <td className="py-2 pr-4">{log.actor ? `@${log.actor.username}` : "system"}</td>
              <td className="py-2 pr-4 font-mono text-xs">{log.action}</td>
              <td className="py-2 pr-4 text-xs text-muted-2">
                {log.targetType}
                {log.targetId ? ` #${log.targetId.slice(-8)}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
