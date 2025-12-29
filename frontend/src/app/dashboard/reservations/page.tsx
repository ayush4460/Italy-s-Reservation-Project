"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  reservationService,
  Slot,
  Table,
  Reservation,
} from "@/services/reservation.service";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  Clock,
  Armchair,
  Users,
  Calendar,
  Settings,
  ArrowLeftRight, // Correct icon name for move
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const formatTo12Hour = (time: string) => {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")} ${period}`;
};

const convert12to24 = (hour: string, minute: string, period: string) => {
  let h = parseInt(hour, 10);
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${minute}`;
};

const parseTime = (time: string) => {
  if (!time) return { hour: "12", minute: "00", period: "AM" };
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return {
    hour: hour.toString().padStart(2, "0"),
    minute: m.toString().padStart(2, "0"),
    period,
  };
};

const getISTDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().split("T")[0];
};

export default function ReservationsPage() {
  const [date, setDate] = useState<string>(getISTDate());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const [loading, setLoading] = useState(true);

  // Booking Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [bookingData, setBookingData] = useState({
    customerName: "",
    contact: "",
    adults: "",
    kids: "0",
    foodPref: "Regular",
    specialReq: "",
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [selectedMergeTables, setSelectedMergeTables] = useState<number[]>([]);
  const [isMergingMode, setIsMergingMode] = useState(false);

  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(localStorage.getItem("role") || "STAFF");
  }, []);

  // Group Booking State
  const [isGroupBookingModalOpen, setIsGroupBookingModalOpen] = useState(false);
  const [groupSelectedTables, setGroupSelectedTables] = useState<number[]>([]);
  const [groupBookingData, setGroupBookingData] = useState({
    customerName: "",
    contact: "",
    adults: "",
    kids: "0",
    foodPref: "Regular",
    specialReq: "",
  });

  // Edit Reservation State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] =
    useState<Reservation | null>(null);
  const [editFormData, setEditFormData] = useState({
    customerName: "",
    contact: "",
    adults: "",
    kids: "0",
    foodPref: "",
    specialReq: "",
  });

  // Manage Slots Modal State
  const [isManageSlotsOpen, setIsManageSlotsOpen] = useState(false);
  const [allSlots, setAllSlots] = useState<Slot[]>([]);
  const [newSlot, setNewSlot] = useState({
    startTime: "",
    endTime: "",
    days: [] as number[],
  });
  const [slotLoading, setSlotLoading] = useState(false);

  // Move Reservation State
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [movingReservation, setMovingReservation] =
    useState<Reservation | null>(null);
  const [moveTargetTable, setMoveTargetTable] = useState<Table | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);

  // Long Press State
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const [isLongPressModalOpen, setIsLongPressModalOpen] = useState(false);
  const [longPressedTable, setLongPressedTable] = useState<Table | null>(null);

  // Refactored to fetch slots first, then tables+reservations together
  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const slotsData = await reservationService.getSlots(date);
      setSlots(slotsData);

      if (slotsData.length > 0) {
        // This will trigger the useEffect below to fetch unified data
        setSelectedSlot(slotsData[0]);
      } else {
        setSelectedSlot(null);
        // Fallback: If no slots, just show empty tables (old method)
        const tablesData = await reservationService.getTables();
        setTables(tablesData);
        setReservations([]);
        setLoading(false); // Manually set loading false here as useEffect won't run
      }
    } catch (err) {
      console.error("Failed to load initial data", err);
      setLoading(false);
    }
  }, [date]);

  // Unified fetcher for Tables + Reservations
  const fetchTableData = useCallback(async () => {
    if (!selectedSlot) return;
    try {
      // Don't set global loading here to avoid full page spinner flicker if just switching slots?
      // User wants "load together". If we don't show spinner, user sees old state.
      // Better to show spinner or overlay.
      // But we have 'loading' state which hides everything?
      // Existing 'loading' state hides the whole page.
      // Let's use it for likely first load, but for slot switching maybe just opacity?
      // For now, let's keep it simple.

      const data = await reservationService.getTablesWithAvailability(
        date,
        selectedSlot.id
      );
      setTables(data.tables);
      setReservations(data.reservations);
    } catch (err) {
      console.error("Failed to fetch table data", err);
      // Fallback
      setTables([]);
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [date, selectedSlot]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]); // Refetch slots when date changes to get day-specific slots

  useEffect(() => {
    if (selectedSlot && date) {
      fetchTableData();
    }
  }, [fetchTableData, selectedSlot, date]);

  const handleTableClick = (table: Table) => {
    if (role === "STAFF") return; // Read-only for staff
    if (!selectedSlot) return alert("Please select a time slot first.");

    // Check if booked
    const reservation = reservations.find((r) => r.tableId === table.id);

    if (reservation) {
      // Open Edit Modal
      setEditingReservation(reservation);
      setEditFormData({
        customerName: reservation.customerName,
        contact: reservation.contact,
        adults: reservation.adults.toString(),
        kids: reservation.kids.toString(),
        foodPref: reservation.foodPref,
        specialReq: reservation.specialReq || "",
      });
      setIsEditModalOpen(true);
    } else {
      // Open Create Modal
      setSelectedTable(table);
      setBookingData((prev) => ({
        ...prev,
        adults: table.capacity.toString(),
      }));
      // Reset merge
      setSelectedMergeTables([]);
      setIsMergingMode(false); // Reset mode
      setIsBookingModalOpen(true);
    }
  };

  const toggleMergeTable = (table: Table) => {
    setSelectedMergeTables((prev) => {
      if (prev.includes(table.id)) {
        // Remove
        const newSelection = prev.filter((id) => id !== table.id);
        if (newSelection.length === 0) setIsMergingMode(false);
        return newSelection;
      } else {
        // Add
        return [...prev, table.id];
      }
    });
  };

  // Derive mergeOptions from selected IDs
  const mergeOptions = tables.filter((t) => selectedMergeTables.includes(t.id));

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !selectedSlot) return;

    setBookingLoading(true);
    try {
      await reservationService.createReservation({
        tableId: selectedTable.id,
        slotId: selectedSlot.id,
        date,
        ...bookingData,
        mergeTableIds:
          selectedMergeTables.length > 0 ? selectedMergeTables : undefined,
      });
      setIsBookingModalOpen(false);
      setBookingData({
        customerName: "",
        contact: "",
        adults: "",
        kids: "0",
        foodPref: "Regular",
        specialReq: "",
      });
      fetchTableData();
    } catch (err) {
      console.error("Booking failed", err);
      alert("Failed to create reservation");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReservation) return;

    setBookingLoading(true);
    try {
      await reservationService.updateReservation(
        editingReservation.id,
        editFormData
      );
      setIsEditModalOpen(false);
      setEditingReservation(null);
      fetchTableData();
    } catch (err) {
      console.error("Update failed", err);
      alert("Failed to update reservation");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelReservation = async () => {
    if (
      !editingReservation ||
      !confirm("Are you sure you want to cancel this reservation?")
    )
      return;

    setBookingLoading(true); // Reuse loading state
    try {
      await reservationService.cancelReservation(editingReservation.id);
      setIsEditModalOpen(false);
      setEditingReservation(null);
      fetchTableData();
    } catch (err) {
      console.error("Cancel failed", err);
      alert("Failed to cancel reservation");
    } finally {
      setBookingLoading(false);
    }
  };

  // --- Move Reservation Logic ---

  const handleMoveClick = (reservation: Reservation, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent opening table details
    setMovingReservation(reservation);
    setMoveTargetTable(null);
    setIsMoveModalOpen(true);
    setIsLongPressModalOpen(false); // Close long press modal if open
  };

  const handleMoveSubmit = async () => {
    if (!movingReservation || !moveTargetTable) return;

    setMoveLoading(true);
    try {
      await reservationService.moveReservation(
        movingReservation.id,
        moveTargetTable.id
      );
      setIsMoveModalOpen(false);
      setMovingReservation(null);
      setMoveTargetTable(null);
      fetchTableData();
    } catch (err) {
      console.error("Move failed", err);
      alert("Failed to move reservation. Target might be taken.");
    } finally {
      setMoveLoading(false);
    }
  };

  // --- Long Press Logic (Mobile) ---
  const handleTouchStart = (table: Table) => {
    if (role === "STAFF") return;
    const timer = setTimeout(() => {
      // Trigger long press
      const reservation = reservations.find((r) => r.tableId === table.id);
      if (reservation) {
        setLongPressedTable(table);
        setMovingReservation(reservation);
        setIsLongPressModalOpen(true);
      }
    }, 800); // 800ms for long press
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // --- Group Booking Logic ---

  const handleGroupTableToggle = (tableId: number) => {
    setGroupSelectedTables((prev) =>
      prev.includes(tableId)
        ? prev.filter((id) => id !== tableId)
        : [...prev, tableId]
    );
  };

  const handleGroupBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || groupSelectedTables.length === 0) return;

    // First table is the "main" one, others are merged
    const [mainTableId, ...mergeTableIds] = groupSelectedTables;

    setBookingLoading(true);
    try {
      await reservationService.createReservation({
        tableId: mainTableId,
        slotId: selectedSlot.id,
        date,
        ...groupBookingData,
        mergeTableIds: mergeTableIds.length > 0 ? mergeTableIds : undefined,
      });
      setIsGroupBookingModalOpen(false);
      setGroupBookingData({
        customerName: "",
        contact: "",
        adults: "",
        kids: "0",
        foodPref: "Regular",
        specialReq: "",
      });
      setGroupSelectedTables([]);
      fetchTableData();
    } catch (err) {
      console.error("Group booking failed", err);
      alert("Failed to create group booking");
    } finally {
      setBookingLoading(false);
    }
  };

  // --- Manage Slots Logic ---

  const openManageSlots = async () => {
    setIsManageSlotsOpen(true);
    fetchAllSlots();
  };

  const fetchAllSlots = async () => {
    try {
      const data = await reservationService.getAllSlots();
      setAllSlots(data);
    } catch (err) {
      console.error("Failed to fetch all slots", err);
    }
  };

  const toggleDay = (dayIndex: number) => {
    setNewSlot((prev) => {
      const days = prev.days.includes(dayIndex)
        ? prev.days.filter((d) => d !== dayIndex)
        : [...prev.days, dayIndex];
      return { ...prev, days };
    });
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlotLoading(true);
    try {
      await reservationService.createSlot(newSlot);
      setNewSlot({ startTime: "", endTime: "", days: [] });
      fetchAllSlots();
      fetchInitialData(); // Refresh main view if affected
    } catch (err) {
      console.error("Failed to add slot", err);
      alert("Failed to add slot");
    } finally {
      setSlotLoading(false);
    }
  };

  const handleDeleteSlot = async (id: number) => {
    if (!confirm("Are you sure you want to delete this slot?")) return;
    try {
      await reservationService.deleteSlot(id);
      fetchAllSlots();
      fetchInitialData();
    } catch (err) {
      console.error("Failed to delete slot", err);
    }
  };

  // Capacity Validation Logic
  const totalGuests =
    (parseInt(bookingData.adults) || 0) + (parseInt(bookingData.kids) || 0);
  const totalCapacity =
    (selectedTable?.capacity || 0) +
    mergeOptions.reduce((acc, t) => acc + t.capacity, 0);
  const isCapacityExceeded = totalGuests > totalCapacity;

  if (loading)
    return <div className="text-white">Loading reservation system...</div>;

  return (
    <div className="pt-4 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-4 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Reservations
            </h2>
            {role === "ADMIN" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => {
                    if (!selectedSlot)
                      return alert("Please select a time slot first");
                    setIsGroupBookingModalOpen(true);
                  }}
                  size="sm"
                  className="glass-button text-[11px] sm:text-xs gap-2 bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/50 text-purple-200 h-8 sm:h-9"
                >
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Group Booking
                </Button>
                <Button
                  onClick={openManageSlots}
                  size="sm"
                  variant="outline"
                  className="glass-button text-[11px] sm:text-xs gap-2 h-8 sm:h-9 border-white/20"
                >
                  <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Manage
                  Slots
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Date Picker */}
        <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-1.5 sm:p-2 border border-white/20 w-fit shrink-0">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-white text-sm sm:text-base focus:outline-none [&::-webkit-calendar-picker-indicator]:invert cursor-pointer w-[110px] sm:w-auto"
          />
        </div>
      </div>

      {/* Slots Selection */}
      <div className="flex overflow-x-auto pb-2 gap-3 no-scrollbar min-h-[50px]">
        {slots.length === 0 && (
          <div className="text-gray-400 text-sm py-2">
            No slots available for this day.
          </div>
        )}
        {slots.map((slot) => (
          <button
            key={slot.id}
            onClick={() => setSelectedSlot(slot)}
            className={cn(
              "flex items-center space-x-2 px-4 py-2 rounded-full border transition-all whitespace-nowrap",
              selectedSlot?.id === slot.id
                ? "bg-blue-500/20 border-blue-400 text-blue-300"
                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
            )}
          >
            <Clock className="h-4 w-4" />
            <span>
              {formatTo12Hour(slot.startTime)} - {formatTo12Hour(slot.endTime)}
            </span>
          </button>
        ))}
      </div>

      {/* Tables Grid */}
      <Card className="glass-panel border-none text-white min-h-[500px]">
        <CardHeader>
          <CardTitle>
            Tables for {date.split("-").reverse().join("-")} (
            {selectedSlot
              ? `${formatTo12Hour(selectedSlot.startTime)} - ${formatTo12Hour(
                  selectedSlot.endTime
                )}`
              : "Select Slot"}
            )
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {tables.map((table) => {
              const reservation = reservations.find(
                (r) => r.tableId === table.id
              );
              const isBooked = !!reservation;

              return (
                <div
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  onTouchStart={() => handleTouchStart(table)}
                  onTouchEnd={handleTouchEnd}
                  // Prevent default context menu on mobile long press
                  onContextMenu={(e) => isBooked && e.preventDefault()}
                  className={cn(
                    "relative aspect-square rounded-xl flex flex-col items-center justify-center p-4 border-2 transition-all cursor-pointer shadow-lg group select-none",
                    isBooked
                      ? "bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30"
                      : "bg-green-500/20 border-green-500/50 text-green-300 hover:bg-green-500/30"
                  )}
                >
                  <Armchair className="h-8 w-8 mb-2" />
                  <span className="font-bold text-xl">{table.tableNumber}</span>
                  <div className="flex items-center text-xs mt-1 opacity-70">
                    <Users className="h-3 w-3 mr-1" />
                    {table.capacity}
                  </div>
                  {isBooked && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                  {isBooked && (
                    <div className="absolute bottom-2 text-xs font-semibold truncate max-w-[90%]">
                      {reservation.customerName}
                      {reservation.groupId && (
                        <span className="text-[10px] ml-1 opacity-70">
                          (Merged)
                        </span>
                      )}
                    </div>
                  )}
                  {/* Desktop Move Icon */}
                  {role === "ADMIN" && isBooked && (
                    <div
                      className="absolute top-2 right-2 hidden group-hover:block z-10 p-1 bg-white/10 rounded-full hover:bg-white/20 transition-all"
                      onClick={(e) => handleMoveClick(reservation, e)}
                    >
                      <ArrowLeftRight className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {tables.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              No tables found. Please add tables in the Tables section first.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Booking Modal */}
      <Modal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        title={`Book Table ${selectedTable?.tableNumber}`}
      >
        <form
          onSubmit={handleBookingSubmit}
          className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"
        >
          {/* ... existing form fields ... */}
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name</Label>
            <Input
              id="customerName"
              value={bookingData.customerName}
              onChange={(e) =>
                setBookingData({ ...bookingData, customerName: e.target.value })
              }
              required
              className="glass-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact">Contact Number</Label>
            <Input
              id="contact"
              value={bookingData.contact}
              onChange={(e) =>
                setBookingData({ ...bookingData, contact: e.target.value })
              }
              required
              className="glass-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adults">Adults</Label>
              <Input
                type="number"
                value={bookingData.adults}
                onChange={(e) =>
                  setBookingData({ ...bookingData, adults: e.target.value })
                }
                className="glass-input"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kids">Kids</Label>
              <Input
                type="number"
                value={bookingData.kids}
                onChange={(e) =>
                  setBookingData({ ...bookingData, kids: e.target.value })
                }
                className="glass-input"
              />
            </div>
          </div>

          {/* Merge Logic UI */}
          {selectedTable &&
            (() => {
              const total =
                (parseInt(bookingData.adults) || 0) +
                (parseInt(bookingData.kids) || 0);
              if (total > selectedTable.capacity) {
                return (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users
                          className={cn(
                            "h-4 w-4",
                            totalCapacity >= totalGuests
                              ? "text-green-400"
                              : "text-red-400"
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm font-medium",
                            totalCapacity >= totalGuests
                              ? "text-green-400"
                              : "text-red-400"
                          )}
                        >
                          {totalCapacity >= totalGuests
                            ? "Capacity Met"
                            : `Need ${totalGuests - totalCapacity} more seats`}
                        </span>
                      </div>
                      <span className="text-xs text-white/50">
                        {totalCapacity} / {totalGuests} Guests
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                        Add Nearby Tables
                      </p>
                      <div className="grid grid-cols-4 gap-2 max-h-[120px] overflow-y-auto pr-1">
                        {tables
                          .filter((t) => {
                            if (t.id === selectedTable.id) return false;
                            return !reservations.some(
                              (r) => r.tableId === t.id
                            );
                          })
                          .sort((a, b) => b.capacity - a.capacity) // Sort by capacity desc
                          .map((t) => {
                            const isSelected = selectedMergeTables.includes(
                              t.id
                            );
                            return (
                              <div
                                key={t.id}
                                onClick={() => toggleMergeTable(t)}
                                className={cn(
                                  "py-1.5 px-1 rounded text-center cursor-pointer transition-all border",
                                  isSelected
                                    ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                                    : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:border-white/20"
                                )}
                              >
                                <div className="text-xs font-bold">
                                  T{t.tableNumber}
                                </div>
                                <div className="text-[10px] opacity-70">
                                  +{t.capacity}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                );
              } else {
                // Reset if no longer needed (e.g. user decreased guests)
                if (isMergingMode) setIsMergingMode(false);
              }
              return null;
            })()}
          <div className="space-y-2">
            <Label htmlFor="foodPref">Food Preference</Label>
            <select
              id="foodPref"
              value={bookingData.foodPref}
              onChange={(e) =>
                setBookingData({ ...bookingData, foodPref: e.target.value })
              }
              className="glass-input w-full bg-slate-900 border border-white/10 rounded-md p-2 text-white"
            >
              <option className="bg-slate-900 text-white" value="Regular">
                Regular
              </option>
              <option className="bg-slate-900 text-white" value="Jain">
                Jain
              </option>
              <option className="bg-slate-900 text-white" value="Swaminarayan">
                Swaminarayan
              </option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialReq">Special Requirements</Label>
            <Input
              value={bookingData.specialReq}
              onChange={(e) =>
                setBookingData({ ...bookingData, specialReq: e.target.value })
              }
              className="glass-input"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              className="glass-button w-full"
              disabled={bookingLoading || isCapacityExceeded}
            >
              {bookingLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm Booking
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Reservation Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Reservation"
      >
        <form
          onSubmit={handleEditSubmit}
          className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"
        >
          <div className="space-y-2">
            <Label>Customer Name</Label>
            <Input
              value={editFormData.customerName}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  customerName: e.target.value,
                })
              }
              required
              className="glass-input"
            />
          </div>
          <div className="space-y-2">
            <Label>Contact</Label>
            <Input
              value={editFormData.contact}
              onChange={(e) =>
                setEditFormData({ ...editFormData, contact: e.target.value })
              }
              required
              className="glass-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Adults</Label>
              <Input
                type="number"
                value={editFormData.adults}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, adults: e.target.value })
                }
                required
                className="glass-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Kids</Label>
              <Input
                type="number"
                value={editFormData.kids}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, kids: e.target.value })
                }
                className="glass-input"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Food Preference</Label>
            <select
              value={editFormData.foodPref}
              onChange={(e) =>
                setEditFormData({ ...editFormData, foodPref: e.target.value })
              }
              className="glass-input w-full bg-slate-900 border border-white/10 rounded-md p-2 text-white"
            >
              <option className="bg-slate-900 text-white" value="Regular">
                Regular
              </option>
              <option className="bg-slate-900 text-white" value="Jain">
                Jain
              </option>
              <option className="bg-slate-900 text-white" value="Swaminarayan">
                Swaminarayan
              </option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Special Requests</Label>
            <Input
              value={editFormData.specialReq}
              onChange={(e) =>
                setEditFormData({ ...editFormData, specialReq: e.target.value })
              }
              className="glass-input"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="destructive"
              className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30"
              onClick={handleCancelReservation}
              disabled={bookingLoading}
            >
              {bookingLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Cancel Reservation
            </Button>
            <Button
              type="submit"
              className="glass-button flex-1"
              disabled={bookingLoading}
            >
              {bookingLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Slots Modal */}
      <Modal
        isOpen={isManageSlotsOpen}
        onClose={() => setIsManageSlotsOpen(false)}
        title="Manage Reservation Slots"
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          {/* Add New Slot */}
          <div className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-4">
            <h3 className="font-semibold text-lg">Add New Slot</h3>
            <form onSubmit={handleAddSlot} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <div className="flex gap-2">
                    <select
                      className="glass-input w-full bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-sm text-white"
                      value={parseTime(newSlot.startTime).hour}
                      onChange={(e) => {
                        const current = parseTime(newSlot.startTime);
                        setNewSlot({
                          ...newSlot,
                          startTime: convert12to24(
                            e.target.value,
                            current.minute,
                            current.period
                          ),
                        });
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option
                          key={h}
                          value={h.toString().padStart(2, "0")}
                          className="bg-slate-900"
                        >
                          {h.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <select
                      className="glass-input w-full bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-sm text-white"
                      value={parseTime(newSlot.startTime).minute}
                      onChange={(e) => {
                        const current = parseTime(newSlot.startTime);
                        setNewSlot({
                          ...newSlot,
                          startTime: convert12to24(
                            current.hour,
                            e.target.value,
                            current.period
                          ),
                        });
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                        <option
                          key={m}
                          value={m.toString().padStart(2, "0")}
                          className="bg-slate-900"
                        >
                          {m.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <select
                      className="glass-input w-full bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-sm text-white"
                      value={parseTime(newSlot.startTime).period}
                      onChange={(e) => {
                        const current = parseTime(newSlot.startTime);
                        setNewSlot({
                          ...newSlot,
                          startTime: convert12to24(
                            current.hour,
                            current.minute,
                            e.target.value
                          ),
                        });
                      }}
                    >
                      <option value="AM" className="bg-slate-900">
                        AM
                      </option>
                      <option value="PM" className="bg-slate-900">
                        PM
                      </option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <div className="flex gap-2">
                    <select
                      className="glass-input w-full bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-sm text-white"
                      value={parseTime(newSlot.endTime).hour}
                      onChange={(e) => {
                        const current = parseTime(newSlot.endTime);
                        setNewSlot({
                          ...newSlot,
                          endTime: convert12to24(
                            e.target.value,
                            current.minute,
                            current.period
                          ),
                        });
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option
                          key={h}
                          value={h.toString().padStart(2, "0")}
                          className="bg-slate-900"
                        >
                          {h.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <select
                      className="glass-input w-full bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-sm text-white"
                      value={parseTime(newSlot.endTime).minute}
                      onChange={(e) => {
                        const current = parseTime(newSlot.endTime);
                        setNewSlot({
                          ...newSlot,
                          endTime: convert12to24(
                            current.hour,
                            e.target.value,
                            current.period
                          ),
                        });
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                        <option
                          key={m}
                          value={m.toString().padStart(2, "0")}
                          className="bg-slate-900"
                        >
                          {m.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <select
                      className="glass-input w-full bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-sm text-white"
                      value={parseTime(newSlot.endTime).period}
                      onChange={(e) => {
                        const current = parseTime(newSlot.endTime);
                        setNewSlot({
                          ...newSlot,
                          endTime: convert12to24(
                            current.hour,
                            current.minute,
                            e.target.value
                          ),
                        });
                      }}
                    >
                      <option value="AM" className="bg-slate-900">
                        AM
                      </option>
                      <option value="PM" className="bg-slate-900">
                        PM
                      </option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Repeat for Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day, idx) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={cn(
                        "px-3 py-1 text-xs rounded-full border transition-all",
                        newSlot.days.includes(idx)
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-transparent text-gray-400 border-white/20 hover:bg-white/10"
                      )}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setNewSlot((prev) => ({
                      ...prev,
                      days: [0, 1, 2, 3, 4, 5, 6],
                    }))
                  }
                  className="text-xs text-blue-300 h-auto p-0 hover:bg-transparent hover:text-blue-200"
                >
                  Select All Days
                </Button>
              </div>
              <Button
                type="submit"
                className="w-full glass-button"
                disabled={slotLoading}
              >
                {slotLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Slot
              </Button>
            </form>
          </div>

          {/* Existing Slots List */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Existing Slots</h3>
            <div className="space-y-2">
              {allSlots.length === 0 && (
                <p className="text-gray-400 text-sm">No slots configured.</p>
              )}
              {/* Group slots by day? Or just list? Let's group for readability */}
              {DAYS.map((day, dayIdx) => {
                const daySlots = allSlots.filter((s) => s.dayOfWeek === dayIdx);
                if (daySlots.length === 0) return null;
                return (
                  <div key={day} className="space-y-1">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-2 mb-1">
                      {day}
                    </h4>
                    {daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between bg-white/5 p-2 rounded-md border border-white/5"
                      >
                        <span className="text-sm">
                          {formatTo12Hour(slot.startTime)} -{" "}
                          {formatTo12Hour(slot.endTime)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          onClick={() => handleDeleteSlot(slot.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Group Booking Modal */}
      <Modal
        isOpen={isGroupBookingModalOpen}
        onClose={() => setIsGroupBookingModalOpen(false)}
        title="Group Booking"
      >
        <form
          onSubmit={handleGroupBookingSubmit}
          className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"
        >
          <div className="space-y-2">
            <Label>Customer Name</Label>
            <Input
              value={groupBookingData.customerName}
              onChange={(e) =>
                setGroupBookingData({
                  ...groupBookingData,
                  customerName: e.target.value,
                })
              }
              required
              className="glass-input"
            />
          </div>
          <div className="space-y-2">
            <Label>Contact Number</Label>
            <Input
              value={groupBookingData.contact}
              onChange={(e) =>
                setGroupBookingData({
                  ...groupBookingData,
                  contact: e.target.value,
                })
              }
              required
              className="glass-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Adults</Label>
              <Input
                type="number"
                value={groupBookingData.adults}
                onChange={(e) =>
                  setGroupBookingData({
                    ...groupBookingData,
                    adults: e.target.value,
                  })
                }
                required
                className="glass-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Kids</Label>
              <Input
                type="number"
                value={groupBookingData.kids}
                onChange={(e) =>
                  setGroupBookingData({
                    ...groupBookingData,
                    kids: e.target.value,
                  })
                }
                className="glass-input"
              />
            </div>
          </div>

          {/* Table Selection */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
            {(() => {
              const totalGuests =
                (parseInt(groupBookingData.adults) || 0) +
                (parseInt(groupBookingData.kids) || 0);

              const selectedTablesList = tables.filter((t) =>
                groupSelectedTables.includes(t.id)
              );
              const totalCapacity = selectedTablesList.reduce(
                (acc, t) => acc + t.capacity,
                0
              );

              return (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users
                        className={cn(
                          "h-4 w-4",
                          totalCapacity >= totalGuests && totalGuests > 0
                            ? "text-green-400"
                            : "text-red-400"
                        )}
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          totalCapacity >= totalGuests && totalGuests > 0
                            ? "text-green-400"
                            : "text-red-400"
                        )}
                      >
                        {totalCapacity >= totalGuests && totalGuests > 0
                          ? "Capacity Met"
                          : `Need ${totalGuests - totalCapacity} more seats`}
                      </span>
                    </div>
                    <span className="text-xs text-white/50">
                      {totalCapacity} / {totalGuests} Guests
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                      Select Tables ({groupSelectedTables.length})
                    </p>
                    <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto pr-1">
                      {tables
                        .filter(
                          (t) => !reservations.some((r) => r.tableId === t.id)
                        )
                        .sort((a, b) => b.capacity - a.capacity)
                        .map((t) => {
                          const isSelected = groupSelectedTables.includes(t.id);
                          return (
                            <div
                              key={t.id}
                              onClick={() => handleGroupTableToggle(t.id)}
                              className={cn(
                                "py-2 px-1 rounded text-center cursor-pointer transition-all border",
                                isSelected
                                  ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                                  : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:border-white/20"
                              )}
                            >
                              <div className="text-xs font-bold">
                                T{t.tableNumber}
                              </div>
                              <div className="text-[10px] opacity-70">
                                cap: {t.capacity}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 italic pt-1">
                    * Select multiple tables to accommodate the group.
                  </div>
                </>
              );
            })()}
          </div>

          <div className="space-y-2">
            <Label>Food Preference</Label>
            <select
              value={groupBookingData.foodPref}
              onChange={(e) =>
                setGroupBookingData({
                  ...groupBookingData,
                  foodPref: e.target.value,
                })
              }
              className="glass-input w-full bg-slate-900 border border-white/10 rounded-md p-2 text-white"
            >
              <option className="bg-slate-900 text-white" value="Regular">
                Regular
              </option>
              <option className="bg-slate-900 text-white" value="Jain">
                Jain
              </option>
              <option className="bg-slate-900 text-white" value="Swaminarayan">
                Swaminarayan
              </option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Special Requirements</Label>
            <Input
              value={groupBookingData.specialReq}
              onChange={(e) =>
                setGroupBookingData({
                  ...groupBookingData,
                  specialReq: e.target.value,
                })
              }
              className="glass-input"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              className="glass-button w-full bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/50"
              disabled={
                bookingLoading ||
                groupSelectedTables.length === 0 ||
                (() => {
                  const totalGuests =
                    (parseInt(groupBookingData.adults) || 0) +
                    (parseInt(groupBookingData.kids) || 0);
                  const totalCapacity = tables
                    .filter((t) => groupSelectedTables.includes(t.id))
                    .reduce((acc, t) => acc + t.capacity, 0);
                  return totalGuests > totalCapacity;
                })()
              }
            >
              {bookingLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm Group Booking
            </Button>
          </div>
        </form>
      </Modal>
      {/* Move Reservation Modal */}
      <Modal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        title="Move Reservation"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Moving reservation for{" "}
            <span className="text-white font-bold">
              {movingReservation?.customerName}
            </span>{" "}
            from current table. Select a new table below:
          </p>

          <div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto p-1">
            {tables
              .filter(
                (t) => !reservations.find((r) => r.tableId === t.id) // Only available tables (simplified check)
              )
              .map((table) => (
                <button
                  key={table.id}
                  onClick={() => setMoveTargetTable(table)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
                    moveTargetTable?.id === table.id
                      ? "bg-blue-500/20 border-blue-400 text-blue-300"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                  )}
                >
                  <Armchair className="h-6 w-6 mb-1" />
                  <span className="font-bold">{table.tableNumber}</span>
                  <span className="text-xs opacity-70">
                    Cap: {table.capacity}
                  </span>
                </button>
              ))}
            {tables.filter((t) => !reservations.find((r) => r.tableId === t.id))
              .length === 0 && (
              <div className="col-span-3 text-center text-gray-500 py-4">
                No available tables for this slot.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button
              className="glass-button w-full"
              disabled={!moveTargetTable || moveLoading}
              onClick={handleMoveSubmit}
            >
              {moveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Move to {moveTargetTable?.tableNumber}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Long Press Action Modal (Mobile) */}
      <Modal
        isOpen={isLongPressModalOpen}
        onClose={() => setIsLongPressModalOpen(false)}
        title={`Table ${longPressedTable?.tableNumber} Actions`}
      >
        <div className="space-y-4">
          <div className="bg-white/5 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Guest</p>
            <p className="font-bold text-lg">
              {movingReservation?.customerName}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button
              className="glass-button bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 flex-col py-8"
              onClick={() => {
                // Trigger move modal
                handleMoveClick(movingReservation!);
              }}
            >
              <ArrowLeftRight className="h-6 w-6 mb-2" />
              Move Table
            </Button>

            <Button
              variant="destructive"
              className="bg-red-500/20 text-red-300 hover:bg-red-500/30 flex-col py-8"
              onClick={() => {
                // Open edit/cancel modal
                setIsLongPressModalOpen(false);
                /* Trigger edit logic */
                setEditingReservation(movingReservation);
                // Need to populate edit form data
                if (movingReservation) {
                  setEditFormData({
                    customerName: movingReservation.customerName,
                    contact: movingReservation.contact,
                    adults: movingReservation.adults.toString(),
                    kids: movingReservation.kids.toString(),
                    foodPref: movingReservation.foodPref,
                    specialReq: movingReservation.specialReq || "",
                  });
                  setIsEditModalOpen(true);
                }
              }}
            >
              <X className="h-6 w-6 mb-2" />
              Cancel / Edit
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
