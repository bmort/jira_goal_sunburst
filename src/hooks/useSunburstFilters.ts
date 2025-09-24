import { useCallback, useEffect, useState } from "react";

import { SunburstFilters } from "@shared/types";

const STORAGE_KEY = "jira-goal-starburst:filters";

const DEFAULT_FILTERS: SunburstFilters = {
  pi: ""
};

type FiltersUpdater =
  | SunburstFilters
  | ((current: SunburstFilters) => SunburstFilters);

export function useSunburstFilters(): [SunburstFilters, (updater: FiltersUpdater) => void] {
  const [filters, setFilters] = useState<SunburstFilters>(() => {
    const fromUrl = parseFromUrl();
    const fromStorage = parseFromStorage();

    return normalizeFilters({
      ...DEFAULT_FILTERS,
      ...fromStorage,
      ...fromUrl
    });
  });

  useEffect(() => {
    const handlePopState = () => {
      setFilters((current) => ({
        ...current,
        ...parseFromUrl()
      }));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    persist(filters);
  }, [filters]);

  const updateFilters = useCallback((updater: FiltersUpdater) => {
    setFilters((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return normalizeFilters(next);
    });
  }, []);

  return [filters, updateFilters];
}

function parseFromStorage(): Partial<SunburstFilters> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<SunburstFilters>;
    return normalizeFilters(parsed);
  } catch (error) {
    console.warn("Failed to read filters from storage", error);
    return {};
  }
}

function parseFromUrl(): Partial<SunburstFilters> {
  const params = new URLSearchParams(window.location.search);
  const pi = params.get("pi") ?? undefined;

  return normalizeFilters({
    pi: pi ?? ""
  });
}

function normalizeFilters(filters: Partial<SunburstFilters>): SunburstFilters {
  return {
    pi: filters.pi ?? ""
  };
}

function persist(filters: SunburstFilters) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    console.warn("Failed to persist filters", error);
  }

  const params = new URLSearchParams(window.location.search);
  if (filters.pi) {
    params.set("pi", filters.pi);
  } else {
    params.delete("pi");
  }

  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", nextUrl);
}
