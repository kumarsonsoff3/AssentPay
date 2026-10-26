import Image from "next/image";
import { FcGoogle } from "react-icons/fc";
import { PiMicrosoftOutlookLogoDuotone } from "react-icons/pi";
import { Mail } from "./icons";
import { cn } from "@/lib/utils";

export type IntegrationBrand = "gmail" | "google" | "google-workspace" | "outlook" | "microsoft-365" | "slack" | "paypal" | "whatsapp" | "discord" | "telegram" | "other";
const assets = {
  gmail: "/integrations/gmail.png",
  slack: "/integrations/slack.svg",
  paypal: "/integrations/paypal-mark.svg",
  whatsapp: "/integrations/whatsapp.svg",
  discord: "/integrations/discord.svg",
  telegram: "/integrations/telegram.svg",
  "microsoft-365": "/integrations/microsoft.svg",
} as const;

/** Keep original multicolor brand marks; never tint them with a control's color. */
export function IntegrationMark({ provider, size = 24, className }: { provider: IntegrationBrand; size?: number; className?: string }) {
  const classes = cn("integration-mark shrink-0", className);
  if (provider === "google" || provider === "google-workspace") return <FcGoogle size={size} className={classes} aria-hidden="true" focusable="false" />;
  if (provider === "outlook") return <PiMicrosoftOutlookLogoDuotone size={size} color="#0078d4" className={classes} aria-hidden="true" focusable="false" />;
  if (provider === "other") return <Mail size={size} tone="muted" className={classes} />;
  return <Image src={assets[provider]} alt="" aria-hidden="true" width={size} height={size} className={cn(classes, "object-contain")} />;
}
