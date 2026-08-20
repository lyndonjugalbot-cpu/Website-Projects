import Link from "next/link";
import { Facebook, MapPin, ShieldCheck, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerificationBadges } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { MessageSellerButton } from "@/components/listing/message-seller-button";
import { FollowSellerButton } from "@/components/listing/follow-seller-button";

export function SellerCard({
  seller,
  listingId,
}: {
  seller: {
    id: string;
    username: string;
    displayName: string | null;
    fullName: string;
    avatarUrl: string | null;
    location: string | null;
    isEmailVerified: boolean;
    isFacebookLinked: boolean;
    isIdVerified: boolean;
    isTrustedSeller: boolean;
    joinedAt: Date;
    facebookConnection: { profileUrl: string; publicConsent: boolean } | null;
    avgRating: number | null;
    reviewCount: number;
    activeListingCount: number;
  };
  listingId: string;
}) {
  return (
    <div className="card-luxury p-5">
      <div className="flex items-center gap-3">
        <Avatar className="h-14 w-14">
          <AvatarImage src={seller.avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{(seller.displayName ?? seller.fullName).slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-medium flex items-center gap-1 truncate">
            {seller.displayName ?? seller.fullName}
            {seller.isIdVerified && <ShieldCheck className="h-4 w-4 text-gold shrink-0" />}
          </p>
          <p className="text-xs text-muted-2">@{seller.username}</p>
          {seller.avgRating !== null && (
            <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
              <Star className="h-3 w-3 fill-gold text-gold" /> {seller.avgRating.toFixed(1)} ({seller.reviewCount})
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <VerificationBadges
          emailVerified={seller.isEmailVerified}
          facebookLinked={seller.isFacebookLinked}
          idVerified={seller.isIdVerified}
          trustedSeller={seller.isTrustedSeller}
        />
      </div>

      <div className="mt-4 space-y-1.5 text-xs text-muted">
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-gold" /> {seller.location ?? "New Zealand"}
        </p>
        <p>{seller.activeListingCount} active listing{seller.activeListingCount === 1 ? "" : "s"}</p>
        {seller.facebookConnection?.publicConsent && (
          <a
            href={seller.facebookConnection.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-gold hover:underline"
          >
            <Facebook className="h-3.5 w-3.5" /> View Facebook profile
          </a>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <MessageSellerButton sellerId={seller.id} listingId={listingId} sellerName={seller.displayName ?? seller.fullName} />
        <FollowSellerButton sellerId={seller.id} />
        <Button asChild variant="outline" size="sm">
          <Link href={`/profile/${seller.username}`}>View Profile</Link>
        </Button>
      </div>
    </div>
  );
}
