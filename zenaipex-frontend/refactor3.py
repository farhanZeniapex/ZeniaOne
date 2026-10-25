import re

with open('app/dashboard/layout.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

new_sidebar = """        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-6 scrollbar-none">
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
                      : pathname === item.href || pathname.startsWith(item.href + "/");
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
        </div>"""

# Find the index of '<div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-6">'
start_idx = code.find('<div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-6">')
end_idx = code.find('<div className="flex shrink-0', start_idx)

if start_idx != -1 and end_idx != -1:
    code = code[:start_idx] + new_sidebar + '\n        ' + code[end_idx:]
    with open('app/dashboard/layout.tsx', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Replaced successfully")
else:
    print("Could not find blocks")
