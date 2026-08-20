import Link from "next/link";

const NAV = [
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/payment-policy", label: "Payment Policy" },
  { href: "/legal/fees-and-payouts", label: "Fees & Payout Policy" },
  { href: "/legal/buyer-protection", label: "Buyer Protection Policy" },
  { href: "/legal/refund-policy", label: "Refund Policy" },
  { href: "/legal/cancellation-policy", label: "Cancellation Policy" },
  { href: "/legal/dispute-policy", label: "Dispute Policy" },
  { href: "/legal/shipping-policy", label: "Shipping Policy" },
  { href: "/legal/prohibited-items", label: "Prohibited Items" },
  { href: "/legal/authenticity-policy", label: "Authenticity Policy" },
  { href: "/legal/seller-guidelines", label: "Seller Policy & Guidelines" },
  { href: "/legal/community-guidelines", label: "Community Guidelines" },
];

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-gold-light transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <article className="max-w-3xl">
          <h1 className="text-3xl font-display font-bold mb-2">{title}</h1>
          <p className="text-xs text-muted-2 mb-8">Last updated {updated}</p>
          <div className="prose-legal flex flex-col gap-5 text-sm text-muted leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-foreground">
            {children}
          </div>
        </article>
      </div>
    </div>
  );
}
