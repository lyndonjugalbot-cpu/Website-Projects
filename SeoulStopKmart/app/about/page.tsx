import type { Metadata } from "next";
import { DELIVERY_AREAS, STORE_NAME } from "@/lib/store-config";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">About {STORE_NAME}</h1>
      <p className="mt-4 leading-relaxed text-neutral-600">
        {STORE_NAME} is a Korean grocery mart bringing snacks, instant noodles, beverages, frozen food, sauces, and
        K-beauty essentials to {DELIVERY_AREAS}. We stock the everyday staples and specialty items you&apos;d find in
        a Korean pantry, curated for our local community.
      </p>
      <p className="mt-4 leading-relaxed text-neutral-600">
        Order online, choose your delivery details, and pay the way that&apos;s most convenient for you — GCash,
        Maya, card, cash on delivery, or bank transfer.
      </p>
    </div>
  );
}
