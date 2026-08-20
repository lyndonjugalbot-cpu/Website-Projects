"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { GripVertical, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type UploadedImage = {
  id: string;
  url: string;
  angle: "FRONT" | "BACK" | "SIDE" | "ADDITIONAL";
  uploading?: boolean;
};

const MAX_IMAGES = 12;
const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ImageUploader({
  images,
  onChange,
}: {
  images: UploadedImage[];
  onChange: React.Dispatch<React.SetStateAction<UploadedImage[]>>;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (images.length + list.length > MAX_IMAGES) {
      toast.error(`You can upload up to ${MAX_IMAGES} images.`);
      return;
    }

    for (const file of list) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only JPEG, PNG or WEBP images are allowed.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: file is larger than 8MB.`);
        continue;
      }

      const tempId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      onChange((prev) => [...prev, { id: tempId, url: previewUrl, angle: "ADDITIONAL", uploading: true }]);

      try {
        const presignRes = await fetch("/api/upload/listing-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
        });
        const presign = await presignRes.json();
        if (!presignRes.ok) {
          toast.error(presign.error ?? "Image storage isn't configured yet.");
          onChange((prev) => prev.filter((i) => i.id !== tempId));
          continue;
        }

        await fetch(presign.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });

        onChange((prev) =>
          prev.map((img) => (img.id === tempId ? { ...img, url: presign.publicUrl, uploading: false } : img))
        );
      } catch {
        toast.error(`Could not upload ${file.name}.`);
        onChange((prev) => prev.filter((i) => i.id !== tempId));
      }
    }
  }

  function updateImage(id: string, patch: Partial<UploadedImage>) {
    onChange((prev) => prev.map((img) => (img.id === id ? { ...img, ...patch } : img)));
  }

  function removeImage(id: string) {
    onChange((prev) => prev.filter((img) => img.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    onChange((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      const swapWith = idx + dir;
      if (idx === -1 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
          dragOver ? "border-gold bg-gold/5" : "border-white/15 hover:border-gold/40"
        )}
      >
        <UploadCloud className="h-7 w-7 text-gold" />
        <p className="text-sm text-muted">
          Drag and drop images here, or <span className="text-gold">click to browse</span>
        </p>
        <p className="text-xs text-muted-2">JPEG, PNG or WEBP · up to 8MB each · up to {MAX_IMAGES} images</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img, i) => (
            <div key={img.id} className="rounded-md border border-white/10 overflow-hidden">
              <div className="relative aspect-square bg-charcoal">
                <Image src={img.url} alt="" fill className="object-cover" sizes="200px" unoptimized={img.url.startsWith("blob:")} />
                {img.uploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-gold animate-spin" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white hover:bg-danger/80"
                  aria-label="Remove image"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="absolute left-1.5 bottom-1.5 flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(img.id, -1)}
                    disabled={i === 0}
                    className="rounded bg-black/60 p-1 text-white disabled:opacity-30"
                    aria-label="Move earlier"
                  >
                    <GripVertical className="h-3 w-3 rotate-90" />
                  </button>
                </div>
              </div>
              {img.uploading && <Progress value={60} className="h-0.5 rounded-none" />}
              <div className="p-1.5">
                <Select value={img.angle} onValueChange={(v) => updateImage(img.id, { angle: v as UploadedImage["angle"] })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FRONT">Front</SelectItem>
                    <SelectItem value="BACK">Back</SelectItem>
                    <SelectItem value="SIDE">Side</SelectItem>
                    <SelectItem value="ADDITIONAL">Additional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
