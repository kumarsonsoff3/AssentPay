"use client";
import { RecoveryState } from "@/components/feedback/recovery";
export default function GlobalError({ retry }: { retry: () => void }) { return <html lang="en"><head><title>Something went wrong | AssentPay</title></head><body style={{margin:0,background:"#f7f9fd"}}><RecoveryState retry={retry} href="/" action="Go to home"/></body></html>; }
