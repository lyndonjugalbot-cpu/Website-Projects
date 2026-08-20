import { Skeleton } from "@/components/ui/skeleton";

export function ListingCardSkeleton() {
  return (
    <div className="card-luxury overflow-hidden">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="p-4 flex flex-col gap-2.5">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-5 w-1/3 mt-1" />
        <Skeleton className="h-3 w-3/5 mt-1" />
      </div>
    </div>
  );
}
