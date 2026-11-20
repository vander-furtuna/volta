"use client";

import Link from "next/link";
import { useState } from "react";
import { MobileBackHeader } from "@/components/app/app-chrome";
import { Button } from "@/components/ui/button";
import { CampaignStatusChip } from "@/components/ui/status-chip";
import type { CampaignStatus } from "@/domain/campaign/campaign-status";
import { normalizeCouponCode } from "@/domain/offer/offer";
import {
  createDemoCoupon,
  dispatchCampaignEvent,
  useCampaignDraft,
  useDraftAudience,
} from "@/demo/campaign-draft";
import { DEMO_NEW_COUPON_NUMBER, DEMO_NEW_CAMPAIGN_TIMES } from "@/demo/campaign-fixture";
import { cn } from "@/lib/utils";
import {
  dayMonth,
  followUpEnd,
  inviteMessage,
  offerSummary,
  trackingWindow,
  weekdayDate,
} from "./offer-copy";

/**
 * "Cupom criado e convite" screen. Reference: design/templates/source/coupon-created.dc.html
 * and mobile-coupon-created.dc.html. Activation and "invitations sent" are separate,
 * explicit user actions; nothing is sent to customers from here.
 */

const RESULTS_HREF = "/campaigns/out/results";

type Step = { title: string; detail: string; done: boolean; numeric?: boolean };

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function CircleCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("text-status-active-ink shrink-0", className)}
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </svg>
  );
}

function StepMarker({ done, compact }: { done: boolean; compact?: boolean }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-[1.5px]",
        compact ? "size-7" : "size-8",
        done ? "bg-mint border-mint" : "bg-surface border-border-input",
      )}
    >
      {done && (
        <CheckIcon
          className={cn(
            "text-status-active-ink",
            compact ? "size-3.5 stroke-[2.8]" : "size-4 stroke-[2.6]",
          )}
        />
      )}
    </span>
  );
}

function ProgressSteps({ steps, compact }: { steps: Step[]; compact?: boolean }) {
  return (
    <section
      aria-label="Andamento da campanha"
      className={cn(
        "bg-surface border-border rounded-card border",
        compact ? "px-5 py-[18px]" : "px-7 py-6",
      )}
    >
      <ol
        className={cn(
          compact
            ? "flex flex-col gap-3.5"
            : "grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-5",
        )}
      >
        {steps.map((step) => (
          <li
            key={step.title}
            className={cn("flex gap-3", compact ? "items-center" : "items-start")}
          >
            <StepMarker done={step.done} compact={compact} />
            <span className={cn("flex flex-col", !compact && "gap-0.5")}>
              <b className={cn("font-bold", compact ? "text-sm" : "text-[15px]")}>{step.title}</b>
              <span
                className={cn(
                  "text-graphite",
                  compact ? "text-xs" : "text-[13px]",
                  step.numeric && "tabular",
                )}
              >
                {step.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function WaitingButton() {
  return (
    <Button
      disabled
      fullWidth
      variant="ghost"
      className="bg-status-draft text-graphite cursor-not-allowed disabled:opacity-100"
    >
      Ative o cupom antes de convidar
    </Button>
  );
}

/** Before the coupon exists (direct visit in demo mode), show the screen as "coupon created". */
function displayStatus(status: CampaignStatus): CampaignStatus {
  return status === "draft" || status === "audience_frozen" ? "coupon_created" : status;
}

export function CouponCreatedView({ name }: { name: string }) {
  const draft = useCampaignDraft();
  const { selectedCount } = useDraftAudience();
  const { offer } = draft;
  const status = displayStatus(draft.status);
  const couponCode = normalizeCouponCode(offer.couponCode) ?? "";

  const campaign = {
    name,
    couponCode,
    cwCouponNumber: DEMO_NEW_COUPON_NUMBER,
    audienceSize: selectedCount,
    ...DEMO_NEW_CAMPAIGN_TIMES,
    validUntil: `${weekdayDate(offer.endsOn)}, às 23:59`,
    trackingWindow: trackingWindow(offer),
    trackingEnd: dayMonth(followUpEnd(offer)),
    offerSummary: offerSummary(offer),
    inviteMessage: inviteMessage(offer, couponCode, "Dois Irmãos"),
  };

  // null until the manager edits the text, so the suggestion follows the stored offer.
  const [editedMessage, setMessage] = useState<string | null>(null);
  const message = editedMessage ?? campaign.inviteMessage;
  const [copied, setCopied] = useState(false);

  const active = status === "active" || status === "invitations_sent";
  const sent = status === "invitations_sent";

  // Each step is an explicit manager action; nothing is sent to customers automatically.
  const activate = () => {
    if (draft.status === "draft" || draft.status === "audience_frozen") createDemoCoupon();
    dispatchCampaignEvent({ type: "activate" });
  };
  const markSent = () => dispatchCampaignEvent({ type: "mark_invitations_sent" });
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // Clipboard may be blocked (e.g. insecure context); the label still confirms the intent.
    }
    setCopied(true);
  };
  const copyLabel = copied ? "Mensagem copiada" : "Copiar mensagem";

  const activeDetail = active ? `Ativado hoje às ${campaign.activatedAt}` : "Aguardando você";
  const sentDetail = sent
    ? `Marcado hoje às ${campaign.invitationsMarkedAt}`
    : active
      ? "Aguardando você"
      : "Depois de ativar";

  const steps = (compact: boolean): Step[] => [
    {
      title: "Público congelado",
      detail: `${campaign.audienceSize} clientes, às ${campaign.audienceFrozenAt}`,
      done: true,
    },
    {
      title: "Cupom criado na CW",
      detail: compact
        ? `Nº ${campaign.cwCouponNumber}, às ${campaign.couponCreatedAt}`
        : `Cupom nº ${campaign.cwCouponNumber}, às ${campaign.couponCreatedAt}`,
      done: true,
      numeric: true,
    },
    { title: "Cupom ativo", detail: activeDetail, done: active },
    { title: "Convites enviados", detail: sentDetail, done: sent },
    { title: "Acompanhamento", detail: campaign.trackingWindow, done: false },
  ];

  const sentNotice = `Convites marcados como enviados hoje às ${campaign.invitationsMarkedAt}.`;
  const textareaClass =
    "border-border-input bg-paper/40 text-ink rounded-field resize-y border-[1.5px] text-[15px] font-normal";

  return (
    <>
      {/* Mobile header: back arrow, title and status chip. */}
      <MobileBackHeader title={campaign.name}>
        <CampaignStatusChip status={status} className="-mt-1 ml-12 self-start" />
      </MobileBackHeader>

      {/* Desktop (1440 px template) */}
      <main className="max-w-content mx-auto hidden w-full flex-col gap-7 px-8 pt-7 pb-24 md:flex">
        <div className="flex flex-col gap-[18px]">
          <Link
            href="/"
            className="text-forest hover:text-forest-deep -my-1.5 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold no-underline"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-4"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Início
          </Link>
          <div className="flex flex-wrap items-center gap-3.5">
            <h1 className="font-heading text-[38px] font-semibold">{campaign.name}</h1>
            <CampaignStatusChip status={status} />
          </div>
        </div>

        <ProgressSteps steps={steps(false)} />

        {active ? (
          <section
            role="status"
            className="bg-mint flex flex-wrap items-center gap-4 rounded-[24px] px-8 py-6"
          >
            <CircleCheckIcon className="size-7" />
            <p className="text-mint-ink flex-[1_1_400px] text-[17px]">
              <b>Cupom ativo até {campaign.validUntil}.</b> Agora convide os clientes pelo canal que
              você já usa.
              <span className="mt-1 block text-[15px]">{campaign.offerSummary}</span>
            </p>
          </section>
        ) : (
          <section
            aria-labelledby="ativar"
            className="bg-forest flex flex-wrap items-center justify-between gap-6 rounded-[24px] px-8 py-7 text-white"
          >
            <div className="flex max-w-[64ch] flex-col gap-1.5">
              <h2 id="ativar" className="font-heading text-[26px] font-semibold">
                Cupom {campaign.couponCode} criado, ainda desativado
              </h2>
              <p className="text-[15px] leading-[1.55] text-white/82">
                Ninguém consegue usar enquanto estiver desativado. Confira na Cardápio Web, se
                quiser, e ative quando estiver pronto para convidar.
              </p>
              <p className="text-sm font-semibold">{campaign.offerSummary}</p>
            </div>
            <Button onClick={activate}>Ativar cupom</Button>
          </section>
        )}

        <div className="flex flex-wrap items-start gap-6">
          <section
            aria-labelledby="convite"
            className="bg-surface border-border rounded-card flex min-w-0 flex-[999_1_600px] flex-col gap-6 border p-8"
          >
            <div className="flex flex-col gap-2">
              <h2 id="convite" className="font-heading text-2xl font-semibold">
                Convide os {campaign.audienceSize} clientes
              </h2>
              <p className="text-graphite max-w-[64ch] text-[15px] leading-[1.55]">
                O Volta não envia mensagens por você. Use o WhatsApp da loja ou as campanhas do CRM
                da Cardápio Web com o código abaixo.
              </p>
            </div>

            <div className="border-border flex flex-col gap-3.5 rounded-[18px] border p-[22px]">
              <label htmlFor="msg" className="text-base font-semibold">
                Mensagem sugerida
              </label>
              <textarea
                id="msg"
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className={cn(textareaClass, "px-4 py-3.5 leading-[1.6]")}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="dark" onClick={copyMessage} aria-live="polite">
                  {copyLabel}
                </Button>
                <span className="text-graphite text-[13px]">
                  Troque [primeiro nome] e [link do cardápio] antes de enviar.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
              <div className="bg-well flex flex-col gap-2.5 rounded-[18px] p-[22px]">
                <h3 className="text-base font-semibold">Lista de convidados</h3>
                <p className="text-graphite text-sm leading-normal">
                  Nome e telefone dos {campaign.audienceSize} clientes, todos com WhatsApp
                  autorizado no cadastro.
                </p>
                <Button variant="outline" className="mt-1 self-start">
                  Baixar lista (.csv)
                </Button>
              </div>
              <div className="bg-well flex flex-col gap-2.5 rounded-[18px] p-[22px]">
                <h3 className="text-base font-semibold">Link com o cupom aplicado</h3>
                <p className="text-graphite text-sm leading-normal">
                  Abre o cardápio com o {campaign.couponCode} já preenchido. Teste uma vez antes de
                  enviar.
                </p>
                <Button variant="outline" className="mt-1 self-start">
                  Copiar link
                </Button>
              </div>
            </div>
          </section>

          <aside aria-labelledby="depois" className="flex min-w-0 flex-[1_1_360px] flex-col gap-6">
            <section className="bg-surface border-border rounded-card flex flex-col gap-4 border p-7">
              <h2 id="depois" className="font-heading text-[22px] font-semibold">
                Depois de enviar
              </h2>
              <p className="text-graphite text-[15px] leading-[1.55]">
                Marque o envio para o Volta não convidar as mesmas pessoas de novo cedo demais. Não
                recebemos confirmação de entrega nem de leitura.
              </p>
              {!active && <WaitingButton />}
              {active && !sent && (
                <Button fullWidth onClick={markSent}>
                  Marcar convites como enviados
                </Button>
              )}
              {sent && (
                <div className="flex flex-col gap-3">
                  <p role="status" className="text-status-active-ink text-[15px] font-semibold">
                    {sentNotice}
                  </p>
                  <Button asChild variant="dark" fullWidth>
                    <Link href={RESULTS_HREF}>Acompanhar resultado</Link>
                  </Button>
                </div>
              )}
            </section>
            <section className="bg-peach rounded-card text-peach-ink flex flex-col gap-2 p-6">
              <h2 className="text-base font-semibold">O que vamos acompanhar</h2>
              <p className="text-sm leading-[1.55]">
                Os pedidos com o {campaign.couponCode} e quem dos {campaign.audienceSize} voltou a
                pedir até {campaign.trackingEnd}, com ou sem cupom. Pedidos cancelados saem da
                conta.
              </p>
            </section>
          </aside>
        </div>
      </main>

      {/* Mobile (390 px template) */}
      <main className="flex flex-col gap-5 px-4 pt-5 pb-8 md:hidden">
        {active ? (
          <section role="status" className="bg-mint rounded-card flex items-start gap-3 p-[18px]">
            <CircleCheckIcon className="size-6" />
            <p className="text-mint-ink text-[15px] leading-normal">
              <b>Cupom ativo até {campaign.validUntil}.</b> Agora convide os clientes.
              <span className="mt-1 block text-sm">{campaign.offerSummary}</span>
            </p>
          </section>
        ) : (
          <section
            aria-labelledby="m-ativar"
            className="bg-forest flex flex-col gap-3.5 rounded-[24px] px-5 py-[22px] text-white"
          >
            <h1 id="m-ativar" className="font-heading text-2xl leading-[1.15] font-semibold">
              Cupom {campaign.couponCode} criado, ainda desativado
            </h1>
            <p className="text-sm leading-[1.55] text-white/82">
              Ninguém consegue usar enquanto estiver desativado. Ative quando estiver pronto para
              convidar.
            </p>
            <p className="text-sm font-semibold">{campaign.offerSummary}</p>
            <Button fullWidth onClick={activate}>
              Ativar cupom
            </Button>
          </section>
        )}

        <ProgressSteps steps={steps(true)} compact />

        <section
          aria-labelledby="m-convite"
          className="bg-surface border-border rounded-card flex flex-col gap-3.5 border p-5"
        >
          <h2 id="m-convite" className="font-heading text-[21px] font-semibold">
            Convide os {campaign.audienceSize} clientes
          </h2>
          <p className="text-graphite text-sm leading-[1.55]">
            O Volta não envia mensagens por você. Use o WhatsApp da loja ou o CRM da Cardápio Web
            com o código abaixo.
          </p>
          <label htmlFor="m-msg" className="mt-1 text-[15px] font-semibold">
            Mensagem sugerida
          </label>
          <textarea
            id="m-msg"
            rows={7}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={cn(textareaClass, "px-3.5 py-3 leading-[1.55]")}
          />
          <span className="text-graphite text-[13px]">
            Troque [primeiro nome] e [link do cardápio] antes de enviar.
          </span>
          <Button variant="dark" fullWidth onClick={copyMessage} aria-live="polite">
            {copyLabel}
          </Button>
          <div className="border-border-soft mt-1 flex flex-col border-t">
            <button
              type="button"
              className="border-border-soft text-ink flex min-h-16 items-center gap-3 border-b py-2 text-left"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="text-forest size-[22px] shrink-0"
              >
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              <span className="flex flex-auto flex-col gap-0.5">
                <b className="text-[15px]">Baixar lista de convidados</b>
                <span className="text-graphite text-[13px]">
                  {campaign.audienceSize} clientes com WhatsApp autorizado, em .csv
                </span>
              </span>
            </button>
            <button
              type="button"
              className="text-ink flex min-h-16 items-center gap-3 py-2 text-left"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="text-forest size-[22px] shrink-0"
              >
                <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
                <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
              </svg>
              <span className="flex flex-auto flex-col gap-0.5">
                <b className="text-[15px]">Copiar link com o cupom aplicado</b>
                <span className="text-graphite text-[13px]">Teste uma vez antes de enviar</span>
              </span>
            </button>
          </div>
        </section>

        <section
          aria-labelledby="m-depois"
          className="bg-surface border-border rounded-card flex flex-col gap-3 border p-5"
        >
          <h2 id="m-depois" className="font-heading text-[21px] font-semibold">
            Depois de enviar
          </h2>
          <p className="text-graphite text-sm leading-[1.55]">
            Marque o envio para não convidar as mesmas pessoas de novo cedo demais. Não recebemos
            confirmação de entrega nem de leitura.
          </p>
          {!active && <WaitingButton />}
          {active && !sent && (
            <Button fullWidth onClick={markSent}>
              Marcar convites como enviados
            </Button>
          )}
          {sent && (
            <>
              <p role="status" className="text-status-active-ink text-sm font-semibold">
                {sentNotice}
              </p>
              <Button asChild variant="dark" fullWidth>
                <Link href={RESULTS_HREF}>Acompanhar resultado</Link>
              </Button>
            </>
          )}
        </section>

        <section className="bg-peach rounded-card text-peach-ink flex flex-col gap-1.5 px-5 py-[18px]">
          <h2 className="text-[15px] font-semibold">O que vamos acompanhar</h2>
          <p className="text-sm leading-[1.55]">
            Os pedidos com o {campaign.couponCode} e quem dos {campaign.audienceSize} voltou até{" "}
            {campaign.trackingEnd}, com ou sem cupom. Cancelados saem da conta.
          </p>
        </section>
      </main>
    </>
  );
}
