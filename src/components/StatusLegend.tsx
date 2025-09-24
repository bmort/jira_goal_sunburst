import { STATUS_CATEGORIES, StatusCategory } from "@shared/types";
import { getStatusColor } from "@/lib/colors";

const EXTRA_STATUSES = ["Program Backlog", "Implementing"] as const;

type ExtraStatus = (typeof EXTRA_STATUSES)[number];

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-light dark:text-muted-dark">
      {STATUS_CATEGORIES.map((category) => (
        <LegendChip key={category} label={category} category={category} />
      ))}
      {EXTRA_STATUSES.map((status) => (
        <LegendChip key={status} label={status} status={status} />
      ))}
    </div>
  );
}

interface LegendChipProps {
  label: string;
  category?: StatusCategory;
  status?: ExtraStatus;
}

function LegendChip({ label, category, status }: LegendChipProps) {
  const color = getStatusColor(category, status);

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border-light bg-panel-light px-3 py-1 text-text-light shadow-sm dark:border-border-dark dark:bg-panel-dark dark:text-text-dark">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </span>
  );
}
