import { ArrowUpRight } from "@/components/icons";
import { forwardingGuides, forwardingProviders, type ForwardingProvider } from "@/lib/email-forwarding";
import { IntegrationMark } from "@/components/integration-mark";
import styles from "./workspace-inbox.module.css";

export function ForwardingProviderPicker({ value, onChange }: { value: ForwardingProvider; onChange: (provider: ForwardingProvider) => void }) {
  return <div className={styles.providerPicker} role="group" aria-label="Email provider">
    {forwardingProviders.map((provider) => <button type="button" key={provider.id} aria-pressed={value === provider.id} onClick={() => onChange(provider.id)}>
      <IntegrationMark provider={provider.id} size={20} />{provider.name}
    </button>)}
  </div>;
}

export function ForwardingGuide({ provider }: { provider: ForwardingProvider }) {
  const guide = forwardingGuides[provider];
  return <div className={styles.guide}>
    <p>{guide.intro}</p>
    <ol className={styles.guideSteps}>{guide.steps.map((step) => <li key={step.title}><InstructionText>{step.detail}</InstructionText></li>)}</ol>
    <p className={styles.guideNote}><InstructionText>{guide.note}</InstructionText></p>
    {guide.help && <a className={styles.textButton} href={guide.help} target="_blank" rel="noopener noreferrer">Official setup guide <ArrowUpRight size={14} /></a>}
  </div>;
}

/** Static guide copy uses explicit action spans, never HTML from email content. */
function InstructionText({ children }: { children: string }) {
  return children.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part);
}
