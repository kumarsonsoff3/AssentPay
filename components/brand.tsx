import Image from "next/image";
import { cn } from "@/lib/utils";

export function Brand({
  compact = false,
  small = false,
  className,
}: {
  compact?: boolean;
  small?: boolean;
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
        sizes={small ? "32px" : "56px"}
        className={cn(
          "shrink-0 object-contain",
          small ? "size-8" : "size-13 sm:size-14",
        )}
      />
      {!compact && (
        <span className="block">
          <span
            className={cn(
              "block font-bold tracking-[-0.8px] text-navy",
              small
                ? "text-[15px] leading-4.75"
                : "text-[24px] leading-7.25 sm:text-[26px] sm:leading-7.75",
            )}
          >
            Assent<span className="brand-gradient">Pay</span>
          </span>
          <span
            className={cn(
              "mt-0.5 block font-medium tracking-[0.035em] whitespace-nowrap text-navy/70 uppercase",
              small
                ? "text-[4.4px] leading-1.75"
                : "text-[7px] leading-2.5 sm:text-[7.6px]",
            )}
          >
            AI-powered financial operations
          </span>
        </span>
      )}
    </span>
  );
}

function AppMark({ src, className }: { src: string; className?: string }) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={32}
      height={32}
      className={cn("size-7 shrink-0 object-contain", className)}
    />
  );
}

export function GmailMark({ className }: { className?: string }) {
  return <AppMark src="/integrations/gmail.png" className={className} />;
}
export function SlackMark({ className }: { className?: string }) {
  return <AppMark src="/integrations/slack.svg" className={className} />;
}
export function PayPalMark({ className }: { className?: string }) {
  return <AppMark src="/integrations/paypal-mark.svg" className={className} />;
}
export function WhatsAppMark({ className }: { className?: string }) {
  return <AppMark src="/integrations/whatsapp.svg" className={className} />;
}
export function DiscordMark({ className }: { className?: string }) {
  return <AppMark src="/integrations/discord.svg" className={className} />;
}
export function TelegramMark({ className }: { className?: string }) {
  return <AppMark src="/integrations/telegram.svg" className={className} />;
}
