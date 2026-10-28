export default function PublicLoading() {
  return (
    <main className="mx-auto min-h-[50vh] w-full max-w-7xl px-4 py-16 sm:px-6">
      <p role="status" className="text-center text-sm font-semibold">
        Carregando página…
      </p>
      <div aria-hidden="true" className="mt-8 space-y-4 motion-safe:animate-pulse">
        <div className="h-10 w-2/3 rounded-lg bg-current opacity-10" />
        <div className="h-5 w-1/2 rounded-lg bg-current opacity-10" />
        <div className="h-56 rounded-xl bg-current opacity-10" />
      </div>
    </main>
  );
}
