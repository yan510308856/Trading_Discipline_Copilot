import { PageIntro } from "./PageIntro";

export function OpenTradePanel() {
  return (
    <PageIntro
      eyebrow="In-trade"
      title="Open Trade Management"
      description="Keep stops, partial profits, and runners visible while a position is active."
      nextStage="Interactive open-trade controls are intentionally reserved for Stage 6."
    />
  );
}
