import { cn } from "../lib";

export type BrandLogoProps = {
  className?: string;
  /** Размер wordmark в шапке / на splash. */
  size?: "md" | "lg";
};

export function BrandLogo({ className, size = "md" }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-heading font-extrabold leading-none tracking-[-0.03em]",
        size === "lg" ? "text-3xl" : "text-2xl",
        className,
      )}
      aria-hidden
    >
      <span className="text-primary">Buk</span>
      <span className="text-[#c4934b] dark:text-surface-secondary">Vu</span>
    </span>
  );
}
