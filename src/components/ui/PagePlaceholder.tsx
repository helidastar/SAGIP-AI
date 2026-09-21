import { Panel } from "@/components/ui/basics";

export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <Panel title={title} hint="planned" bodyClassName="flex min-h-48 flex-col items-center justify-center gap-2 border-dashed p-6 text-center">
      <p className="text-sm text-muted">{description}</p>
      <p className="font-mono text-[10px] text-muted">Not built yet.</p>
    </Panel>
  );
}
