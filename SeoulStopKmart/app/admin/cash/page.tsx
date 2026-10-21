import { getServerSession } from "next-auth";
import { authOptions, roleAtLeast } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Forbidden } from "@/components/admin/Forbidden";
import { expectedBalances } from "@/lib/shifts";
import { formatCentavosAsPHP } from "@/lib/money";
import { formatManilaDateTime } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cash counts" };

/** Signed peso amount: "+₱20.00" / "−₱5.00" / "₱0.00 (balanced)". */
function variance(counted: number, expected: number) {
  const diff = counted - expected;
  if (diff === 0) return { text: "Balanced", className: "text-emerald-700", diff };
  return {
    text: `${diff > 0 ? "Over" : "Short"} ${formatCentavosAsPHP(Math.abs(diff))}`,
    className: diff > 0 ? "text-amber-700" : "text-red-600",
    diff,
  };
}

export default async function CashCountsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !roleAtLeast(session.user.role, "MANAGER")) return <Forbidden />;

  const sessions = await prisma.cashSession.findMany({ orderBy: { openedAt: "desc" }, take: 60 });

  // Closed sessions carry a frozen "expected" snapshot; open ones are shown live.
  const rows = await Promise.all(
    sessions.map(async (s) => {
      if (s.closedAt) return { s, live: null };
      return { s, live: await expectedBalances(s) };
    })
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Cash counts</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Each cashier&apos;s start-of-shift and end-of-shift cash and GCash. <em>Expected</em> = the opening amount plus that cashier&apos;s cash / GCash sales
        since they started (voided sales excluded). Cashiers don&apos;t see the expected figure when they count.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Cashier</th>
              <th className="px-4 py-3 font-medium">Shift</th>
              <th className="px-4 py-3 text-right font-medium">Cash start</th>
              <th className="px-4 py-3 text-right font-medium">Cash expected</th>
              <th className="px-4 py-3 text-right font-medium">Cash end</th>
              <th className="px-4 py-3 text-right font-medium">GCash start</th>
              <th className="px-4 py-3 text-right font-medium">GCash expected</th>
              <th className="px-4 py-3 text-right font-medium">GCash end</th>
              <th className="px-4 py-3 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-neutral-400">
                  No cash counts yet. Cashiers record them from the POS screen.
                </td>
              </tr>
            )}
            {rows.map(({ s, live }) => {
              const expCash = s.expectedCashCentavos ?? live?.expectedCashCentavos ?? s.openingCashCentavos;
              const expGcash = s.expectedGcashCentavos ?? live?.expectedGcashCentavos ?? s.openingGcashCentavos;
              const closed = s.closedAt !== null;
              const cashV = closed ? variance(s.closingCashCentavos ?? 0, expCash) : null;
              const gcashV = closed ? variance(s.closingGcashCentavos ?? 0, expGcash) : null;
              return (
                <tr key={s.id} className="border-b border-neutral-100 align-top last:border-b-0">
                  <td className="px-4 py-3 text-neutral-900">{s.cashierName}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {formatManilaDateTime(s.openedAt)}
                    <br />→ {s.closedAt ? formatManilaDateTime(s.closedAt) : <span className="font-medium text-emerald-700">open now</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCentavosAsPHP(s.openingCashCentavos)}</td>
                  <td className="px-4 py-3 text-right text-neutral-500">{formatCentavosAsPHP(expCash)}</td>
                  <td className="px-4 py-3 text-right font-medium">{closed ? formatCentavosAsPHP(s.closingCashCentavos ?? 0) : "—"}</td>
                  <td className="px-4 py-3 text-right">{formatCentavosAsPHP(s.openingGcashCentavos)}</td>
                  <td className="px-4 py-3 text-right text-neutral-500">{formatCentavosAsPHP(expGcash)}</td>
                  <td className="px-4 py-3 text-right font-medium">{closed ? formatCentavosAsPHP(s.closingGcashCentavos ?? 0) : "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {closed && cashV && gcashV ? (
                      <>
                        <span className={`block font-medium ${cashV.className}`}>Cash: {cashV.text}</span>
                        <span className={`block font-medium ${gcashV.className}`}>GCash: {gcashV.text}</span>
                        {s.note && <span className="mt-1 block text-neutral-500">“{s.note}”</span>}
                      </>
                    ) : (
                      <span className="text-neutral-400">In progress</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-400">
        Cash taken out of the drawer for expenses (e.g. paying a supplier) isn&apos;t a sale, so it shows up as &ldquo;short&rdquo; unless the cashier
        notes it — read the note beside the result.
      </p>
    </div>
  );
}
