import { ThemeMode } from "@/hooks/useTheme";

interface ThemeToggleProps {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const isDark = theme === "dark";

  const handleToggle = () => {
    onChange(isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="inline-flex items-center gap-2 rounded-full border border-border-light bg-panel-light px-3 py-1.5 text-xs font-semibold text-text-light shadow-sm transition hover:border-teal-500 hover:text-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-surface-light dark:border-border-dark dark:bg-panel-dark dark:text-text-dark dark:hover:border-teal-300 dark:focus:ring-offset-surface-dark"
      aria-label="Toggle light and dark mode"
    >
      <span className="text-base" aria-hidden>
        {isDark ? "🌙" : "☀️"}
      </span>
      <span>{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
