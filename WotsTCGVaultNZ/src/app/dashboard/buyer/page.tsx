import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { BuyerDashboard } from "@/components/dashboard/buyer-dashboard";

export const metadata: Metadata = { title: "Buyer Dashboard" };

export default async function BuyerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/dashboard/buyer");
  return <BuyerDashboard />;
}
