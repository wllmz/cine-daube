import { Tomy } from "@/components/ui/tomy";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center animate-fade-up">
      <Tomy mood="content" size={112} />
      <h1 className="text-4xl font-extrabold tracking-tight">Ciné Daube</h1>
      <p className="max-w-64 text-[15px] leading-relaxed text-muted">
        Les pires comédies françaises, notées entre potes.
      </p>
    </main>
  );
}
