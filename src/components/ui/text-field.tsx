import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string | undefined;
};

export function TextField({ label, error, id, className, ...inputProps }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-semibold text-ink-soft">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "h-[52px] rounded-xl bg-subtle px-4 text-[15px] text-ink placeholder:text-faint",
          "outline-none transition focus-visible:ring-2 focus-visible:ring-accent",
          error && "ring-2 ring-accent/60",
          className,
        )}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-[13px] font-medium text-accent-strong">
          {error}
        </p>
      )}
    </div>
  );
}
