import Image from "next/image";
import { IntegrationMark } from "./integration-mark";
import { cn } from "@/lib/utils";

export function Brand({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5", className)}
    >
      <Image
        src="/logo.png"
        alt={compact ? "AssentPay" : ""}
        aria-hidden={compact ? undefined : true}
        width={56}
        height={56}
        sizes="40px"
        className={cn(
          "shrink-0 object-contain",
          "size-10",
        )}
      />
      {!compact && (
        <span className="block">
          <span
            className={cn(
              "block font-bold tracking-[-0.8px] text-navy",
              "text-[20px] leading-6",
            )}
          >
            Assent<span className="brand-gradient">Pay</span>
          </span>
          <span
            className={cn(
              "mt-0.5 block font-medium tracking-[0.035em] whitespace-nowrap text-navy/70 uppercase",
              "text-[5.8px] leading-2",
            )}
          >
            AI-powered financial operations
          </span>
        </span>
      )}
    </span>
  );
}

// One brand component keeps provider colors and artwork consistent app-wide.
export function GmailMark({ className }: { className?: string }) {
  return <IntegrationMark provider="gmail" size={28} className={cn("size-7", className)} />;
}
export function SlackMark({ className }: { className?: string }) {
  return <IntegrationMark provider="slack" size={28} className={cn("size-7", className)} />;
}
export function PayPalMark({ className }: { className?: string }) {
  return <IntegrationMark provider="paypal" size={28} className={cn("size-7", className)} />;
}
export function WhatsAppMark({ className }: { className?: string }) {
  return <IntegrationMark provider="whatsapp" size={28} className={cn("size-7", className)} />;
}
export function DiscordMark({ className }: { className?: string }) {
  return <IntegrationMark provider="discord" size={28} className={cn("size-7", className)} />;
}
export function TelegramMark({ className }: { className?: string }) {
  return <IntegrationMark provider="telegram" size={28} className={cn("size-7", className)} />;
}
export function GoogleMark({ className }: { className?: string }) {
  return <IntegrationMark provider="google" size={28} className={cn("size-7", className)} />;
}
