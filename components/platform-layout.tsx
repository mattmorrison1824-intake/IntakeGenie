"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { createBrowserClient } from "@/lib/clients/supabase"
import { useRouter } from "next/navigation"

export function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = React.useMemo(() => {
    if (typeof window === 'undefined') return null
    return createBrowserClient()
  }, [])

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 justify-end">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </header>
        <div className="flex flex-1 flex-col" style={{ backgroundColor: '#FFFFFF' }}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

