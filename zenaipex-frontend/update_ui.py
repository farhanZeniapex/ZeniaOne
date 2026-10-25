import re

with open('app/admin/conversations/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_cards_code = re.search(r'const statCards = \[.*?\];', content, re.DOTALL).group(0)
new_cards_code = '''const statCards = [
    { label: "Total Conversations", val: conversations.length, sub: "All interactions", icon: <Sparkles className="h-5 w-5 text-fuchsia-600" />, bg: "bg-fuchsia-50", ring: "hover:ring-fuchsia-300", tab: "all" as const },
    { label: "Phone Calls", val: totalCalls, sub: "Inbound + Outbound", icon: <Phone className="h-5 w-5 text-emerald-600" />, bg: "bg-emerald-50", ring: "hover:ring-emerald-300", tab: "calls" as const },
    { label: "Web Chats", val: totalChats, sub: "Text-based sessions", icon: <MessageSquare className="h-5 w-5 text-indigo-600" />, bg: "bg-indigo-50", ring: "hover:ring-indigo-300", tab: "chat" as const },
    { label: "Voice Chats", val: totalVoice, sub: "Browser mic sessions", icon: <Mic className="h-5 w-5 text-purple-600" />, bg: "bg-purple-50", ring: "hover:ring-purple-300", tab: "voice" as const },
  ];'''

content = content.replace(old_cards_code, new_cards_code)

old_grid_code = re.search(r'{/\* ── Clickable Stats Cards ── \*/}.*?</div>', content, re.DOTALL).group(0)
new_grid_code = '''{/* ── Clickable Premium Stats Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {statCards.map((s) => (
            <button
              key={s.label}
              onClick={() => { setActiveTab(s.tab); document.getElementById("conv-table")?.scrollIntoView({ behavior: "smooth" }); }}
              className={`relative overflow-hidden text-left bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_30px_-4px_rgba(6,81,237,0.15)] transition-all duration-300 ease-out hover:-translate-y-1 ring-2 ring-transparent ${s.ring} cursor-pointer group`}
            >
              <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity ${s.bg.replace('bg-', 'bg-')}`} />
              
              <div className="relative z-10 flex items-center justify-between mb-5">
                <p className="text-[12px] font-bold uppercase tracking-widest text-slate-500">{s.label}</p>
                <div className={`h-11 w-11 rounded-xl ${s.bg} flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-inner`}>
                  {s.icon}
                </div>
              </div>
              <p className="relative z-10 text-4xl font-extrabold text-slate-900 tracking-tight">{s.val}</p>
              <p className="relative z-10 text-xs font-semibold text-slate-500 mt-2.5 flex items-center gap-1.5">
                {s.sub}
                <ArrowRight className="h-3 w-3 opacity-0 -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
              </p>
            </button>
          ))}
        </div>'''

content = content.replace(old_grid_code, new_grid_code)

with open('app/admin/conversations/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('UI updated!')
