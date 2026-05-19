import { useState } from "react";
import { LayoutGrid, Plus } from "lucide-react";
import TemplateGallery, { type Template } from "$lib/components/shared/TemplateGallery";
import {
  ActionButton,
  EmptyState,
  PageBody,
  PageHeader,
} from "$lib/components/shared/PageScaffold";

export default function TemplatesPage() {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selected, setSelected] = useState<Template | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Templates"
        subtitle="Browse reusable templates for skills, agents, hooks, rules, and MCP"
        icon={LayoutGrid}
        actions={
          <ActionButton onClick={() => setGalleryOpen(true)} variant="primary">
            <Plus size={14} />
            Open Gallery
          </ActionButton>
        }
      />
      <PageBody>
        {!selected ? (
          <EmptyState title="No template selected" detail="Open the gallery to preview template content." />
        ) : (
          <section className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-text-primary">{selected.name}</h2>
                  <p className="text-xs text-text-muted">{selected.description}</p>
                </div>
                <span className="px-2 py-1 rounded bg-bg-tertiary text-xs text-text-secondary">
                  {selected.category}
                </span>
              </div>
            </div>
            <pre className="p-4 text-sm text-text-secondary whitespace-pre-wrap overflow-auto max-h-[60vh]">
              {selected.content ??
                JSON.stringify(
                  {
                    event: selected.event,
                    matcher: selected.matcher,
                    hookType: selected.hookType,
                    hookValue: selected.hookValue,
                    mcpType: selected.mcpType,
                    mcpCommand: selected.mcpCommand,
                    mcpArgs: selected.mcpArgs,
                    mcpUrl: selected.mcpUrl,
                    paths: selected.paths,
                  },
                  null,
                  2,
                )}
            </pre>
          </section>
        )}
      </PageBody>
      <TemplateGallery
        open={galleryOpen}
        onselect={setSelected}
        onclose={() => setGalleryOpen(false)}
      />
    </div>
  );
}
