// Central place for Seoul Stop Kmart's business/brand facts referenced
// across the storefront (header, footer, home, contact, checkout
// confirmations). Update these constants as real details become available —
// anything still a placeholder is marked below.

// Displayed name and one-line tagline — shown in the header, footer, home
// page hero, and browser tab title.
export const STORE_NAME = "Seoul Stop Kmart";
export const STORE_TAGLINE = "Your neighborhood Korean mart in Cebu";

// Linked from the footer and home page "Follow us" button.
export const FACEBOOK_URL = "https://www.facebook.com/seoulstopkmart";

// PLACEHOLDER — replace with the real contact details before launch.
export const CONTACT_EMAIL = "seoulstopkmart@gmail.com";
export const CONTACT_PHONE = "+63 900 000 0000";

// Shown on the home page, about page, and contact page.
export const DELIVERY_AREAS = "Cebu City and nearby areas";

// Flat delivery fee for Cebu addresses — a demo default. Replace with
// distance/weight-based pricing (or a delivery-fee table per city) when
// ready; kept as a single constant so it's easy to find and change. Lives
// here (not lib/orders.ts) so client components can import it without
// pulling in server-only Prisma code.
export const DELIVERY_FEE_CENTAVOS = 8000; // ₱80.00
export const BUSINESS_HOURS = "Mon–Sun, 9:00 AM–8:00 PM (PH time)";

// PLACEHOLDER — a real bank account must be added here before accepting
// bank transfer orders for real; shown to customers who pick that method
// at checkout, and orders using it are clearly marked "payment pending
// verification" until staff confirm the transfer manually.
export const BANK_TRANSFER_DETAILS = {
  bankName: "[Bank name — to be provided]",
  accountName: "Seoul Stop Kmart",
  accountNumber: "[Account number — to be provided]",
};

// Business timezone used throughout Reports (date-range filters, "today"
// boundaries) — the Philippines has one fixed offset year-round (no DST),
// so this is safe to hardcode rather than pulling in a timezone library.
export const BUSINESS_TIMEZONE = "Asia/Manila";
export const BUSINESS_UTC_OFFSET_HOURS = 8;

// Staff (not Manager/Owner) can apply a POS discount up to this percentage
// of the sale subtotal without needing anyone else's approval; anything
// above requires a Manager or Owner to ring up the sale themselves. Every
// discount is still recorded with who applied it either way.
export const STAFF_MAX_DISCOUNT_PERCENT = 10;
