import { notFound, redirect } from "next/navigation";
import { getOrderById } from "@/lib/orders";
import { isPaymongoConfigured } from "@/lib/paymongo";
import { OrderSummary } from "@/components/OrderSummary";
import { PaymentPanel } from "@/components/PaymentPanel";

export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: { orderId: string } }) {
  const order = await getOrderById(params.orderId);
  if (!order) notFound();
  if (order.paymentStatus === "PAID") redirect(`/checkout/success?orderId=${order.id}`);

  const configured = isPaymongoConfigured();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Payment</h1>

      {!configured && (
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          No PayMongo API keys configured — using the mock payment flow. See .env.example to add sandbox keys.
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-10 md:grid-cols-5">
        <div className="md:col-span-3">
          <PaymentPanel orderId={order.id} />
        </div>
        <div className="md:col-span-2">
          <OrderSummary
            lines={order.items.map((i) => ({
              key: i.id,
              name: i.productName,
              quantity: i.quantity,
              priceCentavos: i.unitPriceCentavos,
            }))}
            subtotalCentavos={order.subtotalCentavos}
            deliveryFeeCentavos={order.deliveryFeeCentavos}
            discountCentavos={order.discountCentavos}
            totalCentavos={order.totalCentavos}
          />
        </div>
      </div>
    </div>
  );
}
