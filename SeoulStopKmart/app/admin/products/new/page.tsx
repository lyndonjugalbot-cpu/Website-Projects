import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { Forbidden } from "@/components/admin/Forbidden";
import { ProductForm } from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) {
    return <Forbidden />;
  }

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-neutral-500 hover:text-neutral-800">
        &larr; All products
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">Add product</h1>

      <div className="mt-8">
        <ProductForm />
      </div>
    </div>
  );
}
