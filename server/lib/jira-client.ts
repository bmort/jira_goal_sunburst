import { AppConfig } from "@server/config";
import { JiraError } from "@server/lib/errors";

const ISSUE_FIELDS = [
  "key",
  "summary",
  "issuetype",
  "status",
  "project",
  "fixVersions",
  "issuelinks",
  "customfield_12001",
  "statuscategory",
  "assignee"
];

export interface JiraStatusCategory {
  name: string;
  key: string;
}

export interface JiraIssueType {
  name: string;
}

export interface JiraProject {
  key: string;
  name: string;
}

export interface JiraVersion {
  id: string;
  name: string;
  released: boolean;
}

export interface JiraIssueFields {
  summary: string;
  issuetype: JiraIssueType;
  status: {
    name: string;
    statusCategory: JiraStatusCategory;
  };
  project: JiraProject;
  fixVersions: JiraVersion[];
  issuelinks?: JiraIssueLink[];
  customfield_12001?: { value: string }[] | null;
  assignee?: {
    displayName?: string | null;
  } | null;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: JiraIssueFields;
}

export interface JiraIssueRef {
  key: string;
  fields?: Partial<JiraIssueFields>;
}

export interface JiraIssueLinkType {
  name: string;
  inward: string;
  outward: string;
}

export interface JiraIssueLink {
  type: JiraIssueLinkType;
  inwardIssue?: JiraIssueRef;
  outwardIssue?: JiraIssueRef;
}

interface JiraSearchResponse {
  issues: JiraIssue[];
  startAt: number;
  maxResults: number;
  total: number;
}

interface JiraFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export class JiraClient {
  constructor(private readonly config: AppConfig) {}

  private async jiraFetch<T>(path: string, options: JiraFetchOptions = {}): Promise<T> {
    const url = `${this.config.jira.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = options.timeoutMs ?? this.config.jira.requestTimeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.jira.token}`,
          ...(options.headers ?? {})
        }
      });

      if (response.status === 401 || response.status === 403) {
        throw new JiraError("Jira auth failed", response.status);
      }

      if (!response.ok) {
        const text = await response.text();
        throw new JiraError(
          `Jira request failed with ${response.status}: ${text}`,
          response.status
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof JiraError) {
        throw error;
      }

      if ((error as Error).name === "AbortError") {
        throw new JiraError("Jira timeout", 504);
      }

      throw new JiraError((error as Error).message, 500);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async searchIssues(jql: string): Promise<JiraIssue[]> {
    const results: JiraIssue[] = [];
    let startAt = 0;
    const maxResults = 100;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const search = await this.jiraFetch<JiraSearchResponse>(
        `/rest/api/2/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=${encodeURIComponent(
          ISSUE_FIELDS.join(",")
        )}&expand=issuelinks`
      );

      results.push(...search.issues);

      startAt += search.maxResults;
      if (startAt >= search.total) {
        break;
      }
    }

    return results;
  }

  async countIssues(jql: string): Promise<number> {
    const search = await this.jiraFetch<JiraSearchResponse>(
      `/rest/api/2/search?jql=${encodeURIComponent(jql)}&startAt=0&maxResults=0&fields=key`
    );

    return search.total ?? 0;
  }

  async fetchIssuesByKeys(keys: string[]): Promise<JiraIssue[]> {
    const uniqueKeys = Array.from(new Set(keys));
    const batches = chunk(uniqueKeys, 50);
    const output: JiraIssue[] = [];

    for (const batch of batches) {
      if (batch.length === 0) {
        continue;
      }

      const jql = `key in (${batch.map((key) => escapeKey(key)).join(",")})`;
      const issues = await this.searchIssues(jql);
      output.push(...issues);
    }

    return output;
  }

  async getProjectVersions(projectKey: string): Promise<JiraVersion[]> {
    const versions = await this.jiraFetch<JiraVersion[]>(
      `/rest/api/2/project/${encodeURIComponent(projectKey)}/versions`
    );

    return versions;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function escapeKey(key: string): string {
  return key.replace(/[^A-Z0-9_\-]/gi, "");
}

export function escapeJqlValue(value: string): string {
  return value.replace(/(["\\])/g, "\\$1");
}
