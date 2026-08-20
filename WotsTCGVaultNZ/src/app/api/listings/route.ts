import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listingCardSelect, attachFavorites } from "@/lib/queries";
import { listingFilterSchema, createListingSchema } from "@/lib/validations/listing";
import { sellerEligibility } from "@/lib/rbac";
import { slugify } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";
import type { Prisma, ListingCategory, ItemCondition, GradingCompany } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = listingFilterSchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const f = parsed.data;

  const where: Prisma.ListingWhereInput = {
    status: "ACTIVE",
    ...(f.q
      ? {
          OR: [
            { title: { contains: f.q, mode: "insensitive" } },
            { setName: { contains: f.q, mode: "insensitive" } },
            { description: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(f.category ? { category: f.category as ListingCategory } : {}),
    ...(f.condition ? { condition: f.condition as ItemCondition } : {}),
    ...(f.gradingCompany ? { gradingCompany: f.gradingCompany as GradingCompany } : {}),
    ...(f.grade ? { grade: f.grade } : {}),
    ...(f.minPrice || f.maxPrice
      ? {
          priceCents: {
            ...(f.minPrice ? { gte: Math.round(f.minPrice * 100) } : {}),
            ...(f.maxPrice ? { lte: Math.round(f.maxPrice * 100) } : {}),
          },
        }
      : {}),
  };

  const orderBy: Prisma.ListingOrderByWithRelationInput =
    f.sort === "price_asc"
      ? { priceCents: "asc" }
      : f.sort === "price_desc"
        ? { priceCents: "desc" }
        : f.sort === "popular"
          ? { favoriteCount: "desc" }
          : { createdAt: "desc" };

  const [total, listings] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy,
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: listingCardSelect,
    }),
  ]);

  const session = await getServerSession(authOptions);
  const withFavorites = await attachFavorites(listings, session?.user?.id);

  return NextResponse.json({
    listings: withFavorites,
    total,
    page: f.page,
    pageSize: f.pageSize,
    totalPages: Math.max(1, Math.ceil(total / f.pageSize)),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be logged in to create a listing." }, { status: 401 });
  }

  const limited = rateLimit(`listing-create:${session.user.id}`, 20, 60 * 60 * 1000);
  if (!limited.success) {
    return NextResponse.json({ error: "Too many listings created recently. Try again later." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Your account cannot create listings." }, { status: 403 });
  }

  const eligibility = sellerEligibility(user);
  if (!eligibility.eligible) {
    return NextResponse.json(
      { error: "You must complete seller verification before listing items.", eligibility },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const baseSlug = slugify(data.title);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const listing = await prisma.listing.create({
    data: {
      sellerId: user.id,
      title: data.title,
      slug,
      category: data.category,
      setName: data.setName,
      cardNumber: data.cardNumber,
      language: data.language,
      priceCents: data.priceCents,
      quantity: data.quantity,
      condition: data.condition,
      description: data.description,
      defectWhiteningBack: data.defectWhiteningBack,
      defectWhiteningCorners: data.defectWhiteningCorners,
      defectScratches: data.defectScratches,
      defectDents: data.defectDents,
      defectCreases: data.defectCreases,
      defectSurfaceDamage: data.defectSurfaceDamage,
      defectPrintLines: data.defectPrintLines,
      defectEdgeWear: data.defectEdgeWear,
      defectBends: data.defectBends,
      defectWaterDamage: data.defectWaterDamage,
      defectOtherNotes: data.defectOtherNotes,
      gradingCompany: data.gradingCompany,
      grade: data.grade,
      certificationNumber: data.certificationNumber,
      slabDamageNotes: data.slabDamageNotes,
      isAuthenticityDeclared: data.isAuthenticityDeclared,
      region: data.region,
      offersPickup: data.offersPickup,
      offersDelivery: data.offersDelivery,
      returnPolicy: data.returnPolicy,
      videoUrl: data.videoUrl || undefined,
      status: "PENDING_REVIEW",
      images: {
        create: data.images.map((img, i) => ({
          url: img.url,
          angle: img.angle,
          position: img.position ?? i,
          moderationStatus: "PENDING",
        })),
      },
      shippingOptions: {
        create: data.shippingOptions.map((opt) => ({
          name: opt.name,
          priceCents: opt.priceCents,
          region: opt.region,
          hasInsurance: opt.hasInsurance,
        })),
      },
    },
  });

  return NextResponse.json({ ok: true, listingId: listing.id, slug: listing.slug });
}
