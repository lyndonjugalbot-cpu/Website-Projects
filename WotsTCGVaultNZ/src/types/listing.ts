import type {
  Listing,
  ListingImage,
  User,
} from "@prisma/client";

export type ListingCardData = Pick<
  Listing,
  | "id"
  | "title"
  | "slug"
  | "category"
  | "setName"
  | "priceCents"
  | "condition"
  | "gradingCompany"
  | "grade"
  | "region"
  | "createdAt"
  | "favoriteCount"
> & {
  images: Pick<ListingImage, "url" | "angle">[];
  seller: Pick<
    User,
    "username" | "displayName" | "fullName" | "isIdVerified" | "isTrustedSeller" | "avatarUrl"
  >;
  isFavorited?: boolean;
};
