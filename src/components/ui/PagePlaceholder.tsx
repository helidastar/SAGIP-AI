export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">SAGIP-AI</p>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-base opacity-80">{description}</p>
    </main>
  );
}
