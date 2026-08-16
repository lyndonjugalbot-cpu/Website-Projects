import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/orders";
import { formatCentavosAsPHP } from "@/lib/money";
import { MockGatewayActions } from "@/components/MockGatewayActions";

export const dynamic = "force-dynamic";

/**
 * Stands in for the hosted GCash/Maya/card-3DS authorization page a real
 * payment would redirect the customer to. Only reachable for orders using
 * the mock payment flow (see /api/payments/mock-confirm).
 */
export default async function MockGatewayPage({ params }: { params: { orderId: string } }) {
  const order = await getOrderById(params.orderId);
  if (!order || !order.isMockPayment) notFound();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center sm:px-6">
      <div className="w-full rounded-2xl border border-dashed border-neutral-300 p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Simulated payment gateway</p>
        <h1 className="mt-2 text-lg font-semibold text-neutral-900">
          Authorize payment of {formatCentavosAsPHP(order.totalCentavos)}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          This screen stands in for the real {order.paymentMethod?.toUpperCase()} authorization page. No real money
          moves — pick an outcome to continue.
        </p>
        <MockGatewayActions orderId={order.id} />
      </div>
    </div>
  );
}
