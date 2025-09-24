import type { ChangeEvent } from "react";

import { SunburstFilters, VersionSummary } from "@shared/types";
import clsx from "clsx";

interface FilterBarProps {
  versions: VersionSummary[];
  filters: SunburstFilters;
  onChange: (filters: SunburstFilters) => void;
  onCopyLink: () => Promise<void> | void;
  isCopying: boolean;
  copySuccess: boolean;
}

export function FilterBar({
  versions,
  filters,
  onChange,
  onCopyLink,
  isCopying,
  copySuccess
}: FilterBarProps) {
  const handlePiChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...filters,
      pi: event.target.value
    });
  };

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-md border border-border-light bg-panel-light p-4 text-text-light shadow-sm transition-colors dark:border-border-dark dark:bg-panel-dark dark:text-text-dark">
      <div className="flex flex-col text-sm">
        <label htmlFor="pi" className="mb-1 font-medium text-text-light dark:text-text-dark">
          Program Increment
        </label>
        <select
          id="pi"
          value={filters.pi}
          onChange={handlePiChange}
          className="min-w-[10rem] rounded border border-border-light bg-panel-light px-3 py-2 text-text-light shadow focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400 dark:border-border-dark dark:bg-panel-dark dark:text-text-dark"
        >
          {versions.length === 0 && <option value="">Select PI</option>}
          {versions.map((version) => (
            <option key={version.id} value={version.name}>
              {version.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={async () => onCopyLink()}
        className={clsx(
          "ml-auto inline-flex items-center gap-2 rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-surface-light dark:focus:ring-offset-surface-dark",
          isCopying && "opacity-75"
        )}
        disabled={isCopying}
      >
        <span>{copySuccess ? "Copied" : "Copy Link"}</span>
      </button>
    </section>
  );
}
