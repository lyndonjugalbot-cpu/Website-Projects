"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { STORE_NAME } from "@/lib/store-config";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Incorrect email or password.");
      setIsSubmitting(false);
      return;
    }

    router.push(searchParams.get("callbackUrl") || "/admin");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col items-center justify-center px-4 sm:px-6">
      <Image src="/brand/logo.png" alt={STORE_NAME} width={140} height={120} className="h-auto w-32" priority />
      <h1 className="mt-6 text-xl font-semibold tracking-tight text-neutral-900">Staff sign in</h1>
      <p className="mt-1 text-sm text-neutral-500">{STORE_NAME} admin dashboard</p>

      <form onSubmit={handleSubmit} className="mt-8 flex w-full flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-neutral-700">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 inline-flex items-center justify-center rounded-full bg-brand-red px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
