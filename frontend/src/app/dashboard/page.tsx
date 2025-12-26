"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Armchair, CalendarCheck, Users } from "lucide-react";

export default function DashboardPage() {
  // These would be fetched from API in a real app
  const stats = [
    {
      label: "Total Tables",
      value: "12",
      icon: Armchair,
      color: "text-blue-400",
    },
    {
      label: "Today's Bookings",
      value: "8",
      icon: CalendarCheck,
      color: "text-green-400",
    },
    {
      label: "Guests Expected",
      value: "24",
      icon: Users,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-white">Dashboard Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => {
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
