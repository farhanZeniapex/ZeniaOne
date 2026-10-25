import re

with open('app/admin/conversations/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the tabs logic
old_tabs_code = '''              {(["all", "calls", "chat", "voice", "unverified", "pending"] as const).map(tab => {
                const counts = {
                  all: allRows.length,
                  calls: totalCalls,
                  chat: totalChats,
                  voice: totalVoice,
                  unverified: totalUnverified,
                  pending: allRows.filter(c=>c.status === "active" || c.status === "calling").length
                };
                const labels: Record<string,string> = { all: "All", calls: "📞 Phone Calls", chat: "💬 Web Chats", voice: "🎙️ Voice Chats", unverified: "❔ Source Unverified", pending: "🔵 Active Sessions" };
                const tips: Record<string,string> = { all: "All stored conversations", calls: "Calls with provider Call SIDs", chat: "Identified web chat sessions", voice: "Identified mic or voice sessions", unverified: "Recovered text whose original channel is not proven", pending: "Still active sessions" };'''

new_tabs_code = '''              {(["all", "calls", "chat", "voice", "pending"] as const).map(tab => {
                const counts = {
                  all: allRows.length,
                  calls: totalCalls,
                  chat: totalChats,
                  voice: totalVoice,
                  pending: allRows.filter(c=>c.status === "active" || c.status === "calling").length
                };
                const labels: Record<string,string> = { all: "All", calls: "📞 Phone Calls", chat: "💬 Web Chats", voice: "🎙️ Voice Chats", pending: "🔵 Active Sessions" };
                const tips: Record<string,string> = { all: "All stored conversations", calls: "Phone Calls", chat: "Web Chat sessions", voice: "Mic / voice sessions", pending: "Still active sessions" };'''

content = content.replace(old_tabs_code, new_tabs_code)

with open('app/admin/conversations/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Tabs updated!')
