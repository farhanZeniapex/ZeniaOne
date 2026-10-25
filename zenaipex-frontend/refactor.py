import re

with open('app/dashboard/layout.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

nav_groups_code = """const navGroups = [
  {
    title: "PLATFORM",
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { name: "AI Agents", href: "/dashboard/agents", icon: Users },
      { name: "Knowledge Base", href: "/dashboard/knowledge", icon: Book },
    ]
  },
  {
    title: "MY AI",
    items: [
      { name: "My Chat", href: "/dashboard/my-ai/chat", icon: MessageCircle },
      { name: "History", href: "/dashboard/my-ai/history", icon: History },
      { name: "My Usage", href: "/dashboard/my-ai/usage", icon: Activity },
    ]
  },
  {
    title: "WORKSPACE",
    items: [
      { name: "Channels", href: "/dashboard/channels", icon: Phone },
      { name: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
      { name: "Analytics", href: "/dashboard/analytics", icon: BarChart },
    ]
  },
  {
    title: "ACCOUNT",
    items: [
      { name: "Usage & Billing", href: "/dashboard/usage", icon: CreditCard },
      { name: "Settings", href: "/dashboard/settings", icon: Settings },
    ]
  }
];
"""

code = re.sub(r'const mainNav = \[.*?\];\s*const myAiNav = \[.*?\];\s*const workspaceNav = \[.*?\];\s*const accountNav = \[.*?\];', nav_groups_code, code, flags=re.DOTALL)

with open('app/dashboard/layout.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
