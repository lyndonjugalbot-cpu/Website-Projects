"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FollowSellerButton({ sellerId }: { sellerId: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [following, setFollowing] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  if (session?.user.id === sellerId) return null;

  async function toggle() {
    if (!session) {
      router.push("/login");
      return;
    }
    setPending(true);
    const next = !following;
    setFollowing(next);
    try {
      const res = await fetch("/api/favorite-sellers", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFollowing(!next);
      toast.error("Could not update.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={pending}>
      <Heart className={following ? "h-4 w-4 fill-gold text-gold" : "h-4 w-4"} />
      {following ? "Following" : "Follow Seller"}
    </Button>
  );
}
