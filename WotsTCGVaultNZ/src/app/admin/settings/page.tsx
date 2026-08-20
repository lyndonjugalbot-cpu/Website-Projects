"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Settings = {
  platformCommissionBps: number;
  platformFixedFeeCents: number;
  buyerPaysFees: boolean;
  buyerFeeBps: number;
  reserveBps: number;
  inspectionPeriodHours: number;
  autoPayoutEnabled: boolean;
  maxAutoPayoutCents: number;
  maxDeliveryWaitDays: number;
  reservationTtlMinutes: number;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data.settings));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        toast.error("Could not save settings.");
        return;
      }
      toast.success("Platform payment settings updated.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p className="text-sm text-muted-2">Loading…</p>;

  return (
    <div className="max-w-lg flex flex-col gap-8">
      <div className="rounded-md border border-gold/20 bg-gold/5 p-3 text-xs text-muted">
        bps = basis points (100 bps = 1%). Changes apply to new orders/payouts going forward only.
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-sm">Fees</h2>
        <div>
          <Label>Platform commission (bps, on item subtotal)</Label>
          <Input
            type="number"
            className="mt-1.5"
            value={settings.platformCommissionBps}
            onChange={(e) => setSettings({ ...settings, platformCommissionBps: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Fixed platform fee per order (cents)</Label>
          <Input
            type="number"
            className="mt-1.5"
            value={settings.platformFixedFeeCents}
            onChange={(e) => setSettings({ ...settings, platformFixedFeeCents: Number(e.target.value) })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={settings.buyerPaysFees}
            onCheckedChange={(v) => setSettings({ ...settings, buyerPaysFees: v })}
          />
          Charge buyers a payment processing surcharge
        </label>
        {settings.buyerPaysFees && (
          <div>
            <Label>Buyer fee (bps)</Label>
            <Input
              type="number"
              className="mt-1.5"
              value={settings.buyerFeeBps}
              onChange={(e) => setSettings({ ...settings, buyerFeeBps: Number(e.target.value) })}
            />
          </div>
        )}
        <div>
          <Label>Rolling reserve withheld from each payout (bps)</Label>
          <Input
            type="number"
            className="mt-1.5"
            value={settings.reserveBps}
            onChange={(e) => setSettings({ ...settings, reserveBps: Number(e.target.value) })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-sm">Buyer protection & payout timing</h2>
        <div>
          <Label>Inspection / buyer protection period (hours after delivery)</Label>
          <Input
            type="number"
            className="mt-1.5"
            value={settings.inspectionPeriodHours}
            onChange={(e) => setSettings({ ...settings, inspectionPeriodHours: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Flag for admin review after (days shipped with no delivery confirmation)</Label>
          <Input
            type="number"
            className="mt-1.5"
            value={settings.maxDeliveryWaitDays}
            onChange={(e) => setSettings({ ...settings, maxDeliveryWaitDays: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Listing reservation length during checkout (minutes, Stripe minimum 30)</Label>
          <Input
            type="number"
            className="mt-1.5"
            value={settings.reservationTtlMinutes}
            onChange={(e) => setSettings({ ...settings, reservationTtlMinutes: Number(e.target.value) })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-sm">Payout release</h2>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={settings.autoPayoutEnabled}
            onCheckedChange={(v) => setSettings({ ...settings, autoPayoutEnabled: v })}
          />
          Automatically release eligible payouts (scheduled job)
        </label>
        <div>
          <Label>Maximum payout amount released automatically (cents) — above this requires manual approval</Label>
          <Input
            type="number"
            className="mt-1.5"
            value={settings.maxAutoPayoutCents}
            onChange={(e) => setSettings({ ...settings, maxAutoPayoutCents: Number(e.target.value) })}
          />
        </div>
      </section>

      <Button onClick={save} disabled={saving} className="self-start">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save settings
      </Button>
    </div>
  );
}
