import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  secondary: "border border-border bg-surface hover:bg-background",
  danger: "border border-border bg-surface text-error hover:bg-error-surface",
  ghost: "text-muted hover:text-foreground",
};

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)} {...props} />;
}

const FIELD = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(FIELD, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(FIELD, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-border bg-surface", className)} {...props} />;
}

const NOTICE_TONES = {
  info: "border-border bg-surface text-foreground",
  success: "border-success/30 bg-success-surface text-success",
  error: "border-error/30 bg-error-surface text-error",
  warning: "border-warning/30 bg-warning-surface text-warning",
};

export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof NOTICE_TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-lg border px-3 py-2 text-sm", NOTICE_TONES[tone], className)}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  const tones = {
    neutral: "bg-background text-muted border-border",
    success: "bg-success-surface text-success border-success/30",
    warning: "bg-warning-surface text-warning border-warning/30",
  };
  return <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const content = (
    <Card className={cx("flex flex-col gap-1 p-5", href && "transition hover:border-foreground/30")}>
      <span className="text-sm text-muted">{label}</span>
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 border-dashed px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </Card>
  );
}

export function Loading() {
  return <p className="text-sm text-muted">Chargement...</p>;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
