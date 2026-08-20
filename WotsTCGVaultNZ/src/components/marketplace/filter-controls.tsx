"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABELS, CONDITION_LABELS, GRADING_COMPANY_LABELS } from "@/lib/constants";
import type { ListingFilters } from "./marketplace-view";

export function FilterControls({
  filters,
  onChange,
  onClear,
}: {
  filters: ListingFilters;
  onChange: (patch: Partial<ListingFilters>) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-2">Category</Label>
        <Select
          value={filters.category ?? "all"}
          onValueChange={(v) => onChange({ category: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-2">Price range (NZD)</Label>
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Min"
            value={filters.minPrice ?? ""}
            onChange={(e) => onChange({ minPrice: e.target.value ? Number(e.target.value) : undefined })}
          />
          <span className="text-muted-2">–</span>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            value={filters.maxPrice ?? ""}
            onChange={(e) => onChange({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-2">Condition</Label>
        <Select
          value={filters.condition ?? "all"}
          onValueChange={(v) => onChange({ condition: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Any condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any condition</SelectItem>
            {Object.entries(CONDITION_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-2">Grading company</Label>
        <Select
          value={filters.gradingCompany ?? "all"}
          onValueChange={(v) => onChange({ gradingCompany: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Any grading company" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any grading company</SelectItem>
            {Object.entries(GRADING_COMPANY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-2">Grade</Label>
        <Input
          className="mt-2"
          placeholder="e.g. 10, 9.5"
          value={filters.grade ?? ""}
          onChange={(e) => onChange({ grade: e.target.value || undefined })}
        />
      </div>

      <Button variant="outline" onClick={onClear} className="w-full">
        Clear filters
      </Button>
    </div>
  );
}
