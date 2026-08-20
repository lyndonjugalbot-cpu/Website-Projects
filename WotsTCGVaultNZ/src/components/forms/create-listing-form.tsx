"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader, type UploadedImage } from "@/components/forms/image-uploader";
import { createListingSchema, type CreateListingInput } from "@/lib/validations/listing";
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  GRADING_COMPANY_LABELS,
  LANGUAGE_LABELS,
  DEFECT_FIELDS,
  NZ_REGIONS,
} from "@/lib/constants";

export function CreateListingForm() {
  const router = useRouter();
  const [images, setImages] = React.useState<UploadedImage[]>([]);
  const [shipping, setShipping] = React.useState([{ name: "NZ Post Tracked", priceCents: 700, hasInsurance: false }]);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateListingInput>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
      language: "ENGLISH",
      quantity: 1,
      offersDelivery: true,
      offersPickup: false,
      isAuthenticityDeclared: false,
      images: [],
      shippingOptions: shipping,
      ...Object.fromEntries(DEFECT_FIELDS.map((d) => [d.key, false])),
    },
  });

  const category = watch("category");
  const offersDelivery = watch("offersDelivery");
  const offersPickup = watch("offersPickup");

  async function onSubmit(data: CreateListingInput) {
    const readyImages = images.filter((i) => !i.uploading);
    if (readyImages.length < 2) {
      toast.error("Upload at least two images (front and back) before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateListingInput = {
        ...data,
        images: readyImages.map((img, i) => ({ url: img.url, angle: img.angle, position: i })),
        shippingOptions: shipping,
      };
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Please check the form for errors.");
        return;
      }
      toast.success("Listing submitted for review!");
      router.push("/dashboard/seller");
    } finally {
      setSubmitting(false);
    }
  }

  function addShippingOption() {
    setShipping((s) => [...s, { name: "", priceCents: 0, hasInsurance: false }]);
  }
  function updateShipping(i: number, patch: Partial<(typeof shipping)[number]>) {
    setShipping((s) => s.map((opt, idx) => (idx === i ? { ...opt, ...patch } : opt)));
  }
  function removeShipping(i: number) {
    setShipping((s) => s.filter((_, idx) => idx !== i));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-10">
      <section>
        <h2 className="text-lg font-semibold mb-4">Item Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Title</Label>
            <Input className="mt-1.5" placeholder="e.g. Charizard VMAX Rainbow Rare — Champion's Path" {...register("title")} />
            {errors.title && <p className="text-xs text-danger mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <Label>Category</Label>
            <Select onValueChange={(v) => setValue("category", v as CreateListingInput["category"], { shouldValidate: true })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-danger mt-1">{errors.category.message}</p>}
          </div>

          <div>
            <Label>Language</Label>
            <Select
              defaultValue="ENGLISH"
              onValueChange={(v) => setValue("language", v as CreateListingInput["language"])}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANGUAGE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Set name</Label>
            <Input className="mt-1.5" {...register("setName")} />
          </div>
          <div>
            <Label>Card number (optional)</Label>
            <Input className="mt-1.5" placeholder="e.g. 074/073" {...register("cardNumber")} />
          </div>

          <div>
            <Label>Price (NZD)</Label>
            <Input
              type="number"
              step="0.01"
              min="1"
              className="mt-1.5"
              onChange={(e) => setValue("priceCents", Math.round(Number(e.target.value) * 100), { shouldValidate: true })}
            />
            {errors.priceCents && <p className="text-xs text-danger mt-1">{errors.priceCents.message}</p>}
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" min="1" className="mt-1.5" {...register("quantity", { valueAsNumber: true })} />
          </div>

          {category === "SINGLE_CARD" && (
            <div>
              <Label>Condition</Label>
              <Select onValueChange={(v) => setValue("condition", v as CreateListingInput["condition"], { shouldValidate: true })}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONDITION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.condition && <p className="text-xs text-danger mt-1">{errors.condition.message}</p>}
            </div>
          )}

          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea className="mt-1.5" rows={5} {...register("description")} />
            {errors.description && <p className="text-xs text-danger mt-1">{errors.description.message}</p>}
          </div>
        </div>
      </section>

      {category === "SINGLE_CARD" && (
        <section>
          <h2 className="text-lg font-semibold mb-1">Condition Disclosure</h2>
          <p className="text-sm text-muted-2 mb-4">
            Honestly disclose any visible defects. Non-disclosure may result in listing removal.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {DEFECT_FIELDS.map((d) => (
              <label key={d.key} className="flex items-center gap-2 text-sm">
                <Checkbox onCheckedChange={(v) => setValue(d.key as never, (v === true) as never)} />
                {d.label}
              </label>
            ))}
          </div>
          <div className="mt-4">
            <Label>Other defect notes (optional)</Label>
            <Textarea className="mt-1.5" rows={2} {...register("defectOtherNotes")} />
          </div>
        </section>
      )}

      {category === "GRADED_SLAB" && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Grading Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Grading company</Label>
              <Select onValueChange={(v) => setValue("gradingCompany", v as CreateListingInput["gradingCompany"], { shouldValidate: true })}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select grading company" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GRADING_COMPANY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.gradingCompany && <p className="text-xs text-danger mt-1">{errors.gradingCompany.message}</p>}
            </div>
            <div>
              <Label>Grade</Label>
              <Input className="mt-1.5" placeholder="e.g. 10" {...register("grade")} />
              {errors.grade && <p className="text-xs text-danger mt-1">{errors.grade.message}</p>}
            </div>
            <div>
              <Label>Certification number (optional)</Label>
              <Input className="mt-1.5" {...register("certificationNumber")} />
            </div>
            <div className="sm:col-span-2">
              <Label>Slab condition notes (cracks, scratches, damage)</Label>
              <Textarea className="mt-1.5" rows={3} {...register("slabDamageNotes")} />
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-1">Photos</h2>
        <p className="text-sm text-muted-2 mb-4">
          Upload clear front, back{category === "GRADED_SLAB" ? " and side" : ""} photos. Buyers rely on
          these — accurate photos reduce disputes.
        </p>
        <ImageUploader images={images} onChange={setImages} />
        {errors.images && <p className="text-xs text-danger mt-2">{errors.images.message as string}</p>}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Location & Delivery</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Region</Label>
            <Select onValueChange={(v) => setValue("region", v, { shouldValidate: true })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {NZ_REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.region && <p className="text-xs text-danger mt-1">{errors.region.message}</p>}
          </div>
          <div className="flex items-end gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={offersDelivery} onCheckedChange={(v) => setValue("offersDelivery", v)} /> Delivery
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={offersPickup} onCheckedChange={(v) => setValue("offersPickup", v)} /> Local pickup
            </label>
          </div>
        </div>

        {offersDelivery && (
          <div className="mt-4">
            <Label>Shipping options</Label>
            <div className="flex flex-col gap-2 mt-1.5">
              {shipping.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Name (e.g. NZ Post Tracked)"
                    value={opt.name}
                    onChange={(e) => updateShipping(i, { name: e.target.value })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    className="w-32"
                    placeholder="Price"
                    value={opt.priceCents ? (opt.priceCents / 100).toString() : ""}
                    onChange={(e) => updateShipping(i, { priceCents: Math.round(Number(e.target.value) * 100) })}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted whitespace-nowrap">
                    <Checkbox
                      checked={opt.hasInsurance}
                      onCheckedChange={(v) => updateShipping(i, { hasInsurance: v === true })}
                    />
                    Insured
                  </label>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeShipping(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addShippingOption} className="self-start">
                <Plus className="h-3.5 w-3.5" /> Add shipping option
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4">
          <Label>Return policy (optional)</Label>
          <Textarea className="mt-1.5" rows={2} {...register("returnPolicy")} />
        </div>
      </section>

      <section>
        <div className="flex items-start gap-2.5">
          <Checkbox
            onCheckedChange={(v) => setValue("isAuthenticityDeclared", v === true, { shouldValidate: true })}
          />
          <Label className="text-sm font-normal leading-relaxed">
            I declare that this item is authentic and as described. I understand that
            misrepresenting counterfeit items may result in account suspension.
          </Label>
        </div>
        {errors.isAuthenticityDeclared && (
          <p className="text-xs text-danger mt-1">{errors.isAuthenticityDeclared.message}</p>
        )}
      </section>

      <Button type="submit" size="lg" disabled={submitting} className="self-start">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit Listing for Review
      </Button>
      <p className="text-xs text-muted-2 -mt-6">
        New listings are reviewed by our moderation team before going live, usually within 24 hours.
      </p>
    </form>
  );
}
