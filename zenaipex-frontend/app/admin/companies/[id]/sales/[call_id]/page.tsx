"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api/client";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

export default function SalesCallDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const companyId = params.id as string;
    const callId = params.call_id as string;
    const [call, setCall] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchCall = async () => {
            try {
                const token = localStorage.getItem("zenaipex_token");
                const res = await fetch(`${API_BASE_URL}/companies/${companyId}/sales-calls`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Failed to fetch sales calls");
                const data = await res.json();
                const matched = data.find((c: any) => c.id === callId);
                if (!matched) throw new Error("Call not found");
                setCall(matched);
                
                if (matched.conversation_id) {
                    const msgRes = await fetch(`${API_BASE_URL}/companies/${companyId}/conversations/${matched.conversation_id}/messages`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (msgRes.ok) {
                        const msgData = await msgRes.json();
                        setMessages(msgData.messages || []);
                    }
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchCall();
    }, [companyId, callId]);

    if (loading) return <PageLoadingSkeleton cards={2} />;
    if (error) return <div className="p-6 text-red-500">{error}</div>;
    if (!call) return <div className="p-6">Not found</div>;

    const summary = call.call_summary || {};

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" onClick={() => router.back()}>Back</Button>
                <div>
                    <h1 className="text-2xl font-semibold text-[#1C2421]">Sales Call: {call.lead_name || "Unknown"}</h1>
                    <p className="text-sm text-gray-500">Phone: {call.phone_number}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Call Metadata</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-gray-500">Provider Call ID</div>
                            <div>{call.provider_call_id || "Mock / Pending"}</div>
                            
                            <div className="text-gray-500">Status</div>
                            <div><Badge>{call.status.replace("_", " ")}</Badge></div>
                            
                            <div className="text-gray-500">Duration</div>
                            <div>{call.duration_seconds} seconds</div>
                            
                            <div className="text-gray-500">Scheduled At</div>
                            <div>{call.scheduled_at ? new Date(call.scheduled_at).toLocaleString() : "-"}</div>
                            
                            <div className="text-gray-500">Started At</div>
                            <div>{call.started_at ? new Date(call.started_at).toLocaleString() : "-"}</div>
                            
                            <div className="text-gray-500">Ended At</div>
                            <div>{call.ended_at ? new Date(call.ended_at).toLocaleString() : "-"}</div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>AI Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!call.call_summary ? (
                            <div className="text-sm text-gray-500 italic">No summary generated yet.</div>
                        ) : (
                            <div className="space-y-4 text-sm">
                                <div>
                                    <span className="font-semibold block">Overview:</span>
                                    {summary.full_summary || "-"}
                                </div>
                                <div>
                                    <span className="font-semibold block">Customer Need:</span>
                                    {summary.customer_need || "-"}
                                </div>
                                <div>
                                    <span className="font-semibold block">Interested Products:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {summary.interested_products?.length > 0 
                                            ? summary.interested_products.map((p: string, i: number) => (
                                                <Badge key={i} variant="outline">{p}</Badge>
                                            ))
                                            : "-"}
                                    </div>
                                </div>
                                <div>
                                    <span className="font-semibold block">Qualification:</span>
                                    <Badge variant={summary.qualification_status === "qualified" ? "default" : "secondary"}>
                                        {summary.qualification_status || "unknown"}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="font-semibold block">Objections:</span>
                                    {summary.objections?.length > 0 ? (
                                        <ul className="list-disc list-inside mt-1 text-gray-700">
                                            {summary.objections.map((obj: string, i: number) => (
                                                <li key={i}>{obj}</li>
                                            ))}
                                        </ul>
                                    ) : "-"}
                                </div>
                                <div>
                                    <span className="font-semibold block">Next Action:</span>
                                    {summary.next_action || "-"}
                                </div>
                                <div>
                                    <span className="font-semibold block">Follow-up Required:</span>
                                    {summary.followup_required ? "Yes" : "No"}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Real Transcript</CardTitle>
                </CardHeader>
                <CardContent>
                    {!call.conversation_id ? (
                        <div className="text-sm text-gray-500 italic">No conversation attached to this call.</div>
                    ) : messages.length === 0 ? (
                        <div className="text-sm text-gray-500 italic">No messages recorded.</div>
                    ) : (
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 border p-4 rounded-lg bg-gray-50">
                            {messages.map((m: any, i: number) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-lg p-3 text-sm ${
                                        m.role === 'user' 
                                            ? 'bg-[#1C2421] text-white rounded-br-none' 
                                            : m.role === 'assistant'
                                                ? 'bg-white border text-gray-800 rounded-bl-none shadow-sm'
                                                : 'bg-gray-200 text-gray-600'
                                    }`}>
                                        <div className="font-semibold text-xs opacity-70 mb-1 capitalize">
                                            {m.role}
                                        </div>
                                        <div>{m.text}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
