import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact — ShopEasePH" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Contact us</h1>
      <p className="mt-4 leading-relaxed text-neutral-600">
        This is a placeholder contact page for the demo store. In a real deployment you&apos;d add a
        contact form, support email, and social links here.
      </p>
      <dl className="mt-6 flex flex-col gap-2 text-sm text-neutral-600">
        <div className="flex gap-2">
          <dt className="font-medium text-neutral-900">Email:</dt>
          <dd>support@example.com</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-neutral-900">Hours:</dt>
          <dd>Mon&ndash;Fri, 9am&ndash;6pm (PH time)</dd>
        </div>
      </dl>
    </div>
  );
}
