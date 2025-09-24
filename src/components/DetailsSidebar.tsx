import { useMemo } from "react";

import { SunburstResponse } from "@shared/types";
import { extractRelationships } from "@/lib/sunburst";

interface DetailsSidebarProps {
  data?: SunburstResponse;
  selectedKey: string | null;
  onClose: () => void;
}

export function DetailsSidebar({ data, selectedKey, onClose }: DetailsSidebarProps) {
  const meta = selectedKey ? data?.meta.issues[selectedKey] : undefined;

  const relationships = useMemo(() => {
    if (!data || !selectedKey) {
      return { parents: [], children: [] };
    }

    return extractRelationships(data, selectedKey);
  }, [data, selectedKey]);

  if (!meta) {
    return (
      <aside className="flex w-full max-w-xs flex-col gap-4 rounded-md border border-border-light bg-panel-light p-4 text-text-light shadow-sm transition-colors dark:border-border-dark dark:bg-panel-dark dark:text-text-dark">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Details</h2>
        </header>
        <p className="text-sm text-muted-light dark:text-muted-dark">Select a wedge to see details.</p>
      </aside>
    );
  }

  const jiraUrl = data?.browseBaseUrl
    ? `${data.browseBaseUrl.replace(/\/$/, "")}/${meta.key}`
    : null;

  return (
    <aside className="flex w-full max-w-xs flex-col gap-4 rounded-md border border-border-light bg-panel-light p-4 text-text-light shadow-sm transition-colors dark:border-border-dark dark:bg-panel-dark dark:text-text-dark">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{meta.key}</h2>
          <p className="text-sm text-muted-light dark:text-muted-dark">{meta.summary}</p>
        </div>
        <button
          type="button"
          className="rounded border border-border-light px-2 py-1 text-xs text-muted-light transition hover:border-teal-400 hover:text-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-surface-light dark:border-border-dark dark:text-muted-dark dark:hover:text-teal-200 dark:focus:ring-offset-surface-dark"
          onClick={onClose}
        >
          Close
        </button>
      </header>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-light dark:text-muted-dark">Type</dt>
          <dd className="font-medium">{meta.type}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-light dark:text-muted-dark">Status</dt>
          <dd className="font-medium">{meta.status}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-light dark:text-muted-dark">Project</dt>
          <dd className="font-medium">{meta.project}</dd>
        </div>
        {meta.assignee && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-light dark:text-muted-dark">Assignee</dt>
            <dd className="font-medium">{meta.assignee}</dd>
          </div>
        )}
        {meta.fixVersions.length > 0 && (
          <div>
            <dt className="text-muted-light dark:text-muted-dark">Fix Versions</dt>
            <dd className="font-medium">{meta.fixVersions.join(", ")}</dd>
          </div>
        )}
        {meta.telescope && meta.telescope.length > 0 && (
          <div>
            <dt className="text-muted-light dark:text-muted-dark">Telescopes</dt>
            <dd className="font-medium">{meta.telescope.join(", ")}</dd>
          </div>
        )}
      </dl>

      {jiraUrl && (
        <a
          className="inline-flex w-fit items-center justify-center rounded bg-teal-500 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:ring-offset-2 focus:ring-offset-surface-light dark:focus:ring-offset-surface-dark"
          href={jiraUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Open in Jira
        </a>
      )}

      <section className="space-y-3 text-sm">
        <div>
          <h3 className="text-sm font-semibold text-text-light dark:text-text-dark">Parents</h3>
          {relationships.parents.length === 0 ? (
            <p className="text-muted-light dark:text-muted-dark">No parents in current traversal.</p>
          ) : (
            <ul className="space-y-1">
              {relationships.parents.map((parent) => (
                <li key={parent.key}>
                  {parent.key} · {parent.type}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text-light dark:text-text-dark">Children</h3>
          {relationships.children.length === 0 ? (
            <p className="text-muted-light dark:text-muted-dark">No children in current traversal.</p>
          ) : (
            <ul className="space-y-1">
              {relationships.children.map((child) => (
                <li key={child.key}>
                  {child.key} · {child.type}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </aside>
  );
}
