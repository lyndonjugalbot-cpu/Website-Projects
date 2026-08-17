import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Forbidden } from "@/components/admin/Forbidden";
import { InventoryManager } from "@/components/admin/InventoryManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) {
    return <Forbidden />;
  }

  const products = await prisma.product.findMany({
    where: { status: { not: "INACTIVE" } },
    select: { id: true, name: true, stock: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Inventory</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every stock change — online sales, POS sales, restocks, and manual adjustments — is logged here.
      </p>

      <div className="mt-8">
        <InventoryManager products={products} />
      </div>
    </div>
  );
}
