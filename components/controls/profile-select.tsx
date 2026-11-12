import type { ComponentPropsWithoutRef } from "react";
import { ChevronDown } from "@/components/icons";
import styles from "./profile-select.module.css";

export function ProfileSelect(props: ComponentPropsWithoutRef<"select">) {
  return (
    <span className={styles.wrapper}>
      <select {...props} className={styles.control} />
      <ChevronDown aria-hidden="true" size={14} className={styles.chevron} />
    </span>
  );
}
