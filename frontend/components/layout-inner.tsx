"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isWorkbench = pathname === "/"

  if (isWorkbench) {
    return <>{children}</>
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <React.Suspense>
          {children}
        </React.Suspense>
      </SidebarInset>
    </SidebarProvider>
  )
}
