import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, FileCheck, FileWarning, ShieldCheck, Activity, Globe, Building2 } from "lucide-react";

interface FirmViewData {
    stats: {
        total: number;
        success_rate: number;
        failed: number;
        pending_approvals: number;
    };
    recent_activity: Array<{
        id: string;
        generated_at: string;
        status: string;
        template: { name: string };
        user_id: string;
    }>;
    risk_alerts: Array<{
        template_id: string;
        template_name: string;
        reason: string;
    }>;
}

interface PlatformViewData {
    global_total: number;
    firm_health: Array<{
        firm_name: string;
        failures: number;
        variable_count: number;
        status: 'Critical' | 'Warning' | 'Healthy';
    }>;
}

interface DashboardResponse {
    role: string;
    firm_view: FirmViewData;
    platform_view: PlatformViewData | null;
}

export default function GovernanceDashboard() {
    const [data, setData] = useState<DashboardResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            const res = await fetch('/api/docs/governance/dashboard');
            if (!res.ok) throw new Error('Failed to fetch dashboard data');
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error("Failed to load governance dashboard", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8">Loading Control Tower...</div>;
    if (!data) return <div className="p-8">No data available</div>;

    return (
        <div className="p-8 space-y-12">
            
            {/* ========================================================
                LAYER 2: PLATFORM OVERSIGHT (FOUNDER VIEW)
               ======================================================== */}
            {data.platform_view && (
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <Globe className="h-8 w-8 text-indigo-600" />
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-indigo-900">Platform Oversight</h1>
                            <p className="text-muted-foreground">Global SaaS Governance Layer (Level 5)</p>
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-4">
                        <Card className="bg-indigo-50 border-indigo-100">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-indigo-700">Global Documents</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-indigo-900">{data.platform_view.global_total}</div>
                                <p className="text-xs text-indigo-600">Generated across all firms</p>
                            </CardContent>
                        </Card>

                        <Card className="col-span-3 border-indigo-100">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Tenant Health Monitoring</CardTitle>
                                <CardDescription>Identifying high-risk firms and variable explosions</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Firm Name</TableHead>
                                            <TableHead>Variable Count</TableHead>
                                            <TableHead>Recent Failures</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.platform_view.firm_health.map((firm, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-medium">{firm.firm_name}</TableCell>
                                                <TableCell>{firm.variable_count}</TableCell>
                                                <TableCell className={firm.failures > 0 ? "text-red-600 font-bold" : ""}>
                                                    {firm.failures}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={firm.status === 'Healthy' ? 'outline' : 'destructive'}>
                                                        {firm.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="border-b border-gray-200 my-8"></div>
                </div>
            )}

            {/* ========================================================
                LAYER 1: FIRM AUTONOMY (LOCAL GOVERNANCE)
               ======================================================== */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Building2 className="h-8 w-8 text-slate-700" />
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Firm Governance</h2>
                        <p className="text-muted-foreground">Local Risk Control & Audit Log</p>
                    </div>
                </div>

                {/* Overview Stats */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Generated</CardTitle>
                            <FileCheck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.firm_view.stats.total}</div>
                            <p className="text-xs text-muted-foreground">Firm lifetime count</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                            <ShieldCheck className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{data.firm_view.stats.success_rate}%</div>
                            <p className="text-xs text-muted-foreground">Operational stability</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Failed Attempts</CardTitle>
                            <FileWarning className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{data.firm_view.stats.failed}</div>
                            <p className="text-xs text-muted-foreground">Requiring investigation</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-600">{data.firm_view.stats.pending_approvals}</div>
                            <p className="text-xs text-muted-foreground">Templates awaiting review</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    {/* Recent Activity */}
                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>Recent Generation Activity</CardTitle>
                            <CardDescription>Real-time audit log of document production.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {data.firm_view.recent_activity.map((activity) => (
                                    <div key={activity.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                                        <div>
                                            <p className="font-medium">{activity.template?.name || 'Unknown Template'}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(activity.generated_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={activity.status === 'completed' ? 'default' : 'destructive'}>
                                                {activity.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Risk Alerts */}
                    <Card className="col-span-3">
                        <CardHeader>
                            <CardTitle>Risk Alerts</CardTitle>
                            <CardDescription>High-risk templates requiring attention.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {data.firm_view.risk_alerts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No high-risk templates detected.</p>
                                ) : (
                                    data.firm_view.risk_alerts.map((alert, i) => (
                                        <div key={i} className="flex items-center gap-4 border-l-4 border-red-500 pl-4 py-2 bg-red-50 rounded-r-md">
                                            <AlertCircle className="h-5 w-5 text-red-600" />
                                            <div>
                                                <p className="font-medium text-red-900">{alert.template_name || 'Unknown Template'}</p>
                                                <p className="text-xs text-red-700">{alert.reason}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
