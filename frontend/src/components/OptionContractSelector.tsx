import { useState } from "react";
import type { QuoteResult } from "../types";
import { defaultStrikeIncrement, optionContractSummary, strikeSuggestions } from "../utils/optionContracts";
import { ChoiceGroup } from "./ui/ChoiceGroup";

export function OptionContractSelector({ symbol, quote, type, expiration, strike, onChange }: {
  symbol: string; quote: QuoteResult | null; type: "call" | "put" | null;
  expiration: string; strike: string; onChange: (values: { type?: "call" | "put"; expiration?: string; strike?: string }) => void;
}) {
  const [increment, setIncrement] = useState<number | null>(null);
  const selectedIncrement = increment ?? (quote?.price ? defaultStrikeIncrement(quote.price) : 1);
  const strikes = quote?.price ? strikeSuggestions(quote.price, selectedIncrement) : [];
  const strikeNumber = Number(strike);
  return <section className="option-selector">
    <div className="option-selector-heading">
      <div><span className="option-step-number">1</span><div><strong>Contract details</strong><small>Choose the contract you plan to verify with your broker.</small></div></div>
    </div>
    <div className="option-basics">
      <ChoiceGroup label="Option type" choices={[{ value: "call", label: "Call" }, { value: "put", label: "Put" }]} value={type} onChange={(value) => onChange({ type: value })} />
      <label className="expiration-field">
        Expiration date
        <input type="date" value={expiration} onChange={(event) => onChange({ expiration: event.target.value })} />
      </label>
      <label className="expiration-field">
        Strike
        <input type="number" min="0.01" step="0.01" placeholder="200.00" value={strike} onChange={(event) => onChange({ strike: event.target.value })} />
      </label>
    </div>
    {quote?.price ? <>
      <div className="option-section-label"><span className="option-step-number">2</span><strong>Choose a strike</strong></div>
      <ChoiceGroup label="Strike increment" choices={[0.5, 1, 2.5, 5, 10].map((value) => ({ value: String(value), label: String(value) }))} value={String(selectedIncrement)} onChange={(value) => setIncrement(Number(value))} />
      <ChoiceGroup label="Planning strikes" choices={strikes.map((value) => ({ value: String(value), label: value === Math.round(quote.price! / selectedIncrement) * selectedIncrement ? `${value} · ATM` : String(value) }))} value={strike || null} onChange={(value) => onChange({ strike: value })} />
    </> : null}
    {type && expiration && Number.isFinite(strikeNumber) && strikeNumber > 0 && <strong className="contract-summary">{optionContractSummary(symbol, expiration, strikeNumber, type)}</strong>}
    <p className="option-disclaimer">Verify the contract in your broker before trading. Any fetched price is the underlying reference, not the option premium.</p>
  </section>;
}
