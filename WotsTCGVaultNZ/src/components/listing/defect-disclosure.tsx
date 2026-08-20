import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { DEFECT_FIELDS } from "@/lib/constants";

export type DefectFlags = {
  defectWhiteningBack: boolean;
  defectWhiteningCorners: boolean;
  defectScratches: boolean;
  defectDents: boolean;
  defectCreases: boolean;
  defectSurfaceDamage: boolean;
  defectPrintLines: boolean;
  defectEdgeWear: boolean;
  defectBends: boolean;
  defectWaterDamage: boolean;
  defectOtherNotes?: string | null;
};

export function DefectDisclosure({ listing }: { listing: DefectFlags }) {
  const flagged = DEFECT_FIELDS.filter((d) => listing[d.key as keyof DefectFlags]);

  if (flagged.length === 0 && !listing.defectOtherNotes) {
    return (
      <div className="flex items-center gap-2 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" /> Seller has disclosed no visible defects.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-warning/30 bg-warning/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-warning mb-2">
        <AlertTriangle className="h-4 w-4" /> Seller-disclosed condition notes
      </p>
      <ul className="text-sm text-muted list-disc list-inside space-y-0.5">
        {flagged.map((d) => (
          <li key={d.key}>{d.label}</li>
        ))}
      </ul>
      {listing.defectOtherNotes && (
        <p className="text-sm text-muted mt-2 italic">&ldquo;{listing.defectOtherNotes}&rdquo;</p>
      )}
    </div>
  );
}
