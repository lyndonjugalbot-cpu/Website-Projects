// Shared PHP currency formatter — used everywhere a price needs to be shown
// to a user (storefront, cart, checkout, receipts, admin dashboard).
const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

/** Formats an integer amount in centavos (PHP cents) as a peso string, e.g. "₱349.00". */
export function formatCentavosAsPHP(centavos: number): string {
  return pesoFormatter.format(centavos / 100);
}
