"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { AuthCard } from "@/components/shared/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { z } from "zod";

type Input = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Input>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(data: Input) {
    setSubmitting(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Check your inbox">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <MailCheck className="h-10 w-10 text-gold" />
          <p className="text-sm text-muted">
            If an account exists with that email, we&apos;ve sent a link to reset your password.
          </p>
          <Button asChild className="mt-2">
            <Link href="/login">Back to login</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a secure reset link">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" className="mt-1.5" {...register("email")} />
          {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Send reset link
        </Button>
      </form>
      <p className="text-center text-sm text-muted mt-6">
        <Link href="/login" className="text-gold hover:underline">
          Back to login
        </Link>
      </p>
    </AuthCard>
  );
}
