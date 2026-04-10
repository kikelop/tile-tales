import Gallery from "@/components/Gallery";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="px-6 pt-12 pb-8 sm:px-10 lg:px-16">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Tile Tales
        </h1>
        <p className="mt-2 max-w-md text-lg text-[var(--color-muted)]">
          Your collection of street tiles from around the world.
        </p>
      </header>

      {/* Gallery */}
      <main className="flex-1 px-6 pb-16 sm:px-10 lg:px-16">
        <Gallery />
      </main>
    </div>
  );
}
