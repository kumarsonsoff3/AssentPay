"use client";

import { ArrowUpRight, Menu } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const links = [
  { label: "Product", href: "#product-preview" },
  { label: "AI capabilities", href: "#capabilities" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Integrations", href: "#integrations" },
];

export function SiteHeader() {
  return (
    <header className="relative z-30 border-b border-navy/6 bg-white/90">
      <div className="page-shell flex h-16 items-center justify-between gap-6 lg:h-18">
        <Brand />
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-6 lg:flex xl:gap-9"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium text-navy/70 transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <span className="hidden text-[11px] font-medium text-muted-foreground xl:block">
            Built for your business
          </span>
          <Button asChild className="h-11 rounded-lg px-5 text-xs shadow-none">
            <a href="#workflow">Explore demo <ArrowUpRight className="ml-1 size-3.5" /></a>
          </Button>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-11 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[min(88vw,360px)] bg-white">
            <SheetHeader className="px-6 pt-10">
              <SheetTitle>
                <Brand />
              </SheetTitle>
              <SheetDescription className="pt-3 text-left">
                Your conversations. Your cash flow. Your control.
              </SheetDescription>
            </SheetHeader>
            <nav
              aria-label="Mobile navigation"
              className="flex flex-col gap-2 px-6 pt-5"
            >
              {links.map((link) => (
                <SheetClose asChild key={link.href}>
                  <a
                    href={link.href}
                    className="rounded-lg px-3 py-4 text-base font-medium text-navy hover:bg-secondary"
                  >
                    {link.label}
                  </a>
                </SheetClose>
              ))}
              <SheetClose asChild>
                <Button asChild className="mt-5 h-12">
                  <a href="#workflow">Explore demo <ArrowUpRight className="size-4" /></a>
                </Button>
              </SheetClose>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
