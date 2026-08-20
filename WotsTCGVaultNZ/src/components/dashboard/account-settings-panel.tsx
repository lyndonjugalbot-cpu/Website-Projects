"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { VerificationBadges } from "@/components/shared/badges";

type Account = {
  displayName: string | null;
  fullName: string;
  bio: string | null;
  location: string | null;
  isEmailVerified: boolean;
  isFacebookLinked: boolean;
  isIdVerified: boolean;
  isTrustedSeller: boolean;
  twoFactorEnabled: boolean;
  facebookConnection: { publicConsent: boolean } | null;
};

export function AccountSettingsPanel() {
  const [account, setAccount] = React.useState<Account | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [displayName, setDisplayName] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [fbConsent, setFbConsent] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/account")
      .then((res) => res.json())
      .then((data) => {
        setAccount(data.user);
        setDisplayName(data.user.displayName ?? "");
        setBio(data.user.bio ?? "");
        setFbConsent(data.user.facebookConnection?.publicConsent ?? false);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio }),
      });
      if (!res.ok) {
        toast.error("Could not save changes.");
        return;
      }
      toast.success("Profile updated.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleFbConsent(value: boolean) {
    setFbConsent(value);
    const res = await fetch("/api/account/facebook-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicConsent: value }),
    });
    if (!res.ok) {
      setFbConsent(!value);
      toast.error("Could not update Facebook visibility.");
      return;
    }
    toast.success(value ? "Facebook profile link is now public." : "Facebook profile link is now hidden.");
  }

  if (loading || !account) return <p className="text-sm text-muted-2">Loading settings…</p>;

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h3 className="font-semibold mb-3">Verification Badges</h3>
        <VerificationBadges
          emailVerified={account.isEmailVerified}
          facebookLinked={account.isFacebookLinked}
          idVerified={account.isIdVerified}
          trustedSeller={account.isTrustedSeller}
          size="md"
        />
      </div>

      <div className="card-luxury p-5 flex flex-col gap-4">
        <h3 className="font-semibold">Profile</h3>
        <div>
          <Label>Display name</Label>
          <Input className="mt-1.5" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <Label>Bio</Label>
          <Textarea className="mt-1.5" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <Button onClick={save} disabled={saving} className="self-start">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </Button>
      </div>

      <div className="card-luxury p-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Facebook className="h-4 w-4 text-gold" />
          <div>
            <p className="text-sm font-medium">Show Facebook profile on my public profile</p>
            <p className="text-xs text-muted-2">
              {account.isFacebookLinked ? "Off by default — you choose when to share it." : "Connect Facebook to enable this."}
            </p>
          </div>
        </div>
        <Switch checked={fbConsent} onCheckedChange={toggleFbConsent} disabled={!account.isFacebookLinked} />
      </div>

      <div className="card-luxury p-5 flex items-center justify-between opacity-70">
        <div>
          <p className="text-sm font-medium">Two-factor authentication</p>
          <p className="text-xs text-muted-2">TOTP-based 2FA setup — coming soon.</p>
        </div>
        <Switch checked={account.twoFactorEnabled} disabled />
      </div>
    </div>
  );
}
