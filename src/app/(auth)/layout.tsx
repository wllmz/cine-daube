import { Tomy } from "@/components/ui/tomy";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-10 px-6 pt-16 pb-8">
      <header className="flex flex-col items-center gap-3 text-center animate-fade-up">
        <Tomy mood="content" size={112} />
        <p className="text-4xl leading-none font-extrabold tracking-tight">Ciné Daube</p>
        <p className="max-w-64 text-[15px] leading-relaxed text-muted">
          Les pires comédies françaises, notées entre potes.
        </p>
      </header>
      <div className="flex flex-col gap-3.5 animate-fade-up [animation-delay:80ms]">{children}</div>
    </main>
  );
}
