import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SellerDashboard } from "@/components/dashboard/seller-dashboard";

export const metadata: Metadata = { title: "Seller Dashboard" };

export default async function SellerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/dashboard/seller");
  return <SellerDashboard />;
}
