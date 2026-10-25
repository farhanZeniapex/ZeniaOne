"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Phone,
  MessageSquare,
  BarChart,
  Settings,
  CreditCard,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Activity,
  BookOpen,
  Zap,
  ClipboardList,
  HeartPulse,
  ChevronDown,
  ArrowLeft,
  User,
  AlertTriangle,
  ShieldAlert,
  Bot,
  Clock,
  Headset,
  Search,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { API_BASE_URL, fetchApi, getCompanyLogoUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { SmartSelect } from "@/components/ui/smart-select";
import { Modal } from "@/components/ui/modal";
import { useBranding } from "@/hooks/use-branding";
import "./admin-theme.css";

type NavLink = {
  name: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};
type NavItem = NavLink & { children?: NavLink[] };
type NavGroup = { title: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: "COMMAND CENTER",
    items: [
      { name: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
      { name: "Live Calls", href: "/admin/live-calls", icon: Activity },
      {
        name: "Conversations",
        href: "/admin/conversations",
        icon: MessageSquare,
      },
    ],
  },
  {
    title: "BUILD & DEPLOY",
    items: [
      { name: "Organization", href: "/admin/companies", icon: Building2 },
      { name: "Agents & Voices", href: "/admin/agents", icon: Headset },
      { name: "Channels", href: "/admin/channels", icon: Phone },
    ],
  },
  {
    title: "AI WORKSPACE",
    items: [
      {
        name: "Assistant",
        href: "/admin/my-ai/chat",
        icon: Bot,
        children: [
          { name: "New Chat", href: "/admin/my-ai/chat", icon: Bot },
          {
            name: "Chat History",
            href: "/admin/my-ai/conversations",
            icon: Clock,
          },
        ],
      },
      {
        name: "Knowledge",
        href: "/admin/knowledge",
        icon: BookOpen,
        children: [
          {
            name: "My Documents",
            href: "/admin/my-ai/documents",
            icon: BookOpen,
          },
          { name: "Knowledge Base", href: "/admin/knowledge", icon: BookOpen },
        ],
      },
      {
        name: "Studio",
        href: "/admin/ai-playground",
        icon: Zap,
        children: [
          { name: "AI Playground", href: "/admin/ai-playground", icon: Zap },
          { name: "Usage & Costs", href: "/admin/usage", icon: BarChart },
        ],
      },
    ],
  },
  {
    title: "CONTROL",
    items: [
      {
        name: "AI Routing",
        href: "/admin/system/ai-providers",
        icon: Settings,
      },
      {
        name: "System",
        href: "/admin/system",
        icon: HeartPulse,
        children: [
          {
            name: "Health & Logs",
            href: "/admin/system",
            icon: HeartPulse,
            exact: true,
          },
          { name: "Activity Logs", href: "/admin/logs", icon: ClipboardList },
          { name: "Settings", href: "/admin/settings", icon: ShieldAlert },
        ],
      },
      {
        name: "Billing & Plans",
        href: "/admin/subscriptions",
        icon: CreditCard,
      },
    ],
  },
];

// Compact sidebar keeps daily work visible. The command palette still exposes
// every specialist page without filling the navigation with rarely used links.
const commandItems = [
  ...navGroups.flatMap((group) =>
    group.items.flatMap((item) => item.children || [item]),
  ),
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isFocusChat = pathname === "/admin/my-ai/chat";

  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<{
    name: string;
    email: string;
  } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFocusHeaderOpen, setIsFocusHeaderOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isCompanyPickerOpen, setIsCompanyPickerOpen] = useState(false);
  const [customerCompanies, setCustomerCompanies] = useState<
    Array<{
      id: string;
      name: string;
      slug?: string;
      owner_email?: string;
      is_active?: boolean;
      logo_url?: string;
    }>
  >([]);
  const [isCompanyPickerLoading, setIsCompanyPickerLoading] = useState(false);
  const [selectedCustomerCompanyId, setSelectedCustomerCompanyId] =
    useState("");
  const [commandQuery, setCommandQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([
    "COMMAND CENTER",
    "BUILD & DEPLOY",
    "AI WORKSPACE",
  ]);
  const [expandedItems, setExpandedItems] = useState<string[]>(["Assistant"]);
  const profileRef = useRef<HTMLDivElement>(null);
  const sidebarBeforeFocusRef = useRef<boolean | null>(null);

  const {
    platformName,
    hasLogo: platformHasLogo,
    timestamp: logoTimestamp,
  } = useBranding();

  useEffect(() => {
    async function checkAdmin() {
      try {
        const token = localStorage.getItem("zenaipex_token");
        if (!token) {
          setIsLoading(false);
          router.push("/login");
          return;
        }

        const res = await fetchApi<{
          is_platform_admin: boolean;
          name: string;
          email: string;
        }>("/auth/me");

        if (res.is_platform_admin) {
          setIsAdmin(true);
          setUserProfile({ name: res.name, email: res.email });
          setIsLoading(false);
        } else {
          // They are logged in but not an admin.
          setIsLoading(false);
          // router.push("/dashboard") could be slow, so we explicitly keep isAdmin false
          // but we are no longer loading, so it will render Access Denied instead of spinning
          router.push("/dashboard");
        }
      } catch (err: any) {
        setIsLoading(false);
        // If it's a 401, they will be sent to /login by fetchApi automatically
        // For other network errors, show a retryable state
        if (err?.status !== 401) {
          setErrorMsg(err.message || "Failed to verify admin access.");
        }
      }
    }
    checkAdmin();
  }, [router]);

  const isItemActive = (item: { href: string; exact?: boolean }) => {
    return item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + "/");
  };
  const hasActiveChild = (item: NavItem) =>
    Boolean(item.children?.some(isItemActive));

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsFocusHeaderOpen(false);
    const activeGroup = navGroups.find((group) =>
      group.items.some((item) => isItemActive(item) || hasActiveChild(item)),
    );
    if (activeGroup) {
      setExpandedGroups((prev) =>
        prev.includes(activeGroup.title) ? prev : [...prev, activeGroup.title],
      );
    }
    const activeParent = navGroups
      .flatMap((group) => group.items)
      .find(hasActiveChild);
    if (activeParent)
      setExpandedItems((prev) =>
        prev.includes(activeParent.name) ? prev : [...prev, activeParent.name],
      );
  }, [pathname]);

  useEffect(() => {
    const toggleFocusHeader = () => setIsFocusHeaderOpen((open) => !open);
    window.addEventListener("zenia:toggle-admin-header", toggleFocusHeader);
    return () =>
      window.removeEventListener("zenia:toggle-admin-header", toggleFocusHeader);
  }, []);

  useEffect(() => {
    if (isFocusChat) {
      setIsSidebarOpen((current) => {
        if (sidebarBeforeFocusRef.current === null) {
          sidebarBeforeFocusRef.current = current;
        }
        return false;
      });
    } else if (sidebarBeforeFocusRef.current !== null) {
      setIsSidebarOpen(sidebarBeforeFocusRef.current);
      sidebarBeforeFocusRef.current = null;
    }
  }, [isFocusChat]);

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) =>
      prev.includes(title) ? prev.filter((g) => g !== title) : [...prev, title],
    );
  };
  const toggleItem = (name: string) =>
    setExpandedItems((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name],
    );

  // Close profile dropdown on outside click or Escape key
  useEffect(() => {
    if (!isProfileOpen) return;
    function handleOutside(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setIsProfileOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isProfileOpen]);

  useEffect(() => {
    function handleCommandKeys(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandOpen((open) => !open);
      }
      if (event.key === "Escape") setIsCommandOpen(false);
    }
    document.addEventListener("keydown", handleCommandKeys);
    return () => document.removeEventListener("keydown", handleCommandKeys);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("zenaipex_token");
    router.push("/login");
  };

  const openCustomerDashboardPicker = async () => {
    setIsCompanyPickerOpen(true);
    setSelectedCustomerCompanyId("");
    setIsCompanyPickerLoading(true);
    try {
      const result = await fetchApi<{
        companies?: Array<{
          id: string;
          name: string;
          slug?: string;
          owner_email?: string;
          is_active?: boolean;
          logo_url?: string;
        }>;
      }>("/admin/companies");
      setCustomerCompanies(
        (result.companies || []).filter(
          (company) =>
            company.slug !== "admin_workspace" && company.is_active !== false,
        ),
      );
    } catch {
      setCustomerCompanies([]);
    } finally {
      setIsCompanyPickerLoading(false);
    }
  };

  const viewCustomerDashboard = (company: { id: string; name: string }) => {
    sessionStorage.setItem("view_as_company_id", company.id);
    sessionStorage.setItem("view_as_company_name", company.name);
    setIsCompanyPickerOpen(false);
    router.push("/dashboard");
  };

  const pathSegments = pathname.split("/").filter((p) => p && p !== "admin");
  const breadcrumb =
    pathSegments.length > 0
      ? pathSegments[0]
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())
      : "Overview";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sage-500 border-t-transparent" />
          <p className="text-slate-500 text-sm font-medium">
            Verifying Platform Admin Access…
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg && !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-4">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Connection Error
            </h2>
            <p className="text-slate-500 text-sm mt-1">{errorMsg}</p>
          </div>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="mt-2"
          >
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm px-4">
          <ShieldAlert className="h-10 w-10 text-red-500" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Access Denied</h2>
            <p className="text-slate-500 text-sm mt-1">
              You do not have Super Admin privileges to view this area.
              Returning to dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell flex min-h-screen bg-[#F7F8F5] text-foreground font-sans">
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
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#D9E2DC] bg-[radial-gradient(circle_at_5%_0%,#F8FFF8_0%,#EEF2EA_44%,#E8EEE8_100%)] shadow-[12px_0_40px_rgba(25,55,43,0.05)] transition-all duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          "w-[260px] lg:translate-x-0",
          isSidebarOpen ? "lg:w-[260px]" : "lg:w-[80px]",
        )}
      >
        <button
          type="button"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="absolute -right-4 top-5 z-10 hidden h-8 w-8 place-items-center rounded-full border border-[#C9DED0] bg-[#FCFFFC] text-[#285A42] shadow-[0_5px_18px_rgba(23,77,53,0.18)] transition-all duration-200 hover:scale-110 hover:border-[#54A477] hover:bg-[#0C4A31] hover:text-white focus:outline-none focus:ring-4 focus:ring-[#9BD6AF]/40 lg:grid"
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </button>
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#DCE7DF]/80 px-4">
          <Link
            href="/admin"
            className="flex flex-col justify-center transition-opacity hover:opacity-80 overflow-hidden"
          >
            <div className={cn(!isSidebarOpen && "lg:hidden")}>
              <BrandLogo iconSize={32} textSize="text-lg" />
            </div>
            {!isSidebarOpen && (
              <BrandLogo iconSize={32} iconOnly className="hidden lg:flex" />
            )}
          </Link>
          <div className="flex lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-slate-500 hover:bg-slate-200/50"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-2.5 py-3 scrollbar-none">
          {navGroups.map((group, index) => (
            <div
              key={group.title}
              className={cn(
                "mb-3",
                index === navGroups.length - 1 ? "mb-0" : "",
              )}
            >
              <button
                onClick={() => toggleGroup(group.title)}
                className={cn(
                  "group mb-1 flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 transition-all duration-150 hover:bg-white/60 hover:text-[#285A42]",
                  !isSidebarOpen && "lg:opacity-0 lg:w-0 lg:hidden",
                )}
              >
                <span>{group.title}</span>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform duration-150 text-[#5F786D] group-hover:text-[#43584F]",
                    expandedGroups.includes(group.title) ? "rotate-90" : "",
                  )}
                />
              </button>

              {!isSidebarOpen && (
                <div className="hidden lg:block h-px bg-[#D9E2DC] my-4 mx-4" />
              )}

              <div
                className={cn(
                  "grid transition-all duration-200 ease-in-out",
                  expandedGroups.includes(group.title) || !isSidebarOpen
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0",
                )}
              >
                <nav className="flex flex-col gap-1 overflow-hidden">
                  {group.items.map((item) => {
                    const isActive = isItemActive(item);
                    const childActive = hasActiveChild(item);
                    if (item.children) {
                      // A current child gives the parent its active tint, but the user must
                      // still be able to close that submenu manually.
                      const isExpanded = expandedItems.includes(item.name);
                      return (
                        <div key={item.name} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleItem(item.name)}
                            title={!isSidebarOpen ? item.name : undefined}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm font-semibold transition-all duration-150",
                              childActive
                                ? "bg-[#E4F0E8] text-[#174D34]"
                                : "text-[#43584F] hover:bg-[#E8F0EC]",
                              !isSidebarOpen && "lg:justify-center lg:px-0",
                            )}
                          >
                            <item.icon className="h-5 w-5 shrink-0 text-[#5F786D]" />
                            <span
                              className={cn(
                                "flex-1 transition-all duration-300",
                                !isSidebarOpen && "lg:hidden",
                              )}
                            >
                              {item.name}
                            </span>
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-90",
                                !isSidebarOpen && "lg:hidden",
                              )}
                            />
                          </button>
                          <div
                            className={cn(
                              "grid transition-all duration-200",
                              isExpanded || !isSidebarOpen
                                ? "grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0",
                              !isSidebarOpen && "lg:hidden",
                            )}
                          >
                            <div className="ml-5 space-y-1 overflow-hidden border-l border-[#C8DDD0] pl-3">
                              {item.children.map((child) => {
                                const isChildActive = isItemActive(child);
                                return (
                                  <Link
                                    key={child.name}
                                    href={child.href}
                                    className={cn(
                                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors",
                                      isChildActive
                                        ? "bg-[#DCEEE2] text-[#17613C]"
                                        : "text-[#60796C] hover:bg-[#ECF4EE] hover:text-[#285A42]",
                                    )}
                                  >
                                    <child.icon className="h-3.5 w-3.5" />
                                    {child.name}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        title={!isSidebarOpen ? item.name : undefined}
                        className={cn(
                          "relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-150 group-link",
                          isActive
                            ? "bg-[#DCE8E2] text-sage-800 rounded-r-md rounded-l-none"
                            : "text-[#43584F] hover:bg-white/70",
                          !isSidebarOpen &&
                            "lg:justify-center lg:px-0 lg:rounded-md",
                        )}
                      >
                        {isActive && (
                          <div
                            className={cn(
                              "absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-sage-600",
                              !isSidebarOpen && "lg:hidden",
                            )}
                          />
                        )}
                        {isActive && !isSidebarOpen && (
                          <div className="hidden lg:block absolute left-1 top-1/2 -translate-y-1/2 h-1/2 w-1 rounded-full bg-sage-600" />
                        )}
                        <item.icon
                          className={cn(
                            "h-5 w-5 shrink-0 transition-colors",
                            isActive ? "text-sage-700" : "text-[#5F786D]",
                          )}
                        />
                        <span
                          className={cn(
                            "transition-all duration-300",
                            !isSidebarOpen && "lg:opacity-0 lg:w-0 lg:hidden",
                          )}
                        >
                          {item.name}
                        </span>
                        {item.name === "Live Calls" && (
                          <span
                            className={cn(
                              "ml-auto rounded-full border border-[#BDE7CB] bg-[#E8FAEF] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-[#087F5B]",
                              !isSidebarOpen && "lg:hidden",
                            )}
                          >
                            LIVE
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto border-t border-[#D9E2DC] bg-[#FAFAFA]/70 p-2">
          <div
            className={cn(
              "rounded-xl border border-[#DCE9E0] bg-white/80 p-2 shadow-[0_4px_16px_rgba(25,55,43,0.06)]",
              !isSidebarOpen &&
                "lg:flex lg:flex-col lg:items-center lg:gap-2 lg:p-2",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2.5",
                !isSidebarOpen && "lg:justify-center",
              )}
            >
              {platformHasLogo ? (
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D6E5DA] bg-white",
                    !isSidebarOpen && "lg:h-10 lg:w-10 lg:rounded-2xl",
                  )}
                >
                  <img
                    src={`${API_BASE_URL}/admin/settings/logo?t=${logoTimestamp}`}
                    alt="Platform logo"
                    className="h-full w-full object-contain p-0.5"
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E8F0EC] text-xs font-bold text-[#285A42]",
                    !isSidebarOpen && "lg:h-10 lg:w-10 lg:rounded-2xl",
                  )}
                >
                  {userProfile?.name?.charAt(0)?.toUpperCase() || "A"}
                </div>
              )}
              <div
                className={cn("min-w-0 flex-1", !isSidebarOpen && "lg:hidden")}
              >
                <span className="block truncate text-xs font-bold leading-tight text-slate-900">
                  {userProfile?.name || "Platform Admin"}
                </span>
                <span className="block text-[10px] font-medium leading-tight text-slate-500">
                  Super Admin
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={openCustomerDashboardPicker}
              title="Choose customer dashboard"
              aria-label="Choose customer dashboard"
              className={cn(
                "mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#CBE0D1] bg-[#F4FBF5] px-2 py-1 text-[11px] font-bold text-[#286044] transition hover:border-[#78B88D] hover:bg-white",
                !isSidebarOpen &&
                  "lg:mt-0 lg:h-8 lg:w-8 lg:border-[#D6E5DA] lg:bg-[#F4FBF5] lg:p-0",
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              <span className={cn(!isSidebarOpen && "lg:hidden")}>
                Customer dashboard
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex flex-1 flex-col transition-all duration-300 ease-in-out min-w-0 bg-[#F7F8F5]",
          isFocusChat
            ? "h-screen min-h-0 overflow-hidden"
            : "min-h-screen",
          isSidebarOpen ? "lg:pl-[260px]" : "lg:pl-[80px]",
        )}
      >
        {(!isFocusChat || isFocusHeaderOpen) && <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 sm:px-8 backdrop-blur-md">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-500 hover:bg-slate-100"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="leading-tight">
              <span className="block text-base font-bold tracking-tight text-[#203B30]">
                {breadcrumb === "Overview" ? "Command Center" : breadcrumb}
              </span>
              <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#789686]">
                Platform administration
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-3 text-sm text-slate-500 font-medium relative"
            ref={profileRef}
          >
            <Link
              href="/admin/system"
              className="hidden lg:flex items-center gap-2 rounded-full border border-[#CFE4D5] bg-[#F6FCF7] px-3 py-2 text-[11px] font-bold text-[#286044] transition hover:border-[#8AC7A9] hover:bg-white"
            >
              <span className="h-2 w-2 rounded-full bg-[#13B866] shadow-[0_0_0_3px_#DCF7E4]" />
              All systems healthy
            </Link>
            <button
              type="button"
              onClick={() => {
                setCommandQuery("");
                setIsCommandOpen(true);
              }}
              className="hidden md:inline-flex items-center gap-2 rounded-xl border border-[#DCE7DF] bg-white px-3.5 py-2 text-xs font-semibold text-[#52695B] shadow-sm transition-all hover:border-[#8AC7A9] hover:text-[#087F5B] hover:shadow-md"
              aria-label="Search platform sections"
            >
              <Search size={15} /> Search platform{" "}
              <kbd className="ml-2 rounded-md border border-[#E5ECE5] bg-[#F8FBF8] px-1.5 py-0.5 text-[10px]">
                Ctrl K
              </kbd>
            </button>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 transition-all hover:border-[#D7E6DA] hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-sage-400"
              aria-label="User menu"
              aria-expanded={isProfileOpen}
            >
              {platformHasLogo ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm overflow-hidden border border-slate-200">
                  <img
                    src={`${API_BASE_URL}/admin/settings/logo?t=${logoTimestamp}`}
                    alt="Logo"
                    className="w-full h-full object-contain p-0.5"
                  />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#43584F] text-sm font-bold text-white shadow-sm shrink-0">
                  {userProfile?.name?.charAt(0)?.toUpperCase() || "P"}
                </div>
              )}
              <div className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-sm font-semibold text-slate-800">
                  {userProfile?.name || "Platform Admin"}
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  Super Admin
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-slate-400 hidden sm:block transition-transform duration-150",
                  isProfileOpen && "rotate-180",
                )}
              />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-2xl border border-[#D9E7DD] bg-white shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="border-b border-[#DDEBE1] bg-[linear-gradient(135deg,#F3FBF5,#E7F4EA)] px-4 py-4">
                  <div className="flex items-center gap-3">
                    {platformHasLogo ? (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm overflow-hidden border border-slate-200">
                        <img
                          src={`${API_BASE_URL}/admin/settings/logo?t=${logoTimestamp}`}
                          alt="Logo"
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#43584F] text-sm font-bold text-white shrink-0">
                        {userProfile?.name?.charAt(0)?.toUpperCase() || "P"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {userProfile?.name || "Platform Admin"}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {userProfile?.email}
                      </p>
                      <span className="mt-1 inline-flex rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sage-600">
                        Super Admin
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-1.5">
                  <Link
                    href="/admin/settings"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-[#087F5B] hover:bg-[#F1FAF3] rounded-xl transition-colors"
                  >
                    <User className="h-4 w-4" />
                    Platform settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      openCustomerDashboardPicker();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-[#F1FAF3] hover:text-[#087F5B]"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Customer Dashboard
                  </button>
                </div>
                <div className="p-1.5 border-t border-slate-100">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>}
        <div
          className={cn(
            "mx-auto w-full",
            isFocusChat
              ? "flex min-h-0 flex-1 p-0"
              : "p-4 sm:p-6 md:p-8",
          )}
        >
          {children}
        </div>
      </main>
      {isCommandOpen && (
        <Modal
          open={isCommandOpen}
          onClose={() => setIsCommandOpen(false)}
          title="Navigate admin"
          description="Search a section to jump there quickly."
          className="max-w-lg"
          footer={
            <p className="w-full text-[11px] text-slate-500">
              Tip: Ctrl K opens this navigator from any admin section.
            </p>
          }
        >
          <div className="flex items-center gap-3 rounded-xl border border-[#DCE7DF] bg-[#F7FBF8] px-4 py-3">
            <Search size={19} className="text-[#087F5B]" />
            <input
              autoFocus
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
              placeholder="Search organization sections…"
              className="w-full bg-transparent text-sm text-[#14261F] outline-none"
            />
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {commandItems
              .filter((item) =>
                item.name.toLowerCase().includes(commandQuery.toLowerCase()),
              )
              .map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    type="button"
                    key={item.href}
                    onClick={() => {
                      router.push(item.href);
                      setIsCommandOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#203B30] hover:bg-[#EDF7EF]"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E6F6EB] text-[#087F5B]">
                      <Icon size={17} />
                    </span>
                    {item.name}
                    <ArrowLeft
                      size={14}
                      className="ml-auto rotate-180 text-[#789686]"
                    />
                  </button>
                );
              })}
            {commandItems.every(
              (item) =>
                !item.name.toLowerCase().includes(commandQuery.toLowerCase()),
            ) && (
              <p className="px-4 py-7 text-center text-sm text-slate-500">
                No section found.
              </p>
            )}
          </div>
        </Modal>
      )}
      {isCompanyPickerOpen && (
        <Modal
          open={isCompanyPickerOpen}
          onClose={() => setIsCompanyPickerOpen(false)}
          title="Choose a customer workspace"
          description="Select a company to open its customer dashboard."
          className="max-w-xl"
          footer={
            isCompanyPickerLoading ||
            customerCompanies.length === 0 ? undefined : (
              <button
                type="button"
                disabled={!selectedCustomerCompanyId}
                onClick={() => {
                  const company = customerCompanies.find(
                    (item) => item.id === selectedCustomerCompanyId,
                  );
                  if (company) viewCustomerDashboard(company);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0C4A31] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#083A27] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Open customer dashboard{" "}
                <ArrowLeft size={16} className="rotate-180" />
              </button>
            )
          }
        >
          {isCompanyPickerLoading ? (
            <div className="grid min-h-44 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#087F5B]" />
            </div>
          ) : customerCompanies.length > 0 ? (
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#315342]">
                Customer company
              </span>
              <SmartSelect
                value={selectedCustomerCompanyId}
                onChange={setSelectedCustomerCompanyId}
                placeholder="Select a customer company…"
                searchPlaceholder="Search companies…"
                options={customerCompanies.map((company) => ({
                  value: company.id,
                  label: company.name,
                  description: company.owner_email,
                  badge: company.is_active === false ? "Inactive" : "Active",
                  icon: getCompanyLogoUrl(company.id, company.logo_url) ? (
                    <img
                      src={getCompanyLogoUrl(company.id, company.logo_url)}
                      alt=""
                      className="h-7 w-7 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[10px] font-bold text-emerald-700">
                      {company.name
                        .split(/\s+/)
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  ),
                }))}
              />
            </label>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#C9DDD0] bg-white p-8 text-center text-sm text-slate-500">
              No active customer workspaces found.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
