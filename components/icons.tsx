import {
  PiArrowCounterClockwiseBold,
  PiArrowDownBold,
  PiArrowDownLeftBold,
  PiArrowLeftBold,
  PiArrowRightBold,
  PiArrowSquareOutBold,
  PiArrowUpRightBold,
  PiArrowsClockwiseBold,
  PiArrowsCounterClockwiseBold,
  PiArrowsDownUp,
  PiArrowsOutSimpleBold,
  PiBell,
  PiBellRinging,
  PiBookOpenText,
  PiBrain,
  PiBriefcase,
  PiBuildings,
  PiCalendarDots,
  PiCaretDownBold,
  PiCaretRightBold,
  PiChartLineUp,
  PiChat,
  PiChatText,
  PiCheckBold,
  PiCheckCircle,
  PiChecksBold,
  PiCircle,
  PiClipboardText,
  PiClockCounterClockwise,
  PiClock,
  PiCoins,
  PiCopy,
  PiCreditCard,
  PiDotsThreeBold,
  PiEnvelope,
  PiEye,
  PiEyeSlash,
  PiFaders,
  PiFileDashed,
  PiFileMagnifyingGlass,
  PiFileText,
  PiFingerprint,
  PiFolderOpen,
  PiFunnel,
  PiGearSix,
  PiGitDiff,
  PiHandshake,
  PiInfo,
  PiKanban,
  PiKey,
  PiLightning,
  PiLink,
  PiListBold,
  PiListChecks,
  PiLockKey,
  PiMagnifyingGlassBold,
  PiPaperclipBold,
  PiPauseFill,
  PiPencilSimple,
  PiPlayCircle,
  PiPlayFill,
  PiPlugCharging,
  PiPlugs,
  PiPlusBold,
  PiQuestion,
  PiReceipt,
  PiRobot,
  PiSealCheck,
  PiShieldCheck,
  PiSlidersHorizontal,
  PiSparkle,
  PiSpinnerGapBold,
  PiSquaresFour,
  PiTrash,
  PiTray,
  PiUserCircle,
  PiUserPlus,
  PiUsers,
  PiWarningCircle,
  PiWarning,
  PiWifiSlash,
  PiXBold,
} from "react-icons/pi";
import type { IconBaseProps, IconType } from "react-icons";

/** Regular Phosphor outlines keep UI icons visually consistent. Provider logos live in integration-mark.tsx. */
export const iconSizes = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 } as const;
export type IconTone = "inherit" | "muted" | "brand" | "info" | "success" | "warning" | "danger" | "intelligence";
export type AppIconProps = IconBaseProps & { tone?: IconTone };

function defineIcon(Glyph: IconType) {
  return function AppIcon({ size = iconSizes.md, tone = "inherit", className, style, ...props }: AppIconProps) {
    const labelled = Boolean(props["aria-label"] || props["aria-labelledby"] || props.title);
    return <Glyph
      size={size}
      className={className ? `app-icon ${className}` : "app-icon"}
      data-icon-set="phosphor"
      data-icon-tone={tone}
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      focusable="false"
      {...props}
      style={tone === "inherit" ? style : { color: `var(--icon-${tone})`, ...style }}
    />;
  };
}

export const AlertCircle = /* @__PURE__ */ defineIcon(PiWarningCircle);
export const ArrowDown = /* @__PURE__ */ defineIcon(PiArrowDownBold);
export const ArrowDownLeft = /* @__PURE__ */ defineIcon(PiArrowDownLeftBold);
export const ArrowDownUp = /* @__PURE__ */ defineIcon(PiArrowsDownUp);
export const ArrowLeft = /* @__PURE__ */ defineIcon(PiArrowLeftBold);
export const ArrowRight = /* @__PURE__ */ defineIcon(PiArrowRightBold);
export const ArrowUpRight = /* @__PURE__ */ defineIcon(PiArrowUpRightBold);
export const BadgeCheck = /* @__PURE__ */ defineIcon(PiSealCheck);
export const Bell = /* @__PURE__ */ defineIcon(PiBell);
export const BellRing = /* @__PURE__ */ defineIcon(PiBellRinging);
export const BookOpenText = /* @__PURE__ */ defineIcon(PiBookOpenText);
export const Bot = /* @__PURE__ */ defineIcon(PiRobot);
export const BrainCircuit = /* @__PURE__ */ defineIcon(PiBrain);
export const BriefcaseBusiness = /* @__PURE__ */ defineIcon(PiBriefcase);
export const Building2 = /* @__PURE__ */ defineIcon(PiBuildings);
export const CalendarDays = /* @__PURE__ */ defineIcon(PiCalendarDots);
export const ChartNoAxesCombined = /* @__PURE__ */ defineIcon(PiChartLineUp);
export const Check = /* @__PURE__ */ defineIcon(PiCheckBold);
export const CheckCheck = /* @__PURE__ */ defineIcon(PiChecksBold);
export const CheckCircle2 = /* @__PURE__ */ defineIcon(PiCheckCircle);
export const ChevronDown = /* @__PURE__ */ defineIcon(PiCaretDownBold);
export const ChevronRight = /* @__PURE__ */ defineIcon(PiCaretRightBold);
export const Circle = /* @__PURE__ */ defineIcon(PiCircle);
export const CircleAlert = /* @__PURE__ */ defineIcon(PiWarningCircle);
export const CircleCheck = /* @__PURE__ */ defineIcon(PiCheckCircle);
export const CircleHelp = /* @__PURE__ */ defineIcon(PiQuestion);
export const CirclePlay = /* @__PURE__ */ defineIcon(PiPlayCircle);
export const ClipboardCheck = /* @__PURE__ */ defineIcon(PiClipboardText);
export const Clock3 = /* @__PURE__ */ defineIcon(PiClock);
export const Coins = /* @__PURE__ */ defineIcon(PiCoins);
export const Copy = /* @__PURE__ */ defineIcon(PiCopy);
export const CreditCard = /* @__PURE__ */ defineIcon(PiCreditCard);
export const ExternalLink = /* @__PURE__ */ defineIcon(PiArrowSquareOutBold);
export const Eye = /* @__PURE__ */ defineIcon(PiEye);
export const EyeOff = /* @__PURE__ */ defineIcon(PiEyeSlash);
export const FileQuestion = /* @__PURE__ */ defineIcon(PiFileDashed);
export const FileSearch = /* @__PURE__ */ defineIcon(PiFileMagnifyingGlass);
export const FileText = /* @__PURE__ */ defineIcon(PiFileText);
export const Filter = /* @__PURE__ */ defineIcon(PiFunnel);
export const Fingerprint = /* @__PURE__ */ defineIcon(PiFingerprint);
export const FolderKanban = /* @__PURE__ */ defineIcon(PiKanban);
export const FolderOpen = /* @__PURE__ */ defineIcon(PiFolderOpen);
export const GitCompareArrows = /* @__PURE__ */ defineIcon(PiGitDiff);
export const Handshake = /* @__PURE__ */ defineIcon(PiHandshake);
export const History = /* @__PURE__ */ defineIcon(PiClockCounterClockwise);
export const Inbox = /* @__PURE__ */ defineIcon(PiTray);
export const Info = /* @__PURE__ */ defineIcon(PiInfo);
export const KeyRound = /* @__PURE__ */ defineIcon(PiKey);
export const LayoutGrid = /* @__PURE__ */ defineIcon(PiSquaresFour);
export const Link2 = /* @__PURE__ */ defineIcon(PiLink);
export const ListChecks = /* @__PURE__ */ defineIcon(PiListChecks);
export const LoaderCircle = /* @__PURE__ */ defineIcon(PiSpinnerGapBold);
export const LockKeyhole = /* @__PURE__ */ defineIcon(PiLockKey);
export const Mail = /* @__PURE__ */ defineIcon(PiEnvelope);
export const Maximize2 = /* @__PURE__ */ defineIcon(PiArrowsOutSimpleBold);
export const Menu = /* @__PURE__ */ defineIcon(PiListBold);
export const MessageSquare = /* @__PURE__ */ defineIcon(PiChat);
export const MessageSquareText = /* @__PURE__ */ defineIcon(PiChatText);
export const MoreHorizontal = /* @__PURE__ */ defineIcon(PiDotsThreeBold);
export const Paperclip = /* @__PURE__ */ defineIcon(PiPaperclipBold);
export const Pause = /* @__PURE__ */ defineIcon(PiPauseFill);
export const Pencil = /* @__PURE__ */ defineIcon(PiPencilSimple);
export const Play = /* @__PURE__ */ defineIcon(PiPlayFill);
export const PlugZap = /* @__PURE__ */ defineIcon(PiPlugCharging);
export const Plus = /* @__PURE__ */ defineIcon(PiPlusBold);
export const ReceiptText = /* @__PURE__ */ defineIcon(PiReceipt);
export const RefreshCcw = /* @__PURE__ */ defineIcon(PiArrowsCounterClockwiseBold);
export const RefreshCw = /* @__PURE__ */ defineIcon(PiArrowsClockwiseBold);
export const RotateCcw = /* @__PURE__ */ defineIcon(PiArrowCounterClockwiseBold);
export const Search = /* @__PURE__ */ defineIcon(PiMagnifyingGlassBold);
export const Settings = /* @__PURE__ */ defineIcon(PiGearSix);
export const Settings2 = /* @__PURE__ */ defineIcon(PiFaders);
export const ShieldCheck = /* @__PURE__ */ defineIcon(PiShieldCheck);
export const SlidersHorizontal = /* @__PURE__ */ defineIcon(PiSlidersHorizontal);
export const Sparkles = /* @__PURE__ */ defineIcon(PiSparkle);
export const Trash2 = /* @__PURE__ */ defineIcon(PiTrash);
export const TriangleAlert = /* @__PURE__ */ defineIcon(PiWarning);
export const Unplug = /* @__PURE__ */ defineIcon(PiPlugs);
export const UserPlus = /* @__PURE__ */ defineIcon(PiUserPlus);
export const UserRound = /* @__PURE__ */ defineIcon(PiUserCircle);
export const Users = /* @__PURE__ */ defineIcon(PiUsers);
export const WifiOff = /* @__PURE__ */ defineIcon(PiWifiSlash);
export const X = /* @__PURE__ */ defineIcon(PiXBold);
export const XIcon = /* @__PURE__ */ defineIcon(PiXBold);
export const Zap = /* @__PURE__ */ defineIcon(PiLightning);
