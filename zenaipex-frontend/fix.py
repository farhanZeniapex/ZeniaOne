with open('components/ui/live-call-monitor.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if 'return (' in line and 'div key=' in lines[i+1]:
        start_idx = i
    if start_idx != -1 and ');' in line and i > start_idx + 10:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_content = [
        '                    return (\n',
        '                      <div key={msg.id} className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>\n',
        '                        <div className="flex flex-col max-w-[85%]">\n',
        '                          <div className={`rounded-xl p-3 shadow-sm ${msg.role === "assistant" ? "bg-white border border-gray-100 text-gray-800" : "bg-sage-600 text-white"}`}>\n',
        '                            <p className="text-[9px] font-bold mb-0.5 opacity-60 uppercase tracking-widest">\n',
        '                              {msg.role === "assistant" ? "ZeniaONE" : "CUSTOMER"}\n',
        '                            </p>\n',
        '                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content || (msg as any).text}</p>\n',
        '                          </div>\n',
        '                          {time && (\n',
        '                            <span className={`text-[9px] text-gray-400 mt-1 px-1 ${msg.role === "assistant" ? "text-left" : "text-right"}`}>\n',
        '                              {time}\n',
        '                            </span>\n',
        '                          )}\n',
        '                        </div>\n',
        '                      </div>\n',
        '                    );\n'
    ]
    lines = lines[:start_idx] + new_content + lines[end_idx+1:]
    with open('components/ui/live-call-monitor.tsx', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Replaced successfully")
else:
    print(f"Could not find indices: start={start_idx} end={end_idx}")
