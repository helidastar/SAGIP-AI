import { CitizenNav } from "@/components/citizen/CitizenNav";

export default function CitizenLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-cz-bg font-body text-cz-text">
      <CitizenNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10">{children}</main>
    </div>
  );
}
