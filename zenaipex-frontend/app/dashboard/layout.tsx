"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, Book, Phone, MessageSquare, BarChart, Settings, CreditCard, LogOut, Bell, Search, ChevronRight, PanelLeftClose, PanelLeftOpen, Menu, X, Building2, MessageCircle, Activity, History } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchApi, getCompanyLogoUrl } from "@/lib/api/client";
import { useCurrentCompany } from "@/hooks/use-company";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";

const navGroups = [
  {
    title: "ORGANIZATION",
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { name: "AI Agents", href: "/dashboard/agents", icon: Users },
      { name: "Channels", href: "/dashboard/channels", icon: Phone },
      { name: "Customer Calls & Chats", href: "/dashboard/conversations", icon: MessageSquare },
      { name: "Business Analytics", href: "/dashboard/analytics", icon: BarChart },
      { name: "Usage & Billing", href: "/dashboard/usage", icon: CreditCard },
      { name: "Settings", href: "/dashboard/settings", icon: Settings },
    ]
  },
  {
    title: "AI WORKSPACE",
    items: [
      { name: "My Chat", href: "/dashboard/my-ai/chat", icon: MessageCircle },
      { name: "Chat History", href: "/dashboard/my-ai/history", icon: History },
      { name: "Knowledge Base", href: "/dashboard/knowledge", icon: Book },
      { name: "My Usage", href: "/dashboard/my-ai/usage", icon: Activity },
    ]
  }
];


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { companyId } = useCurrentCompany();
  const [company, setCompany] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [viewAsCompanyName, setViewAsCompanyName] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["ORGANIZATION", "AI WORKSPACE"]);

  useEffect(() => {
    if (!localStorage.getItem("zenaipex_token")) {
      window.location.replace("/login");
    }
  }, []);

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => 
      prev.includes(title) 
        ? prev.filter(g => g !== title)
        : [...prev, title]
    );
  };

  useEffect(() => {
    setViewAsCompanyName(sessionStorage.getItem("view_as_company_name"));
  }, []);

  useEffect(() => {
    if (companyId) {
      const loadCompany = () => {
        fetchApi(`/companies/${companyId}`).then((res: any) => {
          setCompany(res);
          const isViewingAsCompany = !!sessionStorage.getItem("view_as_company_id");
          if (res.onboarding_completed === false && !isViewingAsCompany) {
            router.push("/onboarding");
          }
        }).catch(() => {});
      };
      
      loadCompany();
      
      window.addEventListener("company-updated", loadCompany);
      return () => window.removeEventListener("company-updated", loadCompany);
    }
  }, [companyId, router]);

  // Close mobile menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("zenaipex_token");
    window.location.replace("/login");
  };

  const pathSegments = pathname.split('/').filter(p => p && p !== 'dashboard');
  const breadcrumb = pathSegments.length > 0 
    ? pathSegments[0].charAt(0).toUpperCase() + pathSegments[0].slice(1)
    : "Overview";

  return (
    <div className="flex min-h-screen bg-background text-foreground overflow-clip font-sans">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-[#EEF1EC] border-r border-[#D9E2DC] transition-all duration-300 ease-in-out shadow-sm lg:shadow-none",
          // Mobile classes
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          "w-[280px] lg:translate-x-0",
          // Desktop classes
          isSidebarOpen ? "lg:w-[280px]" : "lg:w-[80px]"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center transition-opacity hover:opacity-80 overflow-hidden">
            {/* Mobile and desktop-expanded: full wordmark */}
            <BrandLogo
              iconSize={40}
              textSize="text-xl"
              className={cn(!isSidebarOpen && "lg:hidden")}
            />
            {/* Desktop-collapsed: icon only */}
            {!isSidebarOpen && (
              <BrandLogo
                iconSize={36}
                iconOnly
                className="hidden lg:flex"
              />
            )}
          </Link>
          <div className="flex lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500 hover:bg-slate-200/50">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
                <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-6 scrollbar-none">
          {navGroups.map((group, index) => (
            <div key={group.title} className={cn("mb-6", index === navGroups.length - 1 ? "mb-0" : "")}>
              <button
                onClick={() => toggleGroup(group.title)}
                className={cn(
                  "w-full flex items-center justify-between mb-1.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-md py-1.5 transition-all duration-150 group",
                  !isSidebarOpen && "lg:opacity-0 lg:w-0 lg:hidden"
                )}
              >
                <span>{group.title}</span>
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform duration-150 text-[#5F786D] group-hover:text-[#43584F]", 
                  expandedGroups.includes(group.title) ? "rotate-90" : ""
                )} />
              </button>
              
              {!isSidebarOpen && <div className="hidden lg:block h-px bg-[#D9E2DC] my-4 mx-4" />}
              
              <div className={cn(
                "grid transition-all duration-200 ease-in-out",
                expandedGroups.includes(group.title) || !isSidebarOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}>
                <nav className="flex flex-col gap-1.5 overflow-hidden">
                  {group.items.map((item) => {
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    return (
                      <Link 
                        key={item.name}
                        href={item.href} 
                        title={!isSidebarOpen ? item.name : undefined}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap group",
                          isActive 
                            ? "bg-[#DFE7E1] text-sage-800 rounded-r-md rounded-l-none" 
                            : "text-slate-600 hover:bg-[#E5EAE7] hover:text-slate-900 rounded-md",
                          !isSidebarOpen && "lg:justify-center lg:px-0 lg:rounded-md"
                        )}
                      >
                        {isActive && <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-sage-600", !isSidebarOpen && "lg:hidden")} />}
                        {isActive && !isSidebarOpen && <div className="hidden lg:block absolute left-1 top-1/2 -translate-y-1/2 h-1/2 w-1 rounded-full bg-sage-600" />}
                        <item.icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-sage-700" : "text-slate-500 group-hover:text-sage-700")} />
                        <span className={cn(
                          "transition-all duration-300",
                          !isSidebarOpen && "lg:opacity-0 lg:w-0 lg:hidden"
                        )}>
                          {item.name}
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-auto p-4">
          <div className={cn(
            "flex items-center rounded-xl bg-white/50 p-2.5 shadow-sm border border-[#D9E2DC]/50 transition-all duration-300",
            isSidebarOpen ? "justify-between" : "lg:justify-center"
          )}>
            <div className={cn(
              "flex items-center gap-3 overflow-hidden",
              !isSidebarOpen && "lg:hidden"
            )}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-sm font-semibold text-slate-700 overflow-hidden relative">
                {company?.settings?.logo_url ? (
                  <img src={getCompanyLogoUrl(companyId!, company.settings.logo_url)} alt="Logo" className="h-full w-full object-contain p-1" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <Building2 className="h-5 w-5 text-slate-500 absolute" />
                )}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-semibold text-slate-900">{company?.name || "Loading..."}</span>
                <span className="truncate text-xs font-medium text-slate-500 capitalize">{company?.plan?.replace("_", " ") || "Plan"}</span>
              </div>
            </div>
            {!isSidebarOpen && (
              <div className="hidden lg:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 transition-colors" onClick={handleLogout} title="Log out">
                <LogOut className="h-4 w-4 text-slate-600" />
              </div>
            )}
            <button 
              onClick={handleLogout}
              className={cn(
                "shrink-0 rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-900",
                !isSidebarOpen && "lg:hidden"
              )}
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className={cn(
          "flex flex-1 flex-col transition-all duration-300 ease-in-out min-w-0 bg-background",
          isSidebarOpen ? "lg:pl-[280px]" : "lg:pl-[80px]"
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 sm:px-8 backdrop-blur-md">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden text-slate-500 hover:bg-slate-100" 
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="hidden lg:flex text-slate-500 hover:bg-slate-100" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-500 hidden sm:inline-block">Dashboard</span>
              {breadcrumb !== "Overview" && (
                <>
                  <ChevronRight className="h-4 w-4 text-slate-400 hidden sm:inline-block" />
                  <span className="font-semibold text-slate-900">{breadcrumb}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                className="h-9 w-48 lg:w-64 rounded-full border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none transition-all focus:border-sage-500 focus:ring-2 focus:ring-sage-100 shadow-sm"
              />
            </div>
            <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-100 rounded-full h-9 w-9">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="h-8 w-8 cursor-pointer rounded-full bg-gradient-to-tr from-sage-600 to-sage-800 shadow-sm shrink-0 ring-2 ring-white overflow-hidden flex items-center justify-center">
              {company?.settings?.logo_url && (
                <img src={getCompanyLogoUrl(companyId!, company.settings.logo_url)} alt="Avatar" className="h-full w-full object-contain bg-white" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              )}
            </div>
          </div>
        </header>

        {viewAsCompanyName && (
          <div className="bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between shadow-md z-20 relative">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-xs bg-indigo-800 px-2 py-1 rounded">Super Admin Mode</span>
              <span className="text-sm font-medium">Viewing as <strong>{viewAsCompanyName}</strong></span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                sessionStorage.removeItem("view_as_company_id");
                sessionStorage.removeItem("view_as_company_name");
                router.push("/admin/companies");
              }}
              className="h-8 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              Exit View Mode
            </Button>
          </div>
        )}

        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

