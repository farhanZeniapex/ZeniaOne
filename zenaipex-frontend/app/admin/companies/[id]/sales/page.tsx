"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL } from "@/lib/api/client";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

export default function SalesCallsPage() {
    const params = useParams();
    const companyId = params.id as string;
    const [calls, setCalls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchCalls = async () => {
            try {
                const token = localStorage.getItem("zenaipex_token");
                const res = await fetch(`${API_BASE_URL}/companies/${companyId}/sales-calls`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (!res.ok) throw new Error("Failed to fetch sales calls");
                const data = await res.json();
                setCalls(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchCalls();
    }, [companyId]);

    const getStatusColor = (status: string) => {
        switch(status) {
            case "completed": return "bg-green-100 text-green-800";
            case "in_progress": return "bg-blue-100 text-blue-800";
            case "scheduled": return "bg-yellow-100 text-yellow-800";
            case "failed": return "bg-red-100 text-red-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-[#1C2421]">Sales Calls</h1>
                <p className="text-sm text-gray-500">Monitor automated outbound sales activity.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <PageLoadingSkeleton cards={2} />
                    ) : error ? (
                        <div className="py-4 text-center text-sm text-red-500">{error}</div>
                    ) : calls.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-500">
                            No sales calls found.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Lead</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {calls.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell className="font-medium">{c.lead_name || "Unknown"}</TableCell>
                                        <TableCell>{c.phone_number}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={getStatusColor(c.status)}>
                                                {c.status.replace("_", " ")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{c.duration_seconds}s</TableCell>
                                        <TableCell>{new Date(c.created_at).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
