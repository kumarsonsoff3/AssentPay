"use client";

import { useState } from "react";
import { Select } from "radix-ui";
import { Check, ChevronDown } from "@/components/icons";
import styles from "./select-field.module.css";

type Option = { value: string; label: string };
type Props = {
  options: readonly Option[];
  value?: string;
  defaultValue?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  onValueChange?: (value: string) => void;
};

export const workspaceRoleOptions = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
] as const;

export function SelectField({ options, id, className, "aria-label": label, value, defaultValue, onValueChange, ...form }: Props) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const selected = value ?? uncontrolled;
  // Radix reserves the empty string. Keep a non-empty option ID for unnamed filters.
  const empty = "__assentpay_all__";
  const selectedLabel = options.find(option => option.value === selected)?.label;
  return (
    <Select.Root
      {...form}
      value={selected === "" ? empty : selected}
      onValueChange={optionId => {
        const next = optionId === empty ? "" : optionId;
        if (value === undefined) setUncontrolled(next);
        onValueChange?.(next);
      }}
    >
      <Select.Trigger id={id} aria-label={label} className={[styles.trigger, className].filter(Boolean).join(" ")}>
        <span className={styles.value}><Select.Value>{selectedLabel}</Select.Value></span>
        <Select.Icon asChild><ChevronDown size={13} /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={styles.menu} position="popper" sideOffset={5} collisionPadding={10}>
          <Select.ScrollUpButton className={styles.scroll}><ChevronDown size={14} /></Select.ScrollUpButton>
          <Select.Viewport>
            {options.map(option => (
              <Select.Item key={option.value} value={option.value || empty} className={styles.option}>
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator><Check size={15} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className={styles.scroll}><ChevronDown size={14} /></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
