import type { Metadata } from "next";
import { BUSINESS_HOURS, CONTACT_EMAIL, CONTACT_PHONE, DELIVERY_AREAS, FACEBOOK_URL, STORE_NAME } from "@/lib/store-config";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Contact us</h1>
      <p className="mt-4 leading-relaxed text-neutral-600">
        Questions about an order, delivery, or product availability? Reach out to {STORE_NAME} through any of the
        channels below, or message us on Facebook — it&apos;s usually the fastest way to reach our team.
      </p>
      <dl className="mt-6 flex flex-col gap-3 text-sm text-neutral-600">
        <div className="flex gap-2">
          <dt className="font-medium text-neutral-900">Facebook:</dt>
          <dd>
            <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
              facebook.com/seoulstopkmart
            </a>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-neutral-900">Email:</dt>
          <dd><a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">{CONTACT_EMAIL}</a></dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-neutral-900">Phone:</dt>
          <dd><a href={`tel:${CONTACT_PHONE.replace(/\s+/g, "")}`} className="hover:underline">{CONTACT_PHONE}</a></dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-neutral-900">Hours:</dt>
          <dd>{BUSINESS_HOURS}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-neutral-900">Delivery area:</dt>
          <dd>{DELIVERY_AREAS}</dd>
        </div>
      </dl>
    </div>
  );
}
