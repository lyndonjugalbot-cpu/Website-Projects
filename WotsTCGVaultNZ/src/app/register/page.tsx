"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthCard } from "@/components/shared/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { NZ_REGIONS } from "@/lib/constants";

export default function RegisterPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const location = watch("location");

  async function onSubmit(data: RegisterInput) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not create account.");
        return;
      }
      toast.success("Account created! Check your email to verify your address.");
      router.push("/login");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Join New Zealand's premium TCG marketplace"
      wide
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" className="mt-1.5" {...register("fullName")} />
          {errors.fullName && <p className="text-xs text-danger mt-1">{errors.fullName.message}</p>}
        </div>

        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" className="mt-1.5" {...register("username")} />
          {errors.username && <p className="text-xs text-danger mt-1">{errors.username.message}</p>}
        </div>

        <div>
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" className="mt-1.5" {...register("email")} />
          {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" className="mt-1.5" {...register("password")} />
          <p className="text-xs text-muted-2 mt-1">At least 10 characters, one uppercase letter, one number.</p>
          {errors.password && <p className="text-xs text-danger mt-1">{errors.password.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="location">New Zealand location</Label>
          <Select value={location} onValueChange={(v) => setValue("location", v, { shouldValidate: true })}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select your region" />
            </SelectTrigger>
            <SelectContent>
              {NZ_REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.location && <p className="text-xs text-danger mt-1">{errors.location.message}</p>}
        </div>

        <div className="sm:col-span-2 flex flex-col gap-3 mt-2">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="acceptTerms"
              onCheckedChange={(v) => setValue("acceptTerms", v === true, { shouldValidate: true })}
            />
            <Label htmlFor="acceptTerms" className="text-xs text-muted font-normal leading-relaxed">
              I accept the{" "}
              <Link href="/legal/terms" className="text-gold hover:underline" target="_blank">
                Marketplace Terms & Conditions
              </Link>
            </Label>
          </div>
          {errors.acceptTerms && <p className="text-xs text-danger">{errors.acceptTerms.message}</p>}

          <div className="flex items-start gap-2.5">
            <Checkbox
              id="acceptPrivacy"
              onCheckedChange={(v) => setValue("acceptPrivacy", v === true, { shouldValidate: true })}
            />
            <Label htmlFor="acceptPrivacy" className="text-xs text-muted font-normal leading-relaxed">
              I accept the{" "}
              <Link href="/legal/privacy" className="text-gold hover:underline" target="_blank">
                Privacy Policy
              </Link>
            </Label>
          </div>
          {errors.acceptPrivacy && <p className="text-xs text-danger">{errors.acceptPrivacy.message}</p>}
        </div>

        <div className="sm:col-span-2 mt-2">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </Button>
        </div>

        <p className="sm:col-span-2 text-center text-xs text-muted-2 -mt-2">
          You&apos;ll connect Facebook and submit ID verification separately before you can sell.
        </p>
      </form>

      <p className="text-center text-sm text-muted mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-gold hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
