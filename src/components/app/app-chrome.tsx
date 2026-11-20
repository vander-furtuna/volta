import Link from "next/link";
import type { ReactNode } from "react";
import { StatusChip } from "@/components/ui/status-chip";
import { DEMO_STORE } from "@/demo/home-fixture";
import { cn } from "@/lib/utils";

/**
 * Shared app chrome (header, mobile tab bar, wizard steps). Reference: the <header> and
 * <nav aria-label="Principal"> blocks of design/templates/source/home.dc.html and mobile-*.dc.html.
 */

export type MainSection = "home" | "new" | "results";
export type WizardStep = 1 | 2 | 3;

const MAIN_LINKS: { section: MainSection; href: string; label: string }[] = [
  { section: "home", href: "/", label: "Início" },
  { section: "new", href: "/campaigns/new/audience", label: "Nova campanha" },
  { section: "results", href: "/campaigns/out/results", label: "Resultados" },
];

const WIZARD_STEPS: { step: WizardStep; href: string; label: string }[] = [
  { step: 1, href: "/campaigns/new/audience", label: "Público" },
  { step: 2, href: "/campaigns/new/offer", label: "Oferta e limites" },
  { step: 3, href: "/campaigns/new/review", label: "Revisão" },
];

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="10" className="fill-ember" />
      <path
        d="M21.6 11.2A7.2 7.2 0 1 0 23.2 17"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M22.6 6.8v4.8h-4.8"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** "Dados de demonstração" badge. Required on every screen while the data is synthetic. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <StatusChip
      tone="paused"
      label="Dados de demonstração"
      title="Os números desta tela são fictícios"
      className={className}
    />
  );
}

/**
 * Top app header. Desktop: logo, main nav, demo badge, store switcher, avatar.
 * Mobile: logo, unit switcher and menu; pass `mobile={false}` on screens that use
 * `MobileBackHeader` instead (wizard, coupon created).
 */
export function AppHeader({ current, mobile = true }: { current?: MainSection; mobile?: boolean }) {
  return (
    <>
      <header className="bg-surface border-border hidden border-b md:block">
        <div className="max-w-content mx-auto flex flex-wrap items-center gap-10 px-8 py-3">
          <Link
            href="/"
            aria-label="Volta, início"
            className="flex items-center gap-2.5 no-underline"
          >
            <BrandMark className="size-[34px]" />
            <span className="font-heading text-forest text-[25px] font-bold">volta</span>
          </Link>
          <nav aria-label="Principal" className="flex flex-wrap gap-7">
            {MAIN_LINKS.map((link) => (
              <Link
                key={link.section}
                href={link.href}
                aria-current={current === link.section ? "page" : undefined}
                className="text-graphite hover:text-forest aria-[current=page]:text-forest aria-[current=page]:border-ember border-b-2 border-transparent px-0.5 py-3 text-[15px] font-medium no-underline aria-[current=page]:font-semibold"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-3.5">
            <DemoBadge />
            <button
              type="button"
              className="bg-paper border-border rounded-well flex min-h-12 cursor-pointer items-center gap-2.5 border py-1.5 pr-3.5 pl-2 text-left"
            >
              <span className="bg-forest text-sprout flex size-[34px] items-center justify-center rounded-[10px]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="size-[18px]"
                >
                  <path d="M3 9l1.5-5h15L21 9" />
                  <path d="M4 9v11h16V9" />
                  <path d="M9 20v-6h6v6" />
                </svg>
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-ink text-sm font-semibold">{DEMO_STORE.name}</span>
                <span className="text-graphite text-xs">
                  Unidade {DEMO_STORE.unit}, conectada pela CW
                </span>
              </span>
              <ChevronDown className="text-graphite size-4" />
            </button>
            <span
              role="img"
              aria-label="Marina Souza, proprietária"
              className="bg-mint text-forest flex size-10 items-center justify-center rounded-full text-sm font-bold"
            >
              MS
            </span>
          </div>
        </div>
      </header>

      {mobile && (
        <header className="bg-surface border-border flex items-center gap-2.5 border-b py-2 pr-2 pl-4 md:hidden">
          <Link
            href="/"
            aria-label="Volta, início"
            className="flex min-h-11 items-center gap-2 no-underline"
          >
            <BrandMark className="size-[30px]" />
            <span className="font-heading text-forest text-[22px] font-bold">volta</span>
          </Link>
          <div className="flex-1" />
          <button
            type="button"
            aria-label={`Trocar de unidade. Atual: Dois Irmãos, ${DEMO_STORE.unit}`}
            className="bg-paper border-border rounded-field text-ink flex min-h-11 cursor-pointer items-center gap-1.5 border px-2.5 text-[13px] font-semibold"
          >
            {DEMO_STORE.unit}
            <ChevronDown className="text-graphite size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Abrir menu"
            className="text-forest rounded-field flex size-11 cursor-pointer items-center justify-center"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
              className="size-[22px]"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </header>
      )}
    </>
  );
}

const TAB_ICONS: Record<MainSection, ReactNode> = {
  home: (
    <>
      <path d="M4 11l8-7 8 7v9H4z" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  new: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  results: <path d="M4 19V5M4 19h16M8 15v-3M12 15V9M16 15v-5" />,
};

/**
 * Mobile bottom bar with three tabs. Fixed to the viewport bottom; pages that render it must keep
 * `pb-24` (or more) on their <main> so content is not hidden behind it.
 */
export function MobileTabBar({ current }: { current?: MainSection }) {
  return (
    <nav
      aria-label="Principal"
      className="bg-surface border-border fixed inset-x-0 bottom-0 z-20 flex justify-around border-t px-2 pt-1 pb-5 md:hidden"
    >
      {MAIN_LINKS.map((link) => (
        <Link
          key={link.section}
          href={link.href}
          aria-current={current === link.section ? "page" : undefined}
          className="text-graphite aria-[current=page]:text-forest flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 text-xs font-semibold no-underline"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-6"
          >
            {TAB_ICONS[link.section]}
          </svg>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/** Desktop wizard steps: 1 Público — 2 Oferta e limites — 3 Revisão. */
export function WizardSteps({ step, className }: { step: WizardStep; className?: string }) {
  return (
    <nav
      aria-label="Etapas da campanha"
      className={cn("flex flex-wrap items-center gap-3", className)}
    >
      {WIZARD_STEPS.map((item, index) => {
        const isCurrent = item.step === step;
        const isDone = item.step < step;
        return (
          <span key={item.step} className="flex items-center gap-3">
            {index > 0 && <span aria-hidden="true" className="bg-border-input h-0.5 w-12" />}
            <Link
              href={item.href}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2.5 text-[15px] no-underline",
                isCurrent || isDone ? "text-ink font-semibold" : "text-graphite font-medium",
              )}
            >
              <span
                className={cn(
                  "tabular flex size-[30px] items-center justify-center rounded-full text-sm",
                  isCurrent || isDone
                    ? "bg-forest text-white"
                    : "bg-surface border-border-input border-[1.5px]",
                )}
              >
                {item.step}
              </span>
              {item.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}

/** Mobile 3-segment progress bar with "Passo N de 3: <label>". */
export function MobileWizardProgress({ step }: { step: WizardStep }) {
  const label = WIZARD_STEPS.find((item) => item.step === step)?.label;
  return (
    <div className="flex flex-col gap-2 pl-2.5">
      <div aria-hidden="true" className="flex gap-1.5">
        {WIZARD_STEPS.map((item) => (
          <span
            key={item.step}
            className={cn(
              "h-1 flex-1 rounded-full",
              item.step <= step ? "bg-forest" : "bg-chart-rest",
            )}
          />
        ))}
      </div>
      <span className="text-forest text-[13px] font-semibold">
        Passo {step} de 3: {label}
      </span>
    </div>
  );
}

/**
 * Mobile header with a back arrow, a title and an optional subtitle line or extra content
 * (e.g. `MobileWizardProgress`, a status chip). Hidden on desktop.
 */
export function MobileBackHeader({
  title,
  subtitle,
  backHref = "/",
  backLabel = "Voltar ao início",
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  children?: ReactNode;
}) {
  return (
    <header className="bg-surface border-border flex flex-col gap-2 border-b pt-1.5 pr-4 pb-3.5 pl-1.5 md:hidden">
      <div className="flex items-center gap-1">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="text-forest rounded-field flex size-11 shrink-0 items-center justify-center"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-[22px]"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="font-heading text-ink text-lg font-semibold">{title}</span>
          {subtitle && <span className="text-graphite text-xs">{subtitle}</span>}
        </div>
      </div>
      {children}
    </header>
  );
}
