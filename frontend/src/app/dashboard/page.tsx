"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Armchair,
  CalendarCheck,
  Users,
  Download,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils"; // Added import for cn

const getISTDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().split("T")[0];
  return istTime.toISOString().split("T")[0];
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}-${m}-${y}`;
};

interface ReservationSummary {
  id: number;
  date: string;
  slotId: number;
  table: {
    tableNumber: string;
  };
  customerName: string;
  contact: string;
  foodPref: string;
  specialReq?: string;
  slot: {
    startTime: string;
    endTime: string;
  };
  adults: number;
  kids: number;
}

interface DashboardStats {
  totalTables: number;
  todayBookings: number;
  guestsExpected: number;
  recentReservations: ReservationSummary[];
}

export default function DashboardPage() {
  // State
  const [date, setDate] = useState<string>(getISTDate());
  const [stats, setStats] = useState<DashboardStats>({
    totalTables: 0,
    todayBookings: 0,
    guestsExpected: 0,
    recentReservations: [],
  });
  const [downloading, setDownloading] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(localStorage.getItem("role") || "STAFF");
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/dashboard/stats", { params: { date } });
        setStats(res.data);
      } catch (err) {
        console.error("Failed to fetch stats", err);
      }
    };
    fetchStats();
  }, [date]);

  const statItems = [
    {
      label: "Total Tables",
      value: stats.totalTables.toString(),
      icon: Armchair,
      color: "text-blue-400",
      // Total tables doesn't change by date usually, but we keep it
    },
    {
      label: "Bookings",
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

  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      const response = await api.get("/reservations/export", {
        params: { date },
        responseType: "blob", // Important for file download
      });

      // Create a URL for the blob
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Reservations_${date}.xlsx`); // Filename
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to download excel", err);
      // You might want to show a toast here
      alert("Failed to download excel");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">Dashboard Overview</h2>

        {/* Date Picker */}
        <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2 border border-white/20">
          <CalendarCheck className="h-5 w-5 text-gray-300" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-white focus:outline-none [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
      </div>

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

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">
            {date === new Date().toISOString().split("T")[0]
              ? "Today's Bookings"
              : `Bookings for ${formatDate(date)}`}
          </h3>
          {role === "ADMIN" && (
            <button
              onClick={handleDownloadExcel}
              disabled={downloading}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-sm font-medium rounded-md border border-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download Excel
            </button>
          )}
        </div>
        <Card className="glass-panel border-none text-white min-h-[300px]">
          <CardContent className="p-0">
            {stats.recentReservations.length === 0 ? (
              <div className="p-6 text-gray-400 text-center">
                No bookings for today.
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {stats.recentReservations.map((res: ReservationSummary) => (
                  <div
                    key={res.id}
                    className="p-4 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => {
                      const dateStr = res.date
                        ? res.date.toString().split("T")[0]
                        : new Date().toISOString().split("T")[0];
                      window.location.href = `/dashboard/reservations?date=${dateStr}&slotId=${res.slotId}`;
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex bg-blue-500/20 text-blue-300 font-bold px-3 py-2 rounded-lg items-center justify-center min-w-12">
                        <span className="text-lg">{res.table.tableNumber}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {res.customerName}
                        </div>
                        <div className="text-sm text-gray-400">
                          {res.contact}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 flex-1 justify-end">
                      <div className="text-right max-w-[200px]">
                        <div
                          className={cn(
                            "text-xs font-medium",
                            res.foodPref === "Regular"
                              ? "text-gray-400"
                              : "text-yellow-400"
                          )}
                        >
                          Diet: {res.foodPref}
                        </div>
                        {res.specialReq && (
                          <div
                            className="text-xs text-blue-300 italic truncate"
                            title={res.specialReq}
                          >
                            &quot;{res.specialReq}&quot;
                          </div>
                        )}
                      </div>

                      <div className="text-right min-w-[100px]">
                        <div className="text-xs text-gray-400 uppercase tracking-wider">
                          Time
                        </div>
                        <div className="text-sm font-medium">
                          {res.slot.startTime} - {res.slot.endTime}
                        </div>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <div className="text-xs text-gray-400 uppercase tracking-wider">
                          Guests
                        </div>
                        <div className="text-sm font-medium">
                          {res.adults} Adults, {res.kids} Kids
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
