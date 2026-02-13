"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  ShieldAlert,
  Monitor,
  TreePine,
  Loader2,
} from "lucide-react";
import { reservationService, Slot } from "@/services/reservation.service";
import {
  availabilityService,
  SlotAvailability,
} from "@/services/availability.service";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const getISTDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().split("T")[0];
};

export default function ManageBookingPage() {
  const [date, setDate] = useState<string>(getISTDate());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [availabilities, setAvailabilities] = useState<SlotAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all slots (active)
      const slotsData = await reservationService.getSlots(date, true);
      setSlots(slotsData);

      // Fetch specific date overrides
      const availData = await availabilityService.getAvailability(date);
      setAvailabilities(availData);
    } catch (error) {
      console.error("Error fetching management data:", error);
      toast.error("Failed to load availability data");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (
    slotId: number,
    field: string,
    newValue: boolean,
  ) => {
    setUpdatingId(slotId);
    try {
      const existing = availabilities.find((a) => a.slotId === slotId);

      const updateData = {
        slotId,
        date,
        isSlotDisabled:
          field === "isSlotDisabled"
            ? newValue
            : existing?.isSlotDisabled || false,
        isIndoorDisabled:
          field === "isIndoorDisabled"
            ? newValue
            : existing?.isIndoorDisabled || false,
        isOutdoorDisabled:
          field === "isOutdoorDisabled"
            ? newValue
            : existing?.isOutdoorDisabled || false,
      };

      await availabilityService.updateAvailability(updateData);

      // Refresh local state or refetch
      const updatedAvail = await availabilityService.getAvailability(date);
      setAvailabilities(updatedAvail);

      toast.success("Availability updated successfully");
    } catch (error) {
      console.error("Error updating availability:", error);
      toast.error("Failed to update availability");
    } finally {
      setUpdatingId(null);
    }
  };

  const getSlotStatus = (slotId: number) => {
    const avail = availabilities.find((a) => a.slotId === slotId);
    return (
      avail || {
        isSlotDisabled: false,
        isIndoorDisabled: false,
        isOutdoorDisabled: false,
      }
    );
  };

  const formatTo12Hour = (time: string) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":").map(Number);
    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    return `${h}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Manage Booking
          </h1>
          <p className="text-muted-foreground">
            Control slot visibility and area availability for customers.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-muted/50 p-2 sm:p-2.5 rounded-xl border border-border/50 self-center md:self-auto min-w-fit">
          <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent border-none focus-visible:ring-0 p-0 h-auto w-[140px] md:w-[160px] font-medium text-sm sm:text-base dark:[&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border border-border rounded-xl">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">
            Loading slot configurations...
          </p>
        </div>
      ) : slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border border-border rounded-xl text-center px-4">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
          <p className="text-lg font-medium">No slots defined</p>
          <p className="text-sm text-muted-foreground">
            Please configure slots in the Reservations section first.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot) => {
            const status = getSlotStatus(slot.id);
            const isUpdating = updatingId === slot.id;

            return (
              <Card
                key={slot.id}
                className={cn(
                  "transition-all duration-300 border-border/50",
                  status.isSlotDisabled
                    ? "opacity-60 bg-muted/30"
                    : "bg-card hover:shadow-md",
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          status.isSlotDisabled ? "bg-muted" : "bg-primary/10",
                        )}
                      >
                        <Clock
                          className={cn(
                            "h-4 w-4",
                            status.isSlotDisabled
                              ? "text-muted-foreground"
                              : "text-primary",
                          )}
                        />
                      </div>
                      <CardTitle className="text-lg">
                        {formatTo12Hour(slot.startTime)} -{" "}
                        {formatTo12Hour(slot.endTime)}
                      </CardTitle>
                    </div>
                    <Switch
                      checked={!status.isSlotDisabled && !slot.isAutoDisabled}
                      onCheckedChange={(checked) => {
                        if (slot.isAutoDisabled && checked) {
                          if (status.isSlotDisabled) {
                            handleToggle(slot.id, "isSlotDisabled", false);
                            toast.success(
                              "Manual hide removed. Slot will turn ON automatically once a table is free.",
                            );
                          } else {
                            toast.info(
                              "Slot is full. It will turn back ON automatically once a table is free.",
                            );
                          }
                          return;
                        }

                        handleToggle(slot.id, "isSlotDisabled", !checked);
                      }}
                      disabled={isUpdating}
                    />
                  </div>
                  <CardDescription className="flex items-center justify-between">
                    <span>
                      {slot.isAutoDisabled
                        ? "Full (Auto-Off)"
                        : status.isSlotDisabled
                          ? "Manually hidden"
                          : "Visible for online booking"}
                    </span>
                    <span className="text-xs font-semibold bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                      Occupied: {slot.reservedCount || 0} /{" "}
                      {slot.totalTables || 0}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mt-4 space-y-3 p-3 bg-muted/40 rounded-xl border border-border/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">Indoor Area</span>
                      </div>
                      <Switch
                        disabled={status.isSlotDisabled || isUpdating}
                        checked={!status.isIndoorDisabled}
                        onCheckedChange={(checked) =>
                          handleToggle(slot.id, "isIndoorDisabled", !checked)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TreePine className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Outdoor Area
                        </span>
                      </div>
                      <Switch
                        disabled={status.isSlotDisabled || isUpdating}
                        checked={!status.isOutdoorDisabled}
                        onCheckedChange={(checked) =>
                          handleToggle(slot.id, "isOutdoorDisabled", !checked)
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
