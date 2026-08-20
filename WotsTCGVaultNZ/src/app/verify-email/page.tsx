"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { AuthCard } from "@/components/shared/auth-card";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [status, setStatus] = React.useState<"pending" | "success" | "error">("pending");

  React.useEffect(() => {
    if (!token || !email) {
      setStatus("error");
      return;
    }
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    })
      .then((res) => setStatus(res.ok ? "success" : "error"))
      .catch(() => setStatus("error"));
  }, [token, email]);

  return (
    <AuthCard title="Email verification">
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        {status === "pending" && <Loader2 className="h-10 w-10 text-gold animate-spin" />}
        {status === "success" && <CheckCircle2 className="h-10 w-10 text-success" />}
        {status === "error" && <XCircle className="h-10 w-10 text-danger" />}
        <p className="text-sm text-muted">
          {status === "pending" && "Verifying your email address..."}
          {status === "success" && "Your email has been verified. You can now log in."}
          {status === "error" && "This verification link is invalid or has expired."}
        </p>
        {status !== "pending" && (
          <Button asChild className="mt-2">
            <Link href="/login">Continue to log in</Link>
          </Button>
        )}
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
