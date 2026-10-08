import { Copy, FolderOpen, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import type { StudioProjectSummary } from '@/game/audio/studio/persistence';

interface StudioProjectBrowserProps {
  projects: StudioProjectSummary[];
  activeProjectId: string | null;
  busy: boolean;
  onClose: () => void;
  onCreate: () => Promise<void>;
  onOpen: (projectId: string) => Promise<void>;
  onRename: (projectId: string, name: string) => Promise<void>;
  onDuplicate: (projectId: string) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
}

const projectDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function StudioProjectBrowser({
  projects,
  activeProjectId,
  busy,
  onClose,
  onCreate,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: StudioProjectBrowserProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <section className="border border-primary/50 bg-background/95 p-4" data-testid="studio-project-browser">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Local Projects</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved only on this device. Duplicates reuse the same audio instead of copying it.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-muted-foreground transition-colors hover:text-white"
          aria-label="Close local projects"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => void onCreate()}
        disabled={busy}
        className="mb-4 flex w-full items-center justify-center gap-2 bg-primary px-3 py-3 text-xs font-bold uppercase tracking-widest text-primary-foreground transition-colors hover:bg-white disabled:opacity-50"
        data-testid="button-studio-new-project"
      >
        <Plus className="h-4 w-4" /> New Project
      </button>

      <div
        className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3"
        data-testid="list-studio-projects"
      >
        {projects.map((project) => {
          const active = project.id === activeProjectId;
          const confirmingDelete = pendingDeleteId === project.id;
          return (
            <article
              key={project.id}
              className={`min-w-0 border p-3 [content-visibility:auto] ${
                active ? 'border-primary bg-primary/10' : 'border-border bg-card/60'
              }`}
              data-testid={`studio-project-${project.id}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest ${active ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {active ? 'Open now' : 'Saved project'}
                </span>
                <time
                  className="text-[10px] text-muted-foreground"
                  dateTime={new Date(project.updatedAt).toISOString()}
                >
                  {projectDate.format(project.updatedAt)}
                </time>
              </div>

              <input
                key={`${project.id}:${project.name}`}
                type="text"
                defaultValue={project.name}
                disabled={busy}
                aria-label={`Rename ${project.name || 'Untitled'}`}
                onBlur={(event) => void onRename(project.id, event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
                className="mb-2 w-full border-b border-border bg-transparent pb-1 text-sm font-bold text-white outline-none focus:border-primary"
              />

              <p className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                {project.trackCount} tracks · {project.clipCount} clips · {project.sourceCount} sources
                {project.missingSourceCount > 0 ? (
                  <span className="ml-2 text-destructive">{project.missingSourceCount} unavailable</span>
                ) : null}
              </p>

              {confirmingDelete ? (
                <div className="flex gap-2" role="group" aria-label={`Confirm deletion of ${project.name}`}>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(null)}
                    className="flex-1 border border-border px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingDeleteId(null);
                      void onDelete(project.id);
                    }}
                    disabled={busy}
                    className="flex-1 border border-destructive bg-destructive/10 px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-destructive disabled:opacity-50"
                    data-testid={`button-confirm-delete-project-${project.id}`}
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void onOpen(project.id)}
                    disabled={busy || active}
                    className="flex flex-1 items-center justify-center gap-1 border border-border px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:border-primary hover:text-primary disabled:opacity-30"
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> Open
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDuplicate(project.id)}
                    disabled={busy}
                    className="border border-border p-2 text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30"
                    aria-label={`Duplicate ${project.name}`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(project.id)}
                    disabled={busy}
                    className="border border-border p-2 text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-30"
                    aria-label={`Delete ${project.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
