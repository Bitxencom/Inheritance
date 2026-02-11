"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";

interface SiteHeaderProps {
  showVaultsButton?: boolean;
}

export function SiteHeader({ showVaultsButton = true }: SiteHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 md:px-6 bg-background">
      <div className="flex items-center justify-between gap-2 w-full max-w-[44rem] mx-auto">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-8 w-auto hover:opacity-80 transition-opacity cursor-pointer"
            />
          </a>
          <span className="font-semibold italic border rounded-full px-4 py-1 bg-[linear-gradient(1050deg,#000000,#064e3b,#000000)] text-white border-emerald-500 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] text-sm tracking-wide">
            Digital Inheritance
          </span>
        </div>

        {showVaultsButton && (
          <div className="flex items-center gap-2">
            <Link href="/vaults" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">View Vaults</span>
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
