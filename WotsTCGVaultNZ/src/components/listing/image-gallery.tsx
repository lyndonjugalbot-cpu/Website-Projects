"use client";

import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type GalleryImage = { url: string; angle: "FRONT" | "BACK" | "SIDE" | "ADDITIONAL" };

const ANGLE_LABELS: Record<GalleryImage["angle"], string> = {
  FRONT: "Front",
  BACK: "Back",
  SIDE: "Side",
  ADDITIONAL: "Additional",
};

export function ImageGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [active, setActive] = React.useState(0);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);

  if (images.length === 0) {
    return (
      <div className="aspect-square rounded-lg border border-white/10 bg-charcoal flex items-center justify-center text-muted-2">
        No images provided
      </div>
    );
  }

  const current = images[active];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-lg border border-gold/15 bg-charcoal group">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0"
          >
            <Image
              src={current.url}
              alt={`${title} — ${ANGLE_LABELS[current.angle]}`}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-105"
              onClick={() => setLightboxOpen(true)}
              priority
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute left-3 top-3">
          <Badge variant="outline" className="bg-black/50 backdrop-blur-md border-white/20 text-white">
            {ANGLE_LABELS[current.angle]}
          </Badge>
        </div>
        <button
          onClick={() => setLightboxOpen(true)}
          className="absolute right-3 top-3 rounded-full bg-black/50 backdrop-blur-md p-2 text-white hover:scale-110 transition-transform"
          aria-label="Zoom image"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActive((a) => (a - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActive((a) => (a + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 sm:grid-cols-6 gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border transition-all",
                i === active ? "border-gold ring-2 ring-gold/30" : "border-white/10 opacity-70 hover:opacity-100"
              )}
            >
              <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl bg-black/95 border-gold/30 p-2">
          <div className="relative aspect-square w-full">
            <Image src={current.url} alt={title} fill sizes="90vw" className="object-contain" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
