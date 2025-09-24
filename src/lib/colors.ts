import { StatusCategory } from "@shared/types";

const STATUS_COLOR_MAP: Record<StatusCategory, string> = {
  "To Do": "#4C6EF5",
  "In Progress": "#F59F00",
  Done: "#51CF66"
};

const STATUS_NAME_COLOR_MAP: Record<string, string> = {
  "program backlog": "#8B5CF6",
  implementing: "#0EA5E9"
};

export function getStatusColor(
  category?: StatusCategory,
  statusName?: string | null
): string {
  if (statusName) {
    const normalized = statusName.toLowerCase().trim();
    const color = STATUS_NAME_COLOR_MAP[normalized];
    if (color) {
      return color;
    }
  }

  if (category) {
    return STATUS_COLOR_MAP[category] ?? "#64748B";
  }

  return "#64748B";
}

export function getStatusLabelColor(
  category?: StatusCategory,
  statusName?: string | null
): string {
  return getContrastingTextColor(getStatusColor(category, statusName));
}

function getContrastingTextColor(hex: string): string {
  const normalized = hex.replace("#", "");

  if (normalized.length !== 6) {
    return "#0F172A";
  }

  const [r, g, b] = [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16)
  ].map((value) => value / 255);

  const toLinear = (value: number) =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);

  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const luminance = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;

  return luminance > 0.5 ? "#0F172A" : "#F8FAFC";
}
