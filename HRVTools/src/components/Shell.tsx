import { useAuthActions } from "@convex-dev/auth/react";
import { HeartPulse, KeyRound, LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { UserDoc } from "../types";
import { ChangePasswordModal } from "./ChangePasswordModal";

export function Shell({ user, children }: { user: UserDoc; children: ReactNode }) {
  const { signOut } = useAuthActions();
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <HeartPulse size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-white">HRV Coaching Log</p>
              <p className="text-xs leading-tight text-slate-500 dark:text-slate-400">
                {user.role === "admin" ? "Admin / Team Leader" : "Employee"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline dark:text-slate-300">{user.name}</span>
            <button
              onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <KeyRound size={14} />
              <span className="hidden sm:inline">Change password</span>
            </button>
            <button
              onClick={() => void signOut()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}
