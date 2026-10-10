export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      {/* Attribution required by the TMDB API terms; availability data comes from JustWatch through TMDB. */}
      <footer className="mx-auto w-full max-w-md px-5 pt-2 pb-6 text-center text-[11px] leading-relaxed text-faint">
        Films et affiches : <a href="https://www.themoviedb.org" className="underline hover:text-muted">TMDB</a>.
        Disponibilités : <a href="https://www.justwatch.com/fr" className="underline hover:text-muted">JustWatch</a>.
        <br />
        Ce produit utilise l&apos;API TMDB mais n&apos;est ni approuvé ni certifié par TMDB.
      </footer>
    </>
  );
}
