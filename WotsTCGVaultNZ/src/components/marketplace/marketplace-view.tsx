"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, List, SlidersHorizontal, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListingCard } from "@/components/marketplace/listing-card";
import { ListingCardSkeleton } from "@/components/marketplace/listing-card-skeleton";
import { FilterControls } from "@/components/marketplace/filter-controls";
import { Pagination } from "@/components/marketplace/pagination";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, CONDITION_LABELS, GRADING_COMPANY_LABELS } from "@/lib/constants";
import type { ListingCardData } from "@/types/listing";
import { cn } from "@/lib/utils";

export type ListingFilters = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  gradingCompany?: string;
  grade?: string;
  sort: "newest" | "price_asc" | "price_desc" | "popular";
  page: number;
  view: "grid" | "list";
};

const SORT_LABELS: Record<ListingFilters["sort"], string> = {
  newest: "Newest",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  popular: "Most Popular",
};

function filtersFromParams(params: URLSearchParams): ListingFilters {
  return {
    q: params.get("q") ?? undefined,
    category: params.get("category") ?? undefined,
    minPrice: params.get("minPrice") ? Number(params.get("minPrice")) : undefined,
    maxPrice: params.get("maxPrice") ? Number(params.get("maxPrice")) : undefined,
    condition: params.get("condition") ?? undefined,
    gradingCompany: params.get("gradingCompany") ?? undefined,
    grade: params.get("grade") ?? undefined,
    sort: (params.get("sort") as ListingFilters["sort"]) ?? "newest",
    page: params.get("page") ? Number(params.get("page")) : 1,
    view: (params.get("view") as ListingFilters["view"]) ?? "grid",
  };
}

export function MarketplaceView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = React.useState<ListingFilters>(() => filtersFromParams(searchParams));
  const [searchInput, setSearchInput] = React.useState(filters.q ?? "");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [listings, setListings] = React.useState<ListingCardData[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);

  // Push filter state into the URL so results are shareable/bookmarkable.
  React.useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === "" || value === null) return;
      if (key === "page" && value === 1) return;
      if (key === "sort" && value === "newest") return;
      if (key === "view" && value === "grid") return;
      params.set(key, String(value));
    });
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Debounce free-text search.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === searchInput ? f : { ...f, q: searchInput || undefined, page: 1 }));
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === "") return;
      params.set(key, String(value));
    });
    fetch(`/api/listings?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setListings(data.listings ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters]);

  function patchFilters(patch: Partial<ListingFilters>) {
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }

  function clearFilters() {
    setSearchInput("");
    setFilters({ sort: "newest", page: 1, view: filters.view });
  }

  const activeFilterChips = [
    filters.category && { key: "category", label: CATEGORY_LABELS[filters.category as keyof typeof CATEGORY_LABELS] },
    filters.condition && { key: "condition", label: CONDITION_LABELS[filters.condition as keyof typeof CONDITION_LABELS] },
    filters.gradingCompany && {
      key: "gradingCompany",
      label: GRADING_COMPANY_LABELS[filters.gradingCompany as keyof typeof GRADING_COMPANY_LABELS],
    },
    filters.grade && { key: "grade", label: `Grade ${filters.grade}` },
    (filters.minPrice || filters.maxPrice) && {
      key: "price",
      label: `$${filters.minPrice ?? 0} – $${filters.maxPrice ?? "∞"}`,
    },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Marketplace</h1>
        <p className="text-muted mt-1 text-sm">
          {loading ? "Searching…" : `${total} item${total === 1 ? "" : "s"} available`}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-2" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search cards, sets, sellers..."
            className="pl-9"
            aria-label="Search listings"
          />
        </div>
        <Select value={filters.sort} onValueChange={(v) => patchFilters({ sort: v as ListingFilters["sort"] })}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="lg:hidden flex-1 sm:flex-none"
            onClick={() => setDrawerOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </Button>
          <div className="hidden sm:flex items-center rounded-md border border-white/10 p-1">
            <button
              onClick={() => patchFilters({ view: "grid" })}
              aria-label="Grid view"
              aria-pressed={filters.view === "grid"}
              className={cn("p-1.5 rounded", filters.view === "grid" ? "bg-gold text-black" : "text-muted")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => patchFilters({ view: "list" })}
              aria-label="List view"
              aria-pressed={filters.view === "list"}
              className={cn("p-1.5 rounded", filters.view === "list" ? "bg-gold text-black" : "text-muted")}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {activeFilterChips.map((chip) => (
            <Badge key={chip.key} variant="outline" className="gap-1.5">
              {chip.label}
              <button
                onClick={() =>
                  patchFilters(
                    chip.key === "price"
                      ? { minPrice: undefined, maxPrice: undefined }
                      : { [chip.key]: undefined }
                  )
                }
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button onClick={clearFilters} className="text-xs text-gold hover:underline ml-1">
            Clear all
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <FilterControls filters={filters} onChange={patchFilters} onClear={clearFilters} />
          </div>
        </aside>

        <div>
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </motion.div>
            ) : listings.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="card-luxury py-20 text-center"
              >
                <p className="text-muted">No listings match your filters.</p>
                <button onClick={clearFilters} className="text-gold text-sm hover:underline mt-2">
                  Clear filters
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={`results-${filters.view}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                  filters.view === "grid"
                    ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
                    : "flex flex-col gap-4"
                )}
              >
                {listings.map((listing, i) => (
                  <ListingCard key={listing.id} listing={listing} view={filters.view} index={i} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <Pagination page={filters.page} totalPages={totalPages} onChange={(page) => patchFilters({ page })} />
        </div>
      </div>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <FilterControls
            filters={filters}
            onChange={patchFilters}
            onClear={() => {
              clearFilters();
              setDrawerOpen(false);
            }}
          />
          <Button className="w-full mt-6" onClick={() => setDrawerOpen(false)}>
            Show {total} results
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
