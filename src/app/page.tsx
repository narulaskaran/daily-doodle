import { GalleryGrid } from "~/app/_components/gallery-grid";
import { api, HydrateClient } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  void api.coloringPage.getAll.prefetch();

  return (
    <HydrateClient>
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <header className="mb-10 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Daily Doodle
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Fresh coloring pages, delivered daily
            </p>
          </header>

          <GalleryGrid />
        </div>
      </main>
    </HydrateClient>
  );
}
