import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { FilterBar } from "@/components/FilterBar";
import { SunburstChart } from "@/components/SunburstChart";
import { DetailsSidebar } from "@/components/DetailsSidebar";
import { StatusLegend } from "@/components/StatusLegend";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSunburstFilters } from "@/hooks/useSunburstFilters";
import { useTheme } from "@/hooks/useTheme";
import { fetchSunburst, fetchVersions } from "@/lib/api";
import { VersionSummary } from "@shared/types";

const PROJECT_KEY = "TPO";

type CopyState = "idle" | "copying" | "success" | "error";

const COPY_RESET_MS = 2_000;

const DEFAULT_ERROR = "Something went wrong while fetching data.";

const App = () => {
  const [filters, setFilters] = useSunburstFilters();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [theme, setTheme] = useTheme();

  const versionsQuery = useQuery({
    queryKey: ["versions", PROJECT_KEY],
    queryFn: () => fetchVersions(PROJECT_KEY)
  });

  const sunburstQuery = useQuery({
    queryKey: ["sunburst", filters],
    queryFn: () => fetchSunburst(filters),
    enabled: Boolean(filters.pi)
  });

  if (import.meta.env.DEV) {
    console.log("[sunburst:app] state", {
      filters,
      sunburstStatus: {
        hasData: Boolean(sunburstQuery.data),
        isLoading: sunburstQuery.isLoading,
        isFetching: sunburstQuery.isFetching,
        isPending: sunburstQuery.isPending,
        isSuccess: sunburstQuery.isSuccess
      }
    });
  }

  useEffect(() => {
    if (!versionsQuery.data) {
      return;
    }

    const { versions, defaultPi } = versionsQuery.data;
    const hasCurrent = versions.some((version) => version.name === filters.pi);
    const fallback = defaultPi ?? versions[0]?.name ?? "";

    if (!filters.pi && fallback) {
      setFilters((current) => ({ ...current, pi: fallback }));
      return;
    }

    if (!hasCurrent && fallback) {
      setFilters((current) => ({ ...current, pi: fallback }));
    }
  }, [filters.pi, setFilters, versionsQuery.data]);

  useEffect(() => {
    if (selectedKey && sunburstQuery.data) {
      if (!sunburstQuery.data.meta.issues[selectedKey]) {
        setSelectedKey(null);
      }
    }
  }, [selectedKey, sunburstQuery.data]);

  useEffect(() => {
    if (!filters.pi && sunburstQuery.data?.pi) {
      setFilters((current) => ({ ...current, pi: sunburstQuery.data!.pi }));
    }
  }, [filters.pi, setFilters, sunburstQuery.data?.pi]);

  useEffect(() => {
    setSelectedKey(null);
  }, [filters.pi]);

  const versions = useMemo<VersionSummary[]>(
    () => versionsQuery.data?.versions ?? [],
    [versionsQuery.data?.versions]
  );

  const handleCopyLink = async () => {
    try {
      setCopyState("copying");
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = window.location.href;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyState("success");
    } catch (error) {
      console.warn("Failed to copy link", error);
      setCopyState("error");
    } finally {
      setTimeout(() => setCopyState("idle"), COPY_RESET_MS);
    }
  };

  const sunburstError =
    sunburstQuery.error instanceof Error
      ? sunburstQuery.error.message
      : sunburstQuery.isError
      ? DEFAULT_ERROR
      : null;

  const isSunburstLoading =
    !filters.pi || sunburstQuery.isLoading || sunburstQuery.isFetching;

  if (import.meta.env.DEV) {
    console.log("[sunburst:app] state", {
      filters,
      isSunburstLoading,
      sunburstStatus: {
        hasData: Boolean(sunburstQuery.data),
        isLoading: sunburstQuery.isLoading,
        isFetching: sunburstQuery.isFetching,
        isPending: sunburstQuery.isPending,
        isSuccess: sunburstQuery.isSuccess,
        error: sunburstQuery.error
      }
    });
  }

  const copySuccess = copyState === "success";
  const isCopying = copyState === "copying";

  return (
    <div className="min-h-screen bg-surface-light text-text-light transition-colors dark:bg-surface-dark dark:text-text-dark">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-text-light dark:text-text-dark">
              Jira Goal Starburst
            </h1>
            <p className="text-sm text-muted-light dark:text-muted-dark">
              Explore TPO Goals, linked impacts, delivery items, and objectives for a selected PI.
            </p>
          </div>
          <ThemeToggle theme={theme} onChange={setTheme} />
        </header>

        {versionsQuery.isError && (
          <div className="rounded-md border border-red-500/40 bg-red-100 px-4 py-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            Failed to load PI versions. Please verify your Jira credentials and try again.
          </div>
        )}

        <FilterBar
          versions={versions}
          filters={filters}
          onChange={setFilters}
          onCopyLink={handleCopyLink}
          isCopying={isCopying}
          copySuccess={copySuccess}
        />

        <main className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <section className="flex flex-col gap-4">
            <StatusLegend />
            <SunburstChart
              data={sunburstQuery.data}
              isLoading={isSunburstLoading}
              error={sunburstError}
              onSelect={setSelectedKey}
            />
          </section>

          <DetailsSidebar
            data={sunburstQuery.data}
            selectedKey={selectedKey}
            onClose={() => setSelectedKey(null)}
          />
        </main>

        {(sunburstQuery.data?.warnings?.length ?? 0) > 0 && (
          <footer className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            {sunburstQuery.data?.warnings?.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </footer>
        )}
      </div>
    </div>
  );
};

export default App;
