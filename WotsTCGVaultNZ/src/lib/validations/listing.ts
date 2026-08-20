import { z } from "zod";

const imageSchema = z.object({
  url: z.string().url(),
  angle: z.enum(["FRONT", "BACK", "SIDE", "ADDITIONAL"]),
  position: z.number().int().min(0),
});

export const createListingSchema = z
  .object({
    title: z.string().min(5, "Title must be at least 5 characters").max(120),
    category: z.enum([
      "SINGLE_CARD",
      "GRADED_SLAB",
      "SEALED_PRODUCT",
      "BOOSTER_BOX",
      "BOOSTER_PACK",
      "ELITE_TRAINER_BOX",
      "COLLECTION",
      "ACCESSORIES",
      "OTHER",
    ]),
    setName: z.string().max(120).optional(),
    cardNumber: z.string().max(40).optional(),
    language: z.enum([
      "ENGLISH",
      "JAPANESE",
      "KOREAN",
      "CHINESE",
      "GERMAN",
      "FRENCH",
      "ITALIAN",
      "SPANISH",
      "OTHER",
    ]),
    priceCents: z.number().int().min(100, "Price must be at least $1.00"),
    quantity: z.number().int().min(1).max(999),
    condition: z
      .enum(["MINT", "NEAR_MINT", "EXCELLENT", "GOOD", "PLAYED", "HEAVILY_PLAYED", "DAMAGED"])
      .optional(),
    description: z.string().min(20, "Description must be at least 20 characters").max(5000),

    defectWhiteningBack: z.boolean().default(false),
    defectWhiteningCorners: z.boolean().default(false),
    defectScratches: z.boolean().default(false),
    defectDents: z.boolean().default(false),
    defectCreases: z.boolean().default(false),
    defectSurfaceDamage: z.boolean().default(false),
    defectPrintLines: z.boolean().default(false),
    defectEdgeWear: z.boolean().default(false),
    defectBends: z.boolean().default(false),
    defectWaterDamage: z.boolean().default(false),
    defectOtherNotes: z.string().max(1000).optional(),

    gradingCompany: z.enum(["PSA", "BGS", "CGC", "ACE", "OTHER"]).optional(),
    grade: z.string().max(20).optional(),
    certificationNumber: z.string().max(60).optional(),
    slabDamageNotes: z.string().max(1000).optional(),

    isAuthenticityDeclared: z.boolean().refine((v) => v === true, {
      message: "You must declare authenticity to list this item",
    }),

    region: z.string().min(2, "Select your region"),
    offersPickup: z.boolean().default(false),
    offersDelivery: z.boolean().default(true),
    shippingOptions: z
      .array(
        z.object({
          name: z.string().min(1),
          priceCents: z.number().int().min(0),
          region: z.string().optional(),
          hasInsurance: z.boolean().default(false),
        })
      )
      .min(1, "Add at least one shipping or pickup option"),
    returnPolicy: z.string().max(2000).optional(),
    videoUrl: z.string().url().optional().or(z.literal("")),

    images: z.array(imageSchema).min(2, "Upload at least a front and back image").max(12),
  })
  .superRefine((data, ctx) => {
    if (data.category === "GRADED_SLAB") {
      if (!data.gradingCompany) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["gradingCompany"],
          message: "Grading company is required for graded slabs",
        });
      }
      if (!data.grade) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["grade"],
          message: "Grade is required for graded slabs",
        });
      }
      const hasFront = data.images.some((i) => i.angle === "FRONT");
      const hasBack = data.images.some((i) => i.angle === "BACK");
      const hasSide = data.images.some((i) => i.angle === "SIDE");
      if (!hasFront || !hasBack || !hasSide) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["images"],
          message: "Graded slabs require front, back, and side images",
        });
      }
    } else if (data.category === "SINGLE_CARD") {
      if (!data.condition) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["condition"],
          message: "Condition is required for single cards",
        });
      }
      const hasFront = data.images.some((i) => i.angle === "FRONT");
      const hasBack = data.images.some((i) => i.angle === "BACK");
      if (!hasFront || !hasBack) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["images"],
          message: "Single cards require at least a front and back image",
        });
      }
    }
    if (!data.offersPickup && !data.offersDelivery) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["offersDelivery"],
        message: "Offer at least one of pickup or delivery",
      });
    }
  });

export type CreateListingInput = z.infer<typeof createListingSchema>;

export const listingFilterSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  condition: z.string().optional(),
  gradingCompany: z.string().optional(),
  grade: z.string().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "popular"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
  view: z.enum(["grid", "list"]).default("grid"),
});
