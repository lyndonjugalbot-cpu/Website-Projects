import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sellerEligibility } from "@/lib/rbac";
import { SellerEligibilityChecklist } from "@/components/dashboard/seller-eligibility-checklist";
import { CreateListingForm } from "@/components/forms/create-listing-form";

export const metadata: Metadata = { title: "Create Listing" };

export default async function CreateListingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/sell/new");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const eligibility = sellerEligibility(user);
  if (!eligibility.eligible) {
    return <SellerEligibilityChecklist eligibility={eligibility} />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-display font-bold mb-1">Create a Listing</h1>
      <p className="text-muted mb-8 text-sm">List a card, slab, sealed product or collection for sale.</p>
      <CreateListingForm />
    </div>
  );
}
