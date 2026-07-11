interface Choice<T extends string> { value: T; label: string }

export function ChoiceGroup<T extends string>({
  label, choices, value, onChange,
}: { label: string; choices: Choice<T>[]; value: T | null; onChange: (value: T) => void }) {
  return <fieldset className="choice-fieldset"><legend>{label}</legend><div className="choice-group">
    {choices.map((choice) => <button key={choice.value} type="button" className="choice-tile"
      aria-pressed={value === choice.value} onClick={() => onChange(choice.value)}>{choice.label}</button>)}
  </div></fieldset>;
}
