import { cn } from "@/lib/utils";

type FormAlertProps = {
  tone: "error" | "success";
  children: React.ReactNode;
};

export function FormAlert({ tone, children }: FormAlertProps) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[14px] px-4 py-3 text-sm leading-relaxed animate-fade-up",
        tone === "error" ? "bg-accent-soft text-accent-strong" : "bg-success-soft text-success",
      )}
    >
      {children}
    </p>
  );
}
