"use client";

import { useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar className="hidden md:flex" />

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 md:hidden [&>button]:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Browse workspaces and dashboard sections.</SheetDescription>
          </SheetHeader>
          <AppSidebar mobile onNavigate={() => setMobileSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-h-screen md:pl-64">
        <AppHeader onOpenSidebar={() => setMobileSidebarOpen(true)} />
        <main className="min-h-[calc(100vh-4rem)] overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
