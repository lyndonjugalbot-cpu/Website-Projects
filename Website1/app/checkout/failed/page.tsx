import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function CheckoutFailedPage({
  searchParams,
}: {
  searchParams: { orderId?: string };
}) {
  if (!searchParams.orderId) notFound();
  const order = await getOrderById(searchParams.orderId);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-7 w-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-900">Payment failed</h1>
      <p className="mt-2 text-neutral-500">
        Your payment for order <span className="font-mono">{order.id}</span> didn&apos;t go through. No charge was
        made. You can try again with the same or a different payment method.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href={`/checkout/${order.id}/pay`}
          className="inline-flex w-full max-w-xs items-center justify-center rounded-full bg-brand-red px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-red-dark"
        >
          Retry payment
        </Link>
        <Link href="/cart" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
          Back to cart
        </Link>
      </div>
    </div>
  );
}
