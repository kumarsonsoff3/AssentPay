import { useId } from "react";
import { ProfileSelect } from "./profile-select";
import type { RegionalOption, RegionalOptions } from "@/lib/workspaces/regions";

export function RegionalSelect({
  name,
  label,
  value,
  options,
  hint,
  hintClassName,
  className,
}: {
  name: keyof RegionalOptions;
  label: string;
  value: string;
  options: readonly RegionalOption[];
  hint?: string;
  hintClassName?: string;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      <ProfileSelect key={value} id={id} name={name} defaultValue={value} required aria-describedby={hintId}>
        {!value && <option value="" disabled>Choose {label.toLowerCase()}</option>}
        {value && !options.some(option => option.value === value) && (
          <option value={value}>{value} (currently saved)</option>
        )}
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </ProfileSelect>
      {hint && <span id={hintId} className={hintClassName}>{hint}</span>}
    </div>
  );
}
