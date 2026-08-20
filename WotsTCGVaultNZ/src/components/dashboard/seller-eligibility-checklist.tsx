import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SellerEligibilityChecklist({
  eligibility,
}: {
  eligibility: {
    emailVerified: boolean;
    facebookConnected: boolean;
    idVerified: boolean;
    sellerTermsAccepted: boolean;
  };
}) {
  const steps = [
    { key: "emailVerified", label: "Verify your email address", href: "/dashboard/buyer?tab=settings" },
    { key: "facebookConnected", label: "Connect your Facebook account", href: "/dashboard/buyer?tab=settings" },
    { key: "idVerified", label: "Submit government ID for verification", href: "/dashboard/buyer?tab=verification" },
    { key: "sellerTermsAccepted", label: "Accept the Seller Terms & Guidelines", href: "/legal/seller-guidelines" },
  ] as const;

  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <div className="card-luxury p-8 text-center">
        <h1 className="text-2xl font-display font-bold mb-2">Become a Verified Seller</h1>
        <p className="text-sm text-muted mb-8">
          Complete these steps before you can list an item for sale on Wots TCG Vault NZ.
        </p>
        <div className="flex flex-col gap-3 text-left">
          {steps.map((step) => {
            const done = eligibility[step.key];
            return (
              <div
                key={step.key}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border px-4 py-3",
                  done ? "border-success/30 bg-success/5" : "border-white/10"
                )}
              >
                <span className="flex items-center gap-2.5 text-sm">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-2 shrink-0" />
                  )}
                  {step.label}
                </span>
                {!done && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={step.href}>Start</Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
