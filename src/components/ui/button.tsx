import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const BASE =
  "inline-flex h-[54px] items-center justify-center gap-2 rounded-[14px] px-5 text-base font-bold transition hover:-translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white shadow-accent",
  secondary: "bg-chip text-ink",
  ghost: "h-11 bg-transparent text-sm font-semibold text-ink-soft hover:bg-chip hover:translate-y-0",
};

/** Class names for a button, reusable on links (`<Link className={buttonClassName()}>`). */
export function buttonClassName(variant: ButtonVariant = "primary", className?: string) {
  return cn(BASE, VARIANTS[variant], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant };

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClassName(variant, className)} {...props} />;
}
