export type StatusCategory = "To Do" | "In Progress" | "Done";

export type IssueType =
  | "Goal"
  | "Impact"
  | "Feature"
  | "Story"
  | "Enabler"
  | "Spike"
  | "Objective";

export interface IssueMeta {
  key: string;
  type: IssueType;
  summary: string;
  status: string;
  statusCategory: StatusCategory;
  project: string;
  fixVersions: string[];
  assignee?: string;
  telescope?: string[];
}

export interface SunburstPathNode {
  path: string[];
  id: string;
  label: string;
  statusCategory: StatusCategory;
}

export interface SunburstResponse {
  pi: string;
  truncated: boolean;
  nodes: SunburstPathNode[];
  meta: {
    issues: Record<string, IssueMeta>;
  };
  warnings?: string[];
  browseBaseUrl?: string;
}

export interface VersionSummary {
  id: string;
  name: string;
  released: boolean;
}

export interface SunburstFilters {
  pi: string;
}

export const STATUS_CATEGORIES: StatusCategory[] = [
  "To Do",
  "In Progress",
  "Done"
];
