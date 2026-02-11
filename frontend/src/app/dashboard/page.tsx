"use client";

import React, { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { toPng } from "html-to-image";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Label as UiLabel } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/use-theme";

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
    // Add display propery locally if needed, but keeping interface consistent
  }[];
  slotAnalytics?: {
    timeSlot: string;
    bookings: number;
    guests: number;
  }[];
}

export default function DashboardPage() {
  const { theme } = useTheme();
  const [date, setDate] = useState<string>(getISTDate());
  const [stats, setStats] = useState<DashboardStats>({
    totalTables: 0,
    todayBookings: 0,
    guestsExpected: 0,
    recentReservations: [],
    analyticsData: [],
  });

  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 6);
  const [chartStart, setChartStart] = useState(
    new Date(new Date().setDate(new Date().getDate() - 7))
      .toISOString()
      .split("T")[0],
  );
  const [chartEnd, setChartEnd] = useState(getISTDate());
  const [downloading, setDownloading] = useState(false);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelingReservationId, setCancelingReservationId] = useState<
    number | null
  >(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"active" | "cancelled">("active");
  const { user: profileUser } = useProfile();
  const role = profileUser?.role || null;
  const chartRef = useRef<HTMLDivElement>(null);
  const slotChartRef = useRef<HTMLDivElement>(null);

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

  const handleCancelReservation = (reservationId: number) => {
    if (role !== "ADMIN") return;
    setCancelingReservationId(reservationId);
    setCancelReason("");
    setIsCancelModalOpen(true);
  };

  const confirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelingReservationId) return;

    setCancelLoading(true);
    try {
      await reservationService.cancelReservation(
        cancelingReservationId,
        cancelReason,
      );
      setIsCancelModalOpen(false);
      setCancelingReservationId(null);
      setCancelReason("");
      fetchStats();
    } catch (err) {
      console.error("Cancel failed", err);
      alert("Failed to cancel reservation");
    } finally {
      setCancelLoading(false);
    }
  };

  const statItems = [
    {
      label: "Total Tables",
      value: stats.totalTables.toString(),
      icon: Armchair,
      color: "text-blue-500",
    },
    {
      label: "Bookings",
      value: stats.todayBookings.toString(),
      icon: CalendarCheck,
      change: stats.bookingsChangePct,
      trendLabel: "from yesterday",
      color: "text-emerald-500",
    },
    {
      label: "Guests Expected",
      value: stats.guestsExpected.toString(),
      icon: Users,
      change: stats.guestsChangePct,
      trendLabel: "from yesterday",
      color: "text-orange-500",
    },
  ];

  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      const response = await api.get("/reservations/export", {
        params: { date },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Reservations_${date}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to download excel", err);
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
        backgroundColor: theme === "dark" ? "#000000" : "#ffffff",
        style: {
          borderRadius: "12px",
        },
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
        backgroundColor: theme === "dark" ? "#000000" : "#ffffff",
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

  // Chart Colors - B&W / Gray scale
  // Chart Colors - Colorful for both themes
  const gridColor =
    theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const axisColor = theme === "dark" ? "#9ca3af" : "#6b7280";
  // Colorful lines
  const line1Color = "#8b5cf6"; // Violet-500
  const line2Color = "#f43f5e"; // Rose-500

  return (
    <div className="pt-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Dashboard
        </h2>

        {/* Date Picker */}
        <div className="flex items-center space-x-1 sm:space-x-2 bg-muted rounded-lg p-1.5 sm:p-2 border border-border w-fit">
          <CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-foreground text-[13px] sm:text-base focus:outline-none [&::-webkit-calendar-picker-indicator]:invert-[.5] dark:[&::-webkit-calendar-picker-indicator]:invert cursor-pointer w-[105px] sm:w-auto"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {statItems.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="bg-card text-card-foreground shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className={cn("h-4 w-4", stat.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {stat.change !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span
                      className={cn(
                        "font-bold",
                        // Keep color for trend direction but muted? User said "DO NOT use random Tailwind colors".
                        // Maybe use Black/White + Icons arrows?
                        // I'll stick to simple text colors but maybe less vibrant?
                        // Or strict B&W: underline or symbols.
                        // I'll use standard success/destructuve mapped to B&W/Gray or subdued colors.
                        // User said "Success messages".
                        // Let's use simple text-foreground if we want strict.
                        // For now I will use standard semantic colors but you can change to B&W if preferred.
                        // I'll use black/white logic.
                        stat.change > 0
                          ? "text-foreground" // +
                          : stat.change < 0
                            ? "text-muted-foreground" // -
                            : "text-muted-foreground",
                      )}
                    >
                      {stat.change > 0 ? "+" : ""}
                      {stat.change}%
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {stat.trendLabel}
                    </span>
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
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-indigo-500" />
              <h3 className="text-lg md:text-xl font-semibold text-foreground">
                Reservation Analysis
              </h3>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-2 text-xs">
              <Button
                onClick={handleDownloadChart}
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-xl"
                title="Download Analysis as Image"
              >
                <ImageIcon className="h-4 w-4 text-indigo-500" />
              </Button>
              <div className="flex items-center gap-1 bg-muted rounded-xl px-2 py-1.5 border border-border shadow-inner flex-1 md:flex-none md:w-fit justify-between min-w-0">
                <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={chartStart}
                  onChange={(e) => setChartStart(e.target.value)}
                  className="bg-transparent text-foreground text-[10px] md:text-sm focus:outline-none dark:[&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:invert-[.5] cursor-pointer w-[75px] md:w-[120px] p-0"
                />
                <span className="text-muted-foreground font-bold text-[10px] px-0.5">
                  →
                </span>
                <input
                  type="date"
                  value={chartEnd}
                  onChange={(e) => setChartEnd(e.target.value)}
                  className="bg-transparent text-foreground text-[10px] md:text-sm focus:outline-none dark:[&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:invert-[.5] cursor-pointer w-[75px] md:w-[120px] p-0"
                />
              </div>
            </div>
          </div>

          <div ref={chartRef}>
            <Card className="bg-card border border-border p-2 md:p-6 overflow-hidden shadow-sm">
              <div className="h-[200px] md:h-[400px] w-full -ml-2 md:ml-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={stats.analyticsData}
                    margin={{ top: 20, right: 10, left: -5, bottom: 40 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridColor}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke={axisColor}
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
                        fill={axisColor}
                        fontSize={14}
                        fontWeight="bold"
                      />
                    </XAxis>
                    <YAxis
                      stroke={axisColor}
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
                          fill: axisColor,
                          fontSize: 13,
                          fontWeight: "medium",
                        }}
                      />
                    </YAxis>
                    <Tooltip
                      contentStyle={{
                        backgroundColor:
                          theme === "dark" ? "#171717" : "#ffffff", // neutral-900 or white
                        border: `1px solid ${theme === "dark" ? "#374151" : "#e5e7eb"}`,
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        color: theme === "dark" ? "#ffffff" : "#000000",
                      }}
                      itemStyle={{ fontSize: "13px" }}
                      cursor={{ stroke: axisColor, strokeWidth: 1 }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px", color: axisColor }}
                    />
                    <Line
                      name="Reservations"
                      type="monotone"
                      dataKey="count"
                      stroke={line1Color} // Violet
                      strokeWidth={2}
                      dot={{
                        r: 3,
                        fill: line1Color,
                        strokeWidth: 2,
                        stroke: theme === "dark" ? "#000" : "#fff",
                      }}
                      activeDot={{ r: 5 }}
                      animationDuration={1500}
                    >
                      <LabelList
                        dataKey="count"
                        position="top"
                        offset={10}
                        className="fill-foreground font-bold text-[10px]"
                        formatter={(value: unknown) =>
                          Number(value) > 0 ? Number(value) : ""
                        }
                      />
                    </Line>
                    <Line
                      name="Total Guests"
                      type="monotone"
                      dataKey="guestCount"
                      stroke={line2Color} // Rose
                      strokeWidth={2}
                      strokeDasharray="5 5" // Dotted for distinction
                      dot={{
                        r: 3,
                        fill: line2Color,
                        strokeWidth: 2,
                        stroke: theme === "dark" ? "#000" : "#fff",
                      }}
                      activeDot={{ r: 5 }}
                      animationDuration={1500}
                    >
                      <LabelList
                        dataKey="guestCount"
                        position="top"
                        offset={10}
                        className="fill-foreground font-bold text-[10px]"
                        formatter={(value: unknown) =>
                          Number(value) > 0 ? Number(value) : ""
                        }
                      />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 w-full sm:w-auto">
            <h3 className="text-lg md:text-xl font-semibold text-foreground">
              {date === new Date().toISOString().split("T")[0]
                ? "Today's Bookings"
                : `Bookings for ${formatDate(date)}`}
            </h3>
            <div className="flex bg-muted p-0.5 md:p-1 rounded-lg shrink-0 border border-border">
              <button
                onClick={() => setViewMode("active")}
                className={cn(
                  "px-3 py-1 rounded-md text-[10px] md:text-xs font-medium transition-all",
                  viewMode === "active"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Active
              </button>
              <button
                onClick={() => setViewMode("cancelled")}
                className={cn(
                  "px-3 py-1 rounded-md text-[10px] md:text-xs font-medium transition-all",
                  viewMode === "cancelled"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Cancelled
              </button>
            </div>
          </div>

          {role === "ADMIN" && viewMode === "active" && (
            <Button
              onClick={handleDownloadExcel}
              disabled={downloading}
              variant="outline"
              size="sm"
              className="h-9 w-full sm:w-auto"
            >
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4 text-green-600" />
              )}
              <span>Download Excel</span>
            </Button>
          )}
        </div>

        <Card className="bg-card text-card-foreground border border-border shadow-sm min-h-[300px]">
          <CardContent className="p-0">
            {viewMode === "active" ? (
              /* ACTIVE BOOKINGS VIEW */
              stats.recentReservations.length === 0 ? (
                <div className="p-6 text-muted-foreground text-center">
                  No bookings for today.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stats.recentReservations.map((res: ReservationSummary) => (
                    <div
                      key={res.id}
                      className="p-3 md:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        const dateStr = res.date
                          ? res.date.toString().split("T")[0]
                          : new Date().toISOString().split("T")[0];
                        window.location.href = `/dashboard/reservations?date=${dateStr}&slotId=${res.slotId}`;
                      }}
                    >
                      <div className="flex items-start justify-between md:justify-start gap-3 md:gap-4">
                        <div className="flex bg-muted text-foreground font-bold px-2 py-1.5 md:px-3 md:py-2 rounded-lg items-center justify-center min-w-10 md:min-w-12 border border-border">
                          <span className="text-base md:text-lg">
                            {res.table.tableNumber
                              .split("+")
                              .sort((a, b) => Number(a) - Number(b))
                              .join(", ")}
                          </span>
                        </div>
                        <div>
                          <div className="font-semibold text-foreground text-sm md:text-base truncate max-w-[120px] sm:max-w-none">
                            {res.customerName}
                          </div>
                          <div className="text-xs md:text-sm text-muted-foreground">
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
                                  <button className="text-[9px] md:text-[10px] bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded shadow-sm transition-colors uppercase font-bold tracking-wider">
                                    WhatsApp
                                  </button>
                                }
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelReservation(res.id);
                                }}
                                className="p-0.5 hover:bg-destructive/10 rounded-md transition-all group/cancel"
                                title="Cancel Reservation"
                                type="button"
                              >
                                <XCircle className="h-4 w-4 text-red-500 group-hover/cancel:text-red-600" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-1 items-center justify-start md:justify-center px-0 md:px-4">
                        {res.notificationType && (
                          <div className="bg-muted border border-border rounded-lg px-2 py-0.5 md:px-3 md:py-1.5 flex items-center gap-2 md:flex-col md:gap-0">
                            <span className="text-[9px] md:text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none">
                              Package:
                            </span>
                            <span className="text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">
                              {formatTemplateName(res.notificationType)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row md:flex-row md:items-center justify-between gap-2 md:gap-8 w-full md:w-auto border-t border-border pt-2 md:border-0 md:pt-0">
                        <div className="text-left md:text-right md:max-w-[200px]">
                          <div
                            className={cn(
                              "text-[10px] md:text-xs font-medium",
                              "text-muted-foreground", // Removed yellow
                            )}
                          >
                            Diet: {res.foodPref}
                          </div>
                          {res.specialReq && (
                            <div
                              className="text-[10px] md:text-xs text-foreground italic truncate"
                              title={res.specialReq}
                            >
                              &quot;{res.specialReq}&quot;
                            </div>
                          )}
                        </div>

                        <div className="text-center md:text-right min-w-[70px] md:min-w-[80px]">
                          <div className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">
                            Time
                          </div>
                          <div className="text-xs md:text-sm font-medium text-foreground">
                            {res.slot.startTime} - {res.slot.endTime}
                          </div>
                        </div>
                        <div className="text-right min-w-[70px] md:min-w-[80px]">
                          <div className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">
                            Guests
                          </div>
                          <div className="text-xs md:text-sm font-medium text-foreground">
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
              <div className="p-6 text-muted-foreground text-center">
                No cancelled bookings for this date.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.cancelledReservations?.map((res: ReservationSummary) => (
                  <div
                    key={res.id}
                    className="p-3 md:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-4 bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between md:justify-start gap-3 md:gap-4">
                      <div className="flex bg-muted text-muted-foreground font-bold px-2 py-1.5 md:px-3 md:py-2 rounded-lg items-center justify-center min-w-10 md:min-w-12 border border-border">
                        <span className="text-base md:text-lg line-through decoration-foreground/50">
                          {res.table.tableNumber
                            .split("+")
                            .sort((a, b) => Number(a) - Number(b))
                            .join(", ")}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <div className="font-semibold text-foreground/70 text-sm md:text-base line-through decoration-foreground/30">
                          {res.customerName}
                        </div>
                        <div className="text-xs md:text-sm text-muted-foreground truncate max-w-[100px] sm:max-w-none">
                          {res.contact}
                        </div>
                        <div className="mt-0.5 md:mt-1">
                          <span className="text-[9px] md:text-[10px] bg-muted text-foreground px-1.5 py-0.5 rounded border border-border uppercase font-bold tracking-wider">
                            Cancelled
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row items-start justify-between md:justify-end gap-2 md:gap-8 flex-1 opacity-75 mt-1 md:mt-0 border-t border-border md:border-none pt-2 md:pt-0">
                      <div className="text-left md:text-right max-w-[120px] md:max-w-[200px]">
                        <div className="text-[9px] md:text-xs text-muted-foreground uppercase tracking-wider">
                          Reason
                        </div>
                        <div
                          className="text-xs md:text-sm font-medium text-muted-foreground whitespace-normal break-all leading-tight"
                          title={res.cancellationReason || "Customer Cancelled"}
                        >
                          {res.cancellationReason || "Customer Cancelled"}
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="text-right min-w-[60px] md:min-w-[100px]">
                          <div className="text-[9px] md:text-xs text-muted-foreground uppercase tracking-wider">
                            Time
                          </div>
                          <div className="text-xs md:text-sm font-medium text-muted-foreground whitespace-nowrap">
                            {res.slot.startTime} - {res.slot.endTime}
                          </div>
                        </div>
                        <div className="text-right min-w-[60px] md:min-w-[100px]">
                          <div className="text-[9px] md:text-xs text-muted-foreground uppercase tracking-wider">
                            Guests
                          </div>
                          <div className="text-xs md:text-sm font-medium text-muted-foreground">
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
          <Card className="bg-card border border-border text-card-foreground shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg font-medium flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 md:h-5 md:w-5 text-pink-500" />
                  <span>Daily Time Slot Analysis</span>
                </div>
                <div className="flex items-center w-full md:w-auto justify-between md:justify-end gap-3 md:gap-4">
                  <div className="flex items-center gap-3 text-xs md:text-sm font-normal">
                    <div className="flex flex-col items-end">
                      <span className="text-muted-foreground text-[10px] md:text-xs">
                        Bookings
                      </span>
                      <span className="text-foreground font-bold text-sm md:text-base">
                        {stats.todayBookings}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-muted-foreground text-[10px] md:text-xs text-right">
                        Guests
                      </span>
                      <span className="text-foreground font-bold text-sm md:text-base">
                        {stats.guestsExpected}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={handleDownloadSlotChart}
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-xl"
                    title="Download Analysis as Image"
                  >
                    <ImageIcon className="h-4 w-4 text-pink-500" />
                  </Button>
                </div>
              </CardTitle>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
                Breakdown for {formatDate(date)}
              </p>
            </CardHeader>
            <div ref={slotChartRef}>
              <CardContent className="h-[250px] md:h-[350px] p-2 md:p-6">
                {!stats.slotAnalytics || stats.slotAnalytics.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
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
                        stroke={gridColor}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="timeSlot"
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      >
                        <Label
                          value="Time Slots"
                          offset={-5}
                          position="insideBottom"
                          fill={axisColor}
                          fontSize={12}
                        />
                      </XAxis>
                      <YAxis
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      >
                        <Label
                          value="Count"
                          angle={-90}
                          position="insideLeft"
                          fill={axisColor}
                          fontSize={12}
                          offset={10}
                        />
                      </YAxis>
                      <Tooltip
                        contentStyle={{
                          backgroundColor:
                            theme === "dark" ? "#171717" : "#ffffff",
                          borderColor: theme === "dark" ? "#374151" : "#e5e7eb",
                          borderRadius: "8px",
                          color: theme === "dark" ? "#ffffff" : "#000000",
                        }}
                        cursor={{ fill: "rgba(128,128,128,0.1)" }}
                      />
                      <Legend wrapperStyle={{ paddingTop: "20px" }} />
                      <Bar
                        dataKey="bookings"
                        name="Bookings"
                        fill={line1Color} // Black/White
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                      >
                        <LabelList
                          dataKey="bookings"
                          position="top"
                          fill={line1Color}
                          fontSize={10}
                          formatter={(val: unknown) =>
                            Number(val) > 0 ? Number(val) : ""
                          }
                        />
                      </Bar>
                      <Bar
                        dataKey="guests"
                        name="Guests Expected"
                        fill={line2Color} // Gray
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                      >
                        <LabelList
                          dataKey="guests"
                          position="top"
                          fill={line2Color}
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

      {/* Cancel Reservation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Reservation"
      >
        <form onSubmit={confirmCancel} className="space-y-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Are you sure you want to cancel this reservation? This will
              release the table immediately.
            </p>
          </div>
          <div className="space-y-2">
            <UiLabel htmlFor="cancelReason">
              Cancellation Reason (Optional)
            </UiLabel>
            <Textarea
              id="cancelReason"
              placeholder="e.g. Customer requested, No-show..."
              value={cancelReason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setCancelReason(e.target.value)
              }
              className="bg-background border-border text-foreground min-h-[80px] focus:ring-ring"
            />
          </div>
          <div className="flex justify-end pt-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCancelModalOpen(false)}
            >
              Back
            </Button>
            <Button
              type="submit"
              variant="default" // Using default (Primary) instead of destructive to maybe avoid excessive red?
              // Or use destructive but ensuring it fits B&W
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelLoading}
            >
              {cancelLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Cancellation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
