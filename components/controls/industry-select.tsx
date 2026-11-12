"use client";

import { useState } from "react";
import { ProfileSelect } from "./profile-select";

const industries = [
  "Agriculture & natural resources",
  "Arts, entertainment & media",
  "Automotive & transportation",
  "Construction & real estate",
  "Consumer goods & manufacturing",
  "Design & creative services",
  "Education & training",
  "Energy & utilities",
  "Finance & insurance",
  "Food, hospitality & travel",
  "Government & public services",
  "Healthcare & life sciences",
  "Logistics & distribution",
  "Nonprofit & community services",
  "Professional & business services",
  "Retail & e-commerce",
  "Technology & software",
  "Telecommunications",
];
const other = "__other__";

export function IndustrySelect({ value, className }: { value: string; className?: string }) {
  const [selection, setSelection] = useState(value && !industries.includes(value) ? other : value);
  const [custom, setCustom] = useState(selection === other ? value : "");

  return (
    <div className={className}>
      <label className={className}>
        Industry
        <ProfileSelect
          name={selection === other ? undefined : "industry"}
          required
          value={selection}
          onChange={event => setSelection(event.target.value)}
        >
          <option value="" disabled>Choose an industry</option>
          {industries.map(industry => <option key={industry}>{industry}</option>)}
          <option value={other}>Other (enter your industry)</option>
        </ProfileSelect>
      </label>
      {selection === other && (
        <label className={className}>
          Your industry
          <input name="industry" required maxLength={128} value={custom} onChange={event => setCustom(event.target.value)} />
        </label>
      )}
    </div>
  );
}
