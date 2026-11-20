/** Skeleton while a campaign loads: same rhythm as the campaign screens, no numbers shown. */
export default function CampaignLoading() {
  return (
    <main
      aria-busy="true"
      className="max-w-content mx-auto flex w-full flex-col gap-7 px-4 pt-5 pb-24 md:px-8 md:pt-7"
    >
      <p role="status" className="sr-only">
        Carregando a campanha
      </p>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-status-draft h-5 w-20 animate-pulse rounded-full" />
        <div className="bg-status-draft rounded-field h-10 w-72 max-w-full animate-pulse" />
      </div>
      <div aria-hidden="true" className="bg-surface border-border rounded-card h-24 border" />
      <div aria-hidden="true" className="bg-forest/15 h-32 animate-pulse rounded-[24px]" />
      <div aria-hidden="true" className="flex flex-wrap gap-6">
        <div className="bg-surface border-border rounded-card h-80 min-w-0 flex-[999_1_600px] border" />
        <div className="bg-surface border-border rounded-card h-56 min-w-0 flex-[1_1_360px] border" />
      </div>
    </main>
  );
}
