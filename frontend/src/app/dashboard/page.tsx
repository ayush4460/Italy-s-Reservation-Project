"use client";

import React, { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { toPng } from "html-to-image";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Armchair,
  CalendarCheck,
  Users,
  Download,
  Loader2,
  TrendingUp,
  Calendar,
  Image as ImageIcon,
  XCircle,
} from "lucide-react";
import { reservationService } from "@/services/reservation.service";
import { useProfile } from "@/context/profile-context";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
  Legend,
  BarChart,
  Bar,
  LabelList,
} from "recharts";
import { WhatsAppTemplateSelector } from "@/components/chat/whatsapp-template-selector";
import { cn } from "@/lib/utils"; // Added import for cn

const getISTDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
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
  cancellationReason?: string;
  notificationType?: string;
}

const formatTemplateName = (type?: string) => {
  if (!type) return "";
  // Check for known types
  switch (type) {
    case "WEEKDAY_BRUNCH":
      return "Weekday Brunch";
    case "WEEKEND_BRUNCH":
      return "Weekend Brunch";
    case "UNLIMITED_DINNER":
      return "Unlimited Dinner";
    case "A_LA_CARTE":
      return "A La Carte";
    case "RESERVATION_CONFIRMATION":
      return "Unlimited Dinner";
    default:
      // If it looks like a code, try to make it readable
      if (type.includes("_")) {
        return type
          .split("_")
          .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
          .join(" ");
      }
      return type;
  }
};

interface DashboardStats {
  totalTables: number;
  todayBookings: number;
  guestsExpected: number;
  recentReservations: ReservationSummary[];
  cancelledReservations?: ReservationSummary[];
  bookingsChangePct?: number;
  guestsChangePct?: number;
  analyticsData: {
    date: string;
    display: string;
    count: number;
    guestCount: number;
  }[];
  slotAnalytics?: {
    timeSlot: string;
    bookings: number;
    guests: number;
  }[];
}

export default function DashboardPage() {
  // State
  const [date, setDate] = useState<string>(getISTDate());
  const [stats, setStats] = useState<DashboardStats>({
    totalTables: 0,
    todayBookings: 0,
    guestsExpected: 0,
    recentReservations: [],
    analyticsData: [],
  });

  // Chart Range State (Default 7 days)
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 6);
  const [chartStart, setChartStart] = useState<string>(
    defaultStart.toISOString().split("T")[0],
  );
  const [chartEnd, setChartEnd] = useState<string>(getISTDate());
  const [downloading, setDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<"active" | "cancelled">("active");
  const { user: profileUser } = useProfile();
  const role = profileUser?.role || null;
  const chartRef = useRef<HTMLDivElement>(null);
  const slotChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Role is now derived from profile context
  }, []);

  const fetchStats = React.useCallback(async () => {
    try {
      const res = await api.get("/dashboard/stats", {
        params: {
          date,
          chartStart,
          chartEnd,
        },
      });
      setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  }, [date, chartStart, chartEnd]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleCancelReservation = async (reservationId: number) => {
    if (role !== "ADMIN") return;

    // We can't distinguish merged vs single easily here without full object inspection,
    // but dashboard list items are single reservation summaries.
    // The previous implementation in reservations page handled merged logic.
    // Here we will just ask for reason and cancel.

    if (!confirm("Are you sure you want to cancel this reservation?")) return;

    const reason = prompt("Enter cancellation reason (optional):");
    if (reason === null) return;

    try {
      await reservationService.cancelReservation(reservationId, reason);
      fetchStats(); // Refresh data
    } catch (err) {
      console.error("Cancel failed", err);
      alert("Failed to cancel reservation");
    }
  };

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
      change: stats.bookingsChangePct,
      trendLabel: "from yesterday",
    },
    {
      label: "Guests Expected",
      value: stats.guestsExpected.toString(),
      icon: Users,
      color: "text-purple-400",
      change: stats.guestsChangePct,
      trendLabel: "from yesterday",
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

  const handleDownloadChart = async () => {
    if (!chartRef.current) return;

    try {
      const dataUrl = await toPng(chartRef.current, {
        cacheBust: true,
        backgroundColor: "#000000",
        style: {
          borderRadius: "12px",
        },
        // Force dimensions to ensure Recharts captures correctly
        width: chartRef.current.offsetWidth,
        height: chartRef.current.offsetHeight,
      });

      const link = document.createElement("a");
      link.download = `reservation-analysis-${chartStart}-to-${chartEnd}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download chart", err);
      alert("Failed to export chart. Try again.");
    }
  };

  const handleDownloadSlotChart = async () => {
    if (!slotChartRef.current) return;

    try {
      const dataUrl = await toPng(slotChartRef.current, {
        cacheBust: true,
        backgroundColor: "#000000",
        style: {
          borderRadius: "12px",
        },
        width: slotChartRef.current.offsetWidth,
        height: slotChartRef.current.offsetHeight,
      });

      const link = document.createElement("a");
      link.download = `daily-slot-analysis-${date}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download slot chart", err);
      alert("Failed to export slot chart. Try again.");
    }
  };

  return (
    <div className="pt-10 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Dashboard
        </h2>

        {/* Date Picker - Compact on mobile */}
        <div className="flex items-center space-x-1 sm:space-x-2 bg-white/10 rounded-lg p-1.5 sm:p-2 border border-white/20 w-fit">
          <CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-white text-[13px] sm:text-base focus:outline-none [&::-webkit-calendar-picker-indicator]:invert cursor-pointer w-[105px] sm:w-auto"
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
                {stat.change !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span
                      className={cn(
                        "font-bold",
                        stat.change > 0
                          ? "text-emerald-500"
                          : stat.change < 0
                            ? "text-red-500"
                            : "text-gray-400",
                      )}
                    >
                      {stat.change > 0 ? "+" : ""}
                      {stat.change}%
                    </span>{" "}
                    <span className="text-gray-500">{stat.trendLabel}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Analytics Chart Section */}
      {role === "ADMIN" && (
        <div className="mt-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-blue-400" />
              <h3 className="text-lg md:text-xl font-semibold text-white">
                Reservation Analysis
              </h3>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-2 text-xs">
              <button
                onClick={handleDownloadChart}
                title="Download Analysis as Image"
                className="flex items-center justify-center p-1.5 md:p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all shadow-lg hover:scale-105 active:scale-95 shrink-0"
              >
                <ImageIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>
              <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2 py-1.5 border border-white/20 shadow-inner w-full md:w-fit justify-between">
                <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5 text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={chartStart}
                  onChange={(e) => setChartStart(e.target.value)}
                  className="bg-transparent text-white text-[10px] md:text-sm focus:outline-none [&::-webkit-calendar-picker-indicator]:invert cursor-pointer w-[75px] md:w-[120px] p-0"
                />
                <span className="text-gray-500 font-bold text-[10px] px-0.5">
                  →
                </span>
                <input
                  type="date"
                  value={chartEnd}
                  onChange={(e) => setChartEnd(e.target.value)}
                  className="bg-transparent text-white text-[10px] md:text-sm focus:outline-none [&::-webkit-calendar-picker-indicator]:invert cursor-pointer w-[75px] md:w-[120px] p-0"
                />
              </div>
            </div>
          </div>

          <div ref={chartRef}>
            <Card className="glass-panel border-none p-2 md:p-6 overflow-hidden">
              <div className="h-[200px] md:h-[400px] w-full -ml-2 md:ml-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={stats.analyticsData}
                    margin={{ top: 20, right: 10, left: -5, bottom: 40 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#ffffff10"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#9ca3af"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                      tickFormatter={(dateStr) => {
                        const d = new Date(`${dateStr}T00:00:00.000Z`);
                        return d.getUTCDate().toString();
                      }}
                    >
                      <Label
                        value={
                          stats.analyticsData.length > 0
                            ? new Date(
                                `${stats.analyticsData[0].date}T00:00:00.000Z`,
                              ).toLocaleString("en-US", { month: "long" })
                            : "Month"
                        }
                        position="bottom"
                        offset={20}
                        fill="#9ca3af"
                        fontSize={14}
                        fontWeight="bold"
                      />
                    </XAxis>
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    >
                      <Label
                        value="Total Count"
                        angle={-90}
                        position="insideLeft"
                        offset={15}
                        style={{
                          textAnchor: "middle",
                          fill: "#9ca3af",
                          fontSize: 13,
                          fontWeight: "medium",
                        }}
                      />
                    </YAxis>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "none",
                        borderRadius: "8px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                        color: "#fff",
                      }}
                      itemStyle={{ fontSize: "13px" }}
                      cursor={{ stroke: "#ffffff20", strokeWidth: 1 }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
                    />
                    <Line
                      name="Reservations"
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        fill: "#3b82f6",
                        strokeWidth: 2,
                        stroke: "#fff",
                      }}
                      activeDot={{ r: 6 }}
                      animationDuration={1500}
                      label={{
                        position: "top",
                        fill: "#60a5fa",
                        fontSize: 10,
                        offset: 12,
                      }}
                    />
                    <Line
                      name="Total Guests"
                      type="monotone"
                      dataKey="guestCount"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        fill: "#10b981",
                        strokeWidth: 2,
                        stroke: "#fff",
                      }}
                      activeDot={{ r: 6 }}
                      animationDuration={1500}
                      label={{
                        position: "top",
                        fill: "#34d399",
                        fontSize: 10,
                        offset: 12,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="flex flex-row items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
            <h3 className="text-lg md:text-xl font-semibold text-white whitespace-nowrap truncate">
              {date === new Date().toISOString().split("T")[0]
                ? "Today's Bookings"
                : `Bookings for ${formatDate(date)}`}
            </h3>
            <div className="flex bg-white/5 p-0.5 md:p-1 rounded-lg shrink-0">
              <button
                onClick={() => setViewMode("active")}
                className={cn(
                  "px-2 py-0.5 md:px-3 md:py-1 rounded-md text-[10px] md:text-xs font-medium transition-all",
                  viewMode === "active"
                    ? "bg-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                    : "text-gray-400 hover:text-white",
                )}
              >
                Active
              </button>
              <button
                onClick={() => setViewMode("cancelled")}
                className={cn(
                  "px-2 py-0.5 md:px-3 md:py-1 rounded-md text-[10px] md:text-xs font-medium transition-all",
                  viewMode === "cancelled"
                    ? "bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                    : "text-gray-400 hover:text-white",
                )}
              >
                Cancelled
              </button>
            </div>
          </div>

          {role === "ADMIN" && viewMode === "active" && (
            <button
              onClick={handleDownloadExcel}
              disabled={downloading}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 md:px-3 md:py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[10px] md:text-sm font-medium rounded-lg md:rounded-md border border-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {downloading ? (
                <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
              ) : (
                <Download className="h-3 w-3 md:h-4 md:w-4" />
              )}
              <span className="hidden xs:inline">Download Excel</span>
              <span className="xs:hidden">Excel</span>
            </button>
          )}
        </div>

        <Card className="glass-panel border-none text-white min-h-[300px]">
          <CardContent className="p-0">
            {viewMode === "active" ? (
              /* ACTIVE BOOKINGS VIEW */
              stats.recentReservations.length === 0 ? (
                <div className="p-6 text-gray-400 text-center">
                  No bookings for today.
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {stats.recentReservations.map((res: ReservationSummary) => (
                    <div
                      key={res.id}
                      className="p-3 md:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-4 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => {
                        const dateStr = res.date
                          ? res.date.toString().split("T")[0]
                          : new Date().toISOString().split("T")[0];
                        window.location.href = `/dashboard/reservations?date=${dateStr}&slotId=${res.slotId}`;
                      }}
                    >
                      <div className="flex items-start justify-between md:justify-start gap-3 md:gap-4">
                        <div className="flex bg-blue-500/20 text-blue-300 font-bold px-2 py-1.5 md:px-3 md:py-2 rounded-lg items-center justify-center min-w-10 md:min-w-12">
                          <span className="text-base md:text-lg">
                            {res.table.tableNumber
                              .split("+")
                              .sort((a, b) => Number(a) - Number(b))
                              .join(", ")}
                          </span>
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm md:text-base">
                            {res.customerName}
                          </div>
                          <div className="text-xs md:text-sm text-gray-400">
                            {res.contact}
                          </div>
                          {role === "ADMIN" && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 flex items-center gap-2 flex-wrap"
                            >
                              <WhatsAppTemplateSelector
                                phone={res.contact}
                                onSendSuccess={fetchStats}
                                reservation={res}
                                trigger={
                                  <button className="text-[9px] md:text-[10px] bg-green-500/20 hover:bg-green-500/30 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20 transition-colors uppercase font-bold tracking-wider">
                                    WhatsApp
                                  </button>
                                }
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelReservation(res.id);
                                }}
                                className="p-0.5 hover:bg-red-500/20 rounded-md transition-all group/cancel"
                                title="Cancel Reservation"
                              >
                                <XCircle className="h-4 w-4 text-red-400/50 group-hover/cancel:text-red-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-1 items-center justify-start md:justify-center px-0 md:px-4">
                        {res.notificationType && (
                          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-0.5 md:px-3 md:py-1.5 flex items-center gap-2 md:flex-col md:gap-0">
                            <span className="text-[9px] md:text-[10px] text-purple-300 font-bold uppercase tracking-widest leading-none">
                              Package:
                            </span>
                            <span className="text-xs md:text-sm font-semibold text-purple-100 whitespace-nowrap">
                              {formatTemplateName(res.notificationType)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row md:flex-row md:items-center justify-between gap-2 md:gap-8 w-full md:w-auto border-t border-white/5 pt-2 md:border-0 md:pt-0">
                        <div className="text-left md:text-right md:max-w-[200px]">
                          <div
                            className={cn(
                              "text-[10px] md:text-xs font-medium",
                              res.foodPref === "Regular"
                                ? "text-gray-400"
                                : "text-yellow-400",
                            )}
                          >
                            Diet: {res.foodPref}
                          </div>
                          {res.specialReq && (
                            <div
                              className="text-[10px] md:text-xs text-blue-300 italic truncate"
                              title={res.specialReq}
                            >
                              &quot;{res.specialReq}&quot;
                            </div>
                          )}
                        </div>

                        <div className="text-center md:text-right min-w-[70px] md:min-w-[80px]">
                          <div className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider">
                            Time
                          </div>
                          <div className="text-xs md:text-sm font-medium">
                            {res.slot.startTime} - {res.slot.endTime}
                          </div>
                        </div>
                        <div className="text-right min-w-[70px] md:min-w-[80px]">
                          <div className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider">
                            Guests
                          </div>
                          <div className="text-xs md:text-sm font-medium">
                            {res.adults} Adults, {res.kids} Kids
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : /* CANCELLED BOOKINGS VIEW */
            !stats.cancelledReservations ||
              stats.cancelledReservations.length === 0 ? (
              <div className="p-6 text-gray-400 text-center">
                No cancelled bookings for this date.
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {stats.cancelledReservations?.map((res: ReservationSummary) => (
                  <div
                    key={res.id}
                    className="p-3 md:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-4 bg-red-500/5 hover:bg-red-500/10 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between md:justify-start gap-3 md:gap-4">
                      <div className="flex bg-red-500/20 text-red-300 font-bold px-2 py-1.5 md:px-3 md:py-2 rounded-lg items-center justify-center min-w-10 md:min-w-12 border border-red-500/20">
                        <span className="text-base md:text-lg line-through decoration-red-400/50">
                          {res.table.tableNumber
                            .split("+")
                            .sort((a, b) => Number(a) - Number(b))
                            .join(", ")}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <div className="font-semibold text-white/70 text-sm md:text-base line-through decoration-white/30">
                          {res.customerName}
                        </div>
                        <div className="text-xs md:text-sm text-gray-500">
                          {res.contact}
                        </div>
                        <div className="mt-0.5 md:mt-1">
                          <span className="text-[9px] md:text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 uppercase font-bold tracking-wider">
                            Cancelled
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row items-start justify-between md:justify-end gap-2 md:gap-8 flex-1 opacity-75 mt-1 md:mt-0 border-t border-white/5 md:border-none pt-2 md:pt-0">
                      <div className="text-left md:text-right max-w-[120px] md:max-w-[200px]">
                        <div className="text-[9px] md:text-xs text-gray-500 uppercase tracking-wider">
                          Reason
                        </div>
                        <div
                          className="text-xs md:text-sm font-medium text-gray-400 whitespace-normal break-all leading-tight"
                          title={res.cancellationReason || "Customer Cancelled"}
                        >
                          {res.cancellationReason || "Customer Cancelled"}
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="text-right min-w-[60px] md:min-w-[100px]">
                          <div className="text-[9px] md:text-xs text-gray-500 uppercase tracking-wider">
                            Time
                          </div>
                          <div className="text-xs md:text-sm font-medium text-gray-400 whitespace-nowrap">
                            {res.slot.startTime} - {res.slot.endTime}
                          </div>
                        </div>
                        <div className="text-right min-w-[60px] md:min-w-[100px]">
                          <div className="text-[9px] md:text-xs text-gray-500 uppercase tracking-wider">
                            Guests
                          </div>
                          <div className="text-xs md:text-sm font-medium text-gray-400">
                            {res.adults} Adults, {res.kids} Kids
                          </div>
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

      {/* NEW: Today's Slot Analysis */}
      {role === "ADMIN" && (
        <div className="mt-8">
          <Card className="glass-panel border-none text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg font-medium flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 md:h-5 md:w-5 text-purple-400" />
                  <span>Daily Time Slot Analysis</span>
                </div>
                <div className="flex items-center w-full md:w-auto justify-between md:justify-end gap-3 md:gap-4">
                  <div className="flex items-center gap-3 text-xs md:text-sm font-normal">
                    <div className="flex flex-col items-end">
                      <span className="text-gray-400 text-[10px] md:text-xs">
                        Bookings
                      </span>
                      <span className="text-purple-400 font-bold text-sm md:text-base">
                        {stats.todayBookings}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-gray-400 text-[10px] md:text-xs text-right">
                        Guests
                      </span>
                      <span className="text-blue-400 font-bold text-sm md:text-base">
                        {stats.guestsExpected}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadSlotChart}
                    title="Download Analysis as Image"
                    className="flex items-center justify-center p-1.5 md:p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-all shadow-lg hover:scale-105 active:scale-95 shrink-0"
                  >
                    <ImageIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </button>
                </div>
              </CardTitle>
              <p className="text-[10px] md:text-xs text-gray-500 mt-1">
                Breakdown for {formatDate(date)}
              </p>
            </CardHeader>
            <div ref={slotChartRef}>
              <CardContent className="h-[250px] md:h-[350px] p-2 md:p-6">
                {!stats.slotAnalytics || stats.slotAnalytics.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                    <CalendarCheck className="h-8 w-8 mb-2 opacity-20" />
                    <p>No slot data available</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.slotAnalytics}
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.1)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="timeSlot"
                        stroke="#9ca3af"
                        tick={{ fill: "#9ca3af", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      >
                        <Label
                          value="Time Slots"
                          offset={-5}
                          position="insideBottom"
                          fill="#6b7280"
                          fontSize={12}
                        />
                      </XAxis>
                      <YAxis
                        stroke="#9ca3af"
                        tick={{ fill: "#9ca3af", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      >
                        <Label
                          value="Count"
                          angle={-90}
                          position="insideLeft"
                          fill="#6b7280"
                          fontSize={12}
                          offset={10}
                        />
                      </YAxis>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(0,0,0,0.8)",
                          borderColor: "rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                        cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      />
                      <Legend wrapperStyle={{ paddingTop: "20px" }} />
                      <Bar
                        dataKey="bookings"
                        name="Bookings"
                        fill="#8b5cf6"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                      >
                        <LabelList
                          dataKey="bookings"
                          position="top"
                          fill="#8b5cf6"
                          fontSize={10}
                          formatter={(val: unknown) =>
                            Number(val) > 0 ? Number(val) : ""
                          }
                        />
                      </Bar>
                      <Bar
                        dataKey="guests"
                        name="Guests Expected"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                      >
                        <LabelList
                          dataKey="guests"
                          position="top"
                          fill="#3b82f6"
                          fontSize={10}
                          formatter={(val: unknown) =>
                            Number(val) > 0 ? Number(val) : ""
                          }
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
