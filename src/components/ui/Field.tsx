import type { ComponentProps, ReactNode } from "react";

import { cx } from "./cx";
import styles from "./Field.module.css";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label + control + optional hint. */
export const Field = ({ label, hint, children, className }: FieldProps) => (
  <label className={cx(styles.field, className)}>
    <span className={styles.label}>{label}</span>
    {children}
    {hint && <span className={styles.hint}>{hint}</span>}
  </label>
);

export const Input = ({ className, ...rest }: ComponentProps<"input">) => (
  <input className={cx(styles.control, className)} {...rest} />
);

export const Select = ({ className, ...rest }: ComponentProps<"select">) => (
  <select className={cx(styles.control, styles.select, className)} {...rest} />
);

export const Textarea = ({ className, ...rest }: ComponentProps<"textarea">) => (
  <textarea className={cx(styles.control, styles.textarea, className)} {...rest} />
);
