"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Armchair, CalendarCheck, Users } from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalTables: 0,
    todayBookings: 0,
    guestsExpected: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/dashboard/stats");
        setStats(res.data);
      } catch (err) {
        console.error("Failed to fetch stats", err);
      }
    };
    fetchStats();
  }, []);

  const statItems = [
    {
      label: "Total Tables",
      value: stats.totalTables.toString(),
      icon: Armchair,
      color: "text-blue-400",
    },
    {
      label: "Today's Bookings",
      value: stats.todayBookings.toString(),
      icon: CalendarCheck,
      color: "text-green-400",
    },
    {
      label: "Guests Expected",
      value: stats.guestsExpected.toString(),
      icon: Users,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white">Dashboard Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statItems.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="glass-panel border-none text-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  {stat.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-panel border-none text-white h-[300px]">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400">No recent activity.</p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-none text-white h-[300px]">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Quick action buttons can go here */}
            <p className="text-gray-400">Manage your restaurant efficiently.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
