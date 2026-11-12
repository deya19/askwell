/** Soft monochrome glows behind the dashboard (dark on light, light on dark), so the glass panels have something to blur. */
export function DashboardBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 left-1/2 h-[28rem] w-[56rem] max-w-[160vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(0_0_0/0.07),transparent)] dark:bg-[radial-gradient(closest-side,rgb(255_255_255/0.08),transparent)]" />
      <div className="absolute right-[-10rem] bottom-[-12rem] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(0_0_0/0.05),transparent)] dark:bg-[radial-gradient(closest-side,rgb(255_255_255/0.05),transparent)]" />
    </div>
  );
}
