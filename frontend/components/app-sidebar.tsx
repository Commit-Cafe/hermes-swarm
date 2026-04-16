"use client"

import * as React from "react"
import {
  IconBrandTelegram,
  IconChartBar,
  IconDashboard,
  IconInnerShadowTop,
  IconListDetails,
  IconTerminal2,
  IconUsers,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"

import Link from "next/link"

const data = {
  user: {
    name: "Hermes Commander",
    email: "swarm@hermes",
    avatar: "",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Tasks",
      url: "/tasks",
      icon: IconListDetails,
    },
    {
      title: "Agents",
      url: "/agents",
      icon: IconUsers,
    },
    {
      title: "Logs",
      url: "/logs",
      icon: IconTerminal2,
    },
  ],
  navSecondary: [] as {title: string; url: string; icon: any}[],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link href="/">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold tracking-tight">Hermes Swarm</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Workbench">
                  <Link href="/">
                    <IconBrandTelegram />
                    <span>Workbench</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
