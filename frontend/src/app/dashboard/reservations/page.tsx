"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  reservationService,
  Slot,
  Table,
  Reservation,
} from "@/services/reservation.service";
import { useSocket } from "@/context/socket-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

const isSlotPast = (date: string, slot: Slot, customTime?: string | null) => {
  const today = getISTDate();
  if (date < today) return true;
  if (date > today) return false;

  // Date is today, compare time
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  const currentH = istTime.getUTCHours();
  const currentM = istTime.getUTCMinutes();

  const timeToCompare = customTime || slot.startTime;
  const [startH, startM] = timeToCompare.split(":").map(Number);

  const currentTotalMinutes = currentH * 60 + currentM;
  const slotStartTotalMinutes = startH * 60 + startM;

  // Allow booking up to 60 mins (1 hour) after start
  if (currentTotalMinutes > slotStartTotalMinutes + 60) return true;

  return false;
};

// Helper to determine default template
const getTemplateTypeForSlot = (date: string, startTime: string) => {
  if (!startTime) return "RESERVATION_CONFIRMATION";
  const hour = parseInt(startTime.split(":")[0]);
  const dateObj = new Date(date);
  const day = dateObj.getDay();
  const isWeekend = day === 0 || day === 6;

  // Assuming Brunch is before 4 PM (16:00)
  if (hour < 16) {
    return isWeekend ? "WEEKEND_BRUNCH" : "WEEKDAY_BRUNCH";
  }
  return "RESERVATION_CONFIRMATION";
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
    notificationType: "RESERVATION_CONFIRMATION", // Default
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [selectedMergeTables, setSelectedMergeTables] = useState<number[]>([]);
  const [isMergingMode, setIsMergingMode] = useState(false);

  // Helper for notification template default
  const getDefaultTemplate = useCallback(
    (dateStr: string, slot: Slot | null) => {
      if (!slot) return "RESERVATION_CONFIRMATION";
      return getTemplateTypeForSlot(dateStr, slot.startTime);
    },
    [],
  );

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
    notificationType: "RESERVATION_CONFIRMATION",
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
    notificationType: "RESERVATION_CONFIRMATION",
  });
  const [editMergeTables, setEditMergeTables] = useState<number[]>([]);

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
  const [moveNotificationType, setMoveNotificationType] = useState<string>(
    "RESERVATION_CONFIRMATION",
  );
  const [moveAvailableTables, setMoveAvailableTables] = useState<Table[]>([]);
  const [moveSelectedTables, setMoveSelectedTables] = useState<Table[]>([]);
  const [moveLoading, setMoveLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Custom Time / Sub-Slot Booking State
  const [customStartTime, setCustomStartTime] = useState<string | null>(null);
  const [isTimeSelectorOpen, setIsTimeSelectorOpen] = useState(false);
  const [customTimeSlot, setCustomTimeSlot] = useState<Slot | null>(null);

  // Expanded Move State
  const [moveDate, setMoveDate] = useState<string>("");
  const [moveSlots, setMoveSlots] = useState<Slot[]>([]);
  const [moveSelectedSlot, setMoveSelectedSlot] = useState<Slot | null>(null);

  // Long Press State
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [isLongPressModalOpen, setIsLongPressModalOpen] = useState(false);
  const [longPressedTable, setLongPressedTable] = useState<Table | null>(null);

  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelingReservation, setCancelingReservation] =
    useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Helper to generate 15-min intervals for a slot
  const generateTimeIntervals = useCallback((slot: Slot) => {
    const times: string[] = [];
    const [startH, startM] = slot.startTime.split(":").map(Number);
    const [endH, endM] = slot.endTime.split(":").map(Number);

    let currentH = startH;
    let currentM = startM;

    // For safety loop
    let loops = 0;
    while (loops < 50) {
      // Format
      const timeStr = `${currentH.toString().padStart(2, "0")}:${currentM.toString().padStart(2, "0")}`;
      times.push(timeStr);

      // Stop if we reached end time
      if (currentH > endH || (currentH === endH && currentM >= endM)) break;

      // Add 15 mins
      currentM += 15;
      if (currentM >= 60) {
        currentH += 1;
        currentM -= 60;
      }
      loops++;
    }
    return times;
  }, []);

  const handleTimeSelect = (time: string | null) => {
    setCustomStartTime(time);
    setIsTimeSelectorOpen(false);
    // Explicitly refetch with new time context if active
    if (selectedSlot) {
      // We need to trigger fetch via effect or direct call.
      // Since customStartTime is in dependency of fetchTableData, it will trigger effect if we rely on it.
    }
  };

  // Refactored to fetch slots first, then tables+reservations together
  const fetchInitialData = useCallback(
    async (preserveSelection = false) => {
      try {
        setLoading(true);
        const slotsData = await reservationService.getSlots(date);
        setSlots(slotsData);

        if (slotsData.length > 0) {
          if (!preserveSelection) {
            setSelectedSlot(slotsData[0]);
            setCustomStartTime(null); // Reset custom time on date change
          }
        } else {
          setSelectedSlot(null);
          setCustomStartTime(null);
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
    },
    [date],
  );

  // Unified fetcher for Tables + Reservations
  const fetchTableData = useCallback(async () => {
    if (!selectedSlot) return;
    try {
      const data = await reservationService.getTablesWithAvailability(
        date,
        selectedSlot.id,
        customStartTime || undefined,
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
  }, [date, selectedSlot, customStartTime]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]); // Refetch slots when date changes to get day-specific slots

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (data: { date: string; slotId: number }) => {
      // If the update is for the current viewed date
      if (data.date === date) {
        // Refres slots to update counts (preserve selection)
        fetchInitialData(true);

        // If the update is for the CURRENTLY selected slot, refresh the grid
        if (selectedSlot && selectedSlot.id === data.slotId) {
          fetchTableData();
        }
      }
    };

    socket.on("reservation:update", handleUpdate);

    return () => {
      socket.off("reservation:update", handleUpdate);
    };
  }, [socket, date, selectedSlot, fetchInitialData, fetchTableData]);

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
        notificationType:
          reservation.notificationType ||
          getTemplateTypeForSlot(
            reservation.date,
            reservation.startTime ||
              (reservation.slot ? reservation.slot.startTime : "19:00"),
          ),
      });
      setEditMergeTables([]); // Reset
      setIsEditModalOpen(true);
    } else {
      // Check for past time
      // If custom time is set, check against that?
      // isSlotPast uses slot start time. We should update isSlotPast to handle customTime if we want consistency,
      // but slot level check is "safe enough".
      // Let's rely on standard slot check or update it.
      if (isSlotPast(date, selectedSlot, customStartTime)) {
        toast.error("Booking limit Reached: Time already lost.");
        return;
      }

      // Open Create Modal
      setSelectedTable(table);
      // Auto-select template

      setBookingData({
        customerName: "",
        contact: "",
        adults: table.capacity.toString(),
        kids: "0",
        foodPref: "Regular",
        specialReq: "",
        notificationType: customStartTime
          ? getTemplateTypeForSlot(date, customStartTime)
          : selectedSlot
            ? getTemplateTypeForSlot(date, selectedSlot.startTime)
            : "RESERVATION_CONFIRMATION",
      });
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
        customStartTime: customStartTime || undefined, // Pass custom time
        mergeTableIds:
          selectedMergeTables.length > 0 ? selectedMergeTables : undefined,
      });
      setIsBookingModalOpen(false);
      setIsBookingModalOpen(false);
      setBookingData({
        customerName: "",
        contact: "",
        adults: "",
        kids: "0",
        foodPref: "Regular",
        specialReq: "",
        notificationType: "RESERVATION_CONFIRMATION",
      });
      fetchTableData();
    } catch (err) {
      console.error("Booking failed", err);
      // Explicit conflict message from backend
      // @ts-expect-error - Response type not fully typed
      alert(err.response?.data?.message || "Failed to create reservation");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReservation) return;

    setBookingLoading(true);
    try {
      await reservationService.updateReservation(editingReservation.id, {
        ...editFormData,
        addTableIds: editMergeTables.length > 0 ? editMergeTables : undefined,
        notificationType: editFormData.notificationType,
      });
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

  const handleCancelReservation = (reservation: Reservation) => {
    setCancelingReservation(reservation);
    setCancelReason(""); // Reset reason
    setIsCancelModalOpen(true);
  };

  const confirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelingReservation) return;

    setCancelLoading(true);
    try {
      await reservationService.cancelReservation(
        cancelingReservation.id,
        cancelReason,
      );
      setIsCancelModalOpen(false);
      setIsEditModalOpen(false); // Close edit modal if open
      setIsLongPressModalOpen(false); // Close long press modal if open
      setEditingReservation(null);
      setMovingReservation(null); // Clear moving reservation
      setCancelingReservation(null);
      setCancelReason("");
      fetchTableData();
    } catch (err) {
      console.error("Cancel failed", err);
      alert("Failed to cancel reservation");
    } finally {
      setCancelLoading(false);
    }
  };

  // --- Move Reservation Logic ---

  const handleMoveClick = (reservation: Reservation) => {
    setMovingReservation(reservation);
    setMoveDate(
      reservation.date
        ? new Date(reservation.date).toISOString().split("T")[0]
        : getISTDate(),
    );
    // Set default slot
    const slot =
      slots.find((s) => s.id === reservation.slotId) ||
      slots.find((s) => s.id === 26) || // 8:30 PM
      slots[0];
    setMoveSelectedSlot(slot || null);

    // Set default template
    setMoveNotificationType(
      reservation.notificationType || "RESERVATION_CONFIRMATION",
    );

    setIsMoveModalOpen(true);
    setIsLongPressModalOpen(false);
    // fetchMoveTargets will be triggered by useEffect
  };

  const fetchMoveTargets = useCallback(
    async (d: string, sId?: number) => {
      if (!sId) return;
      setMoveLoading(true);
      try {
        const data = await reservationService.getTablesWithAvailability(d, sId);
        // Exclude tables occupied by OTHER reservations
        // If we are moving, we ignore our OWN reservation's blocking if present (though usually we move to new tables)
        // If we move to same slot, our own reservation is in 'data.reservations'. We should ignore it so we can "select" other tables or even our own if we want to change table combo.
        // Actually, current logic was: filter r.id !== movingReservation.id
        const occupiedTableIds = data.reservations
          .filter(
            (r) => r.id !== movingReservation?.id && r.status !== "CANCELLED",
          )
          .map((r) => r.tableId);

        const freeTables = data.tables.filter(
          (t) => !occupiedTableIds.includes(t.id),
        );
        setMoveAvailableTables(freeTables);
        setMoveSelectedTables([]); // Reset selection when targets change
      } catch (e) {
        console.error("Failed to fetch move targets", e);
      } finally {
        setMoveLoading(false);
      }
    },
    [movingReservation],
  );

  // Effect to refetch targets when moveDate/moveSelectedSlot changes
  useEffect(() => {
    if (isMoveModalOpen && moveDate && moveSelectedSlot) {
      fetchMoveTargets(moveDate, moveSelectedSlot.id);
    }
  }, [moveDate, moveSelectedSlot, isMoveModalOpen, fetchMoveTargets]);

  // Fetch slots when moveDate changes
  useEffect(() => {
    if (!isMoveModalOpen || !moveDate) return;
    const loadSlots = async () => {
      if (moveDate === date) {
        setMoveSlots(slots);
      } else {
        try {
          const s = await reservationService.getSlots(moveDate);
          setMoveSlots(s);
          // Auto select first if not selected or invalid?
          // If we changed date, current slot might be invalid.
          // For simplicity, auto-select first slot available.
          if (s.length > 0) setMoveSelectedSlot(s[0]);
          else setMoveSelectedSlot(null);
        } catch (err) {
          console.error(err);
        }
      }
    };
    loadSlots();
  }, [moveDate, isMoveModalOpen, date, slots]);

  const handleMoveSubmit = async () => {
    if (
      !movingReservation ||
      moveSelectedTables.length === 0 ||
      !moveSelectedSlot
    )
      return;

    setMoveLoading(true);
    try {
      await reservationService.moveReservation(
        movingReservation.id,
        moveSelectedTables.map((t) => t.id),
        moveDate,
        moveSelectedSlot.id,
        moveNotificationType, // Pass selected template
      );
      setIsMoveModalOpen(false);
      setMovingReservation(null);
      setMoveSelectedTables([]);
      fetchTableData(); // Refresh current view
    } catch (err) {
      console.error("Move failed", err);
      alert("Failed to move reservation. Targets might be taken.");
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

  const handleSlotTouchStart = (slot: Slot) => {
    const timer = setTimeout(() => {
      // Trigger custom time selector on long press
      setCustomTimeSlot(slot);
      setIsTimeSelectorOpen(true);
    }, 800); // 800ms for long press
    setLongPressTimer(timer);
  };

  // --- Group Booking Logic ---

  const handleGroupTableToggle = (tableId: number) => {
    setGroupSelectedTables((prev) =>
      prev.includes(tableId)
        ? prev.filter((id) => id !== tableId)
        : [...prev, tableId],
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
        notificationType: "RESERVATION_CONFIRMATION",
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

  // Group tables for display
  const processedTables = React.useMemo(() => {
    const handledTableIds = new Set<number>();
    const result: { table: Table; reservation?: Reservation }[] = [];

    // Sort tables by tableNumber first to ensure consistent order
    const sortedTables = [...tables].sort(
      (a, b) => Number(a.tableNumber) - Number(b.tableNumber),
    );

    sortedTables.forEach((table) => {
      if (handledTableIds.has(table.id)) return;

      const reservation = reservations.find((r) => r.tableId === table.id);

      if (reservation && reservation.groupId) {
        // Find all tables in this group
        const groupReservations = reservations.filter(
          (r) => r.groupId === reservation.groupId,
        );
        const groupTableIds = groupReservations.map((r) => r.tableId);
        const groupTables = tables.filter((t) => groupTableIds.includes(t.id));

        // Mark all as handled
        groupTables.forEach((t) => handledTableIds.add(t.id));

        // Create merged display table
        const sortedGroupTables = groupTables.sort(
          (a, b) => Number(a.tableNumber) - Number(b.tableNumber),
        );
        const mergedNumbers = sortedGroupTables
          .map((t) => t.tableNumber)
          .join(", ");
        const totalCapacity = groupTables.reduce(
          (sum, t) => sum + t.capacity,
          0,
        );

        // Use the first table as base but override display props
        result.push({
          table: {
            ...sortedGroupTables[0],
            tableNumber: mergedNumbers,
            capacity: totalCapacity,
          },
          reservation: reservation,
        });
      } else {
        handledTableIds.add(table.id);
        result.push({ table, reservation });
      }
    });

    return result;
  }, [tables, reservations]);

  if (loading)
    return <div className="text-white">Loading reservation system...</div>;

  return (
    <div className="pt-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-4 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Reservations
            </h2>
            {role === "ADMIN" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => {
                    if (!selectedSlot)
                      return alert("Please select a time slot first");

                    setGroupBookingData((prev) => ({
                      ...prev,
                      notificationType: getDefaultTemplate(date, selectedSlot),
                    }));

                    setIsGroupBookingModalOpen(true);
                  }}
                  size="sm"
                  variant="secondary"
                  className="gap-2 h-8 sm:h-9 text-xs sm:text-sm"
                >
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Group Booking
                </Button>
                <Button
                  onClick={openManageSlots}
                  size="sm"
                  variant="outline"
                  className="gap-2 h-8 sm:h-9 text-xs sm:text-sm"
                >
                  <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Manage
                  Slots
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Date Picker */}
        <div className="flex items-center space-x-2 bg-muted rounded-lg p-1.5 sm:p-2 border border-border w-fit shrink-0">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-foreground text-sm sm:text-base focus:outline-none dark:[&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:invert-[.5] cursor-pointer w-[110px] sm:w-auto"
          />
        </div>
      </div>

      {/* Slots Selection */}
      <div className="flex overflow-x-auto pb-2 pt-2 gap-3 no-scrollbar min-h-[50px]">
        {slots.length === 0 && (
          <div className="text-muted-foreground text-sm py-2">
            No slots available for this day.
          </div>
        )}
        {slots.map((slot) => {
          const isSelected = selectedSlot?.id === slot.id;
          const isCustomActive = isSelected && customStartTime;

          // Format displayed time
          let displayTime = `${formatTo12Hour(slot.startTime)} - ${formatTo12Hour(slot.endTime)}`;
          if (isCustomActive) {
            const [sh, sm] = customStartTime.split(":").map(Number);
            const endD = new Date();
            endD.setHours(sh, sm + 90, 0, 0); // +90 mins
            const endStr = `${endD.getHours().toString().padStart(2, "0")}:${endD.getMinutes().toString().padStart(2, "0")}`;
            displayTime = `${formatTo12Hour(customStartTime)} - ${formatTo12Hour(endStr)}`;
          }

          return (
            <div key={slot.id} className="relative group">
              <div
                className={cn(
                  "relative flex items-center rounded-full border transition-all whitespace-nowrap overflow-hidden pr-2",
                  isCustomActive
                    ? "bg-amber-400 text-amber-950 border-amber-500 shadow-md"
                    : isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted border-border text-muted-foreground hover:bg-muted/80",
                )}
              >
                {/* Left Clock - Triggers Custom Time Modal */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomTimeSlot(slot);
                    setIsTimeSelectorOpen(true);
                  }}
                  className={cn(
                    "p-1.5 md:p-2 hover:bg-primary/10 transition-colors h-full flex items-center justify-center border-r border-border/10 mr-1",
                    isCustomActive ? "text-primary-foreground font-bold" : "",
                  )}
                  title="Select Custom Time"
                >
                  <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                </button>

                {/* Main Text - Triggers Standard Slot Selection */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSlot(slot);
                    setCustomStartTime(null);
                  }}
                  onTouchStart={() => handleSlotTouchStart(slot)}
                  onTouchEnd={handleTouchEnd}
                  className="flex-1 py-1.5 px-1 md:py-2 md:px-2 text-xs md:text-sm font-medium text-left truncate"
                >
                  {displayTime}
                </button>
              </div>

              {/* Badge */}
              {slot.reservedCount !== undefined && slot.reservedCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[10px] text-background font-bold shadow-sm z-10 border border-background">
                  {slot.reservedCount}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tables Grid */}
      <Card className="bg-card border-border text-card-foreground min-h-[500px] shadow-sm">
        <CardHeader>
          <CardTitle>
            Tables for {date.split("-").reverse().join("-")} (
            {customStartTime
              ? (() => {
                  const [sh, sm] = customStartTime.split(":").map(Number);
                  const endD = new Date();
                  endD.setHours(sh, sm + 90, 0, 0);
                  const endStr = `${endD.getHours().toString().padStart(2, "0")}:${endD.getMinutes().toString().padStart(2, "0")}`;
                  return (
                    <span className="text-amber-500 font-bold ml-1">
                      {formatTo12Hour(customStartTime)} -{" "}
                      {formatTo12Hour(endStr)}
                    </span>
                  );
                })()
              : selectedSlot
                ? `${formatTo12Hour(selectedSlot.startTime)} - ${formatTo12Hour(selectedSlot.endTime)}`
                : "Select Slot"}
            )
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
            {processedTables.map(({ table, reservation }) => {
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
                    "relative aspect-square rounded-xl flex flex-col items-center justify-center p-2 md:p-4 border transition-all cursor-pointer shadow-sm group select-none",
                    isBooked
                      ? "bg-red-100 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 opacity-95 shadow-[inset_0_0_12px_rgba(239,68,68,0.05)]"
                      : "bg-black/3 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors",
                  )}
                >
                  <Armchair
                    className={cn(
                      "h-5 w-5 md:h-8 md:w-8 mb-1 md:mb-2",
                      isBooked
                        ? "text-red-600 dark:text-red-400"
                        : "text-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "font-bold text-base md:text-xl text-center leading-tight",
                      isBooked
                        ? "text-red-800 dark:text-red-300"
                        : "text-foreground font-bold",
                    )}
                  >
                    {table.tableNumber}
                  </span>
                  <div
                    className={cn(
                      "flex items-center text-[10px] md:text-xs mt-0.5 md:mt-1",
                      isBooked
                        ? "text-red-700/70 dark:text-red-400/60"
                        : "text-foreground/60 font-medium",
                    )}
                  >
                    <Users className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                    {isBooked && reservation
                      ? `${
                          (reservation.adults || 0) + (reservation.kids || 0)
                        } / ${table.capacity}`
                      : table.capacity}
                  </div>
                  {isBooked && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 dark:bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  )}
                  {isBooked && reservation && (
                    <div className="mt-1 md:mt-2 text-[10px] md:text-xs font-semibold truncate max-w-[95%] text-center leading-none text-red-700 dark:text-red-300">
                      {reservation.customerName.split(" ")[0]}
                      {reservation.groupId && (
                        <span className="text-[8px] md:text-[10px] ml-0.5 opacity-70 block">
                          (Mrg)
                        </span>
                      )}
                    </div>
                  )}
                  {/* Desktop Move Icon */}
                  {role === "ADMIN" && isBooked && reservation && (
                    <div
                      className="absolute top-2 right-2 hidden group-hover:block z-10 p-1 bg-background/80 rounded-full hover:bg-background border border-border shadow-sm transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveClick(reservation);
                      }}
                    >
                      <ArrowLeftRight className="h-4 w-4 text-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {tables.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
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
        <form onSubmit={handleBookingSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name</Label>
            <Input
              id="customerName"
              value={bookingData.customerName}
              onChange={(e) =>
                setBookingData({ ...bookingData, customerName: e.target.value })
              }
              required
              className="bg-background border-border text-foreground focus:ring-1 focus:ring-foreground"
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
              className="bg-background border-border text-foreground focus:ring-1 focus:ring-foreground"
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
                className="bg-background border-border text-foreground focus:ring-1 focus:ring-foreground"
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
                className="bg-background border-border text-foreground focus:ring-1 focus:ring-foreground"
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
                  <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users
                          className={cn(
                            "h-4 w-4",
                            totalCapacity >= totalGuests
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm font-medium",
                            totalCapacity >= totalGuests
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {totalCapacity >= totalGuests
                            ? "Capacity Met"
                            : `Need ${totalGuests - totalCapacity} more seats`}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {totalCapacity} / {totalGuests} Guests
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        ADD NEARBY TABLES
                      </p>
                      <div className="grid grid-cols-4 gap-2 max-h-[120px] overflow-y-auto pr-1">
                        {tables
                          .filter((t) => {
                            if (t.id === selectedTable.id) return false;
                            return !reservations.some(
                              (r) => r.tableId === t.id,
                            );
                          })
                          .sort((a, b) => b.capacity - a.capacity)
                          .map((t) => {
                            const isSelected = selectedMergeTables.includes(
                              t.id,
                            );
                            return (
                              <div
                                key={t.id}
                                onClick={() => toggleMergeTable(t)}
                                className={cn(
                                  "py-1.5 px-1 rounded text-center cursor-pointer transition-all border",
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background border-border text-muted-foreground hover:bg-muted",
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
              className="w-full bg-background border border-border rounded-md p-2 text-foreground focus:ring-1 focus:ring-foreground"
            >
              <option className="bg-background text-foreground" value="Regular">
                Regular
              </option>
              <option className="bg-background text-foreground" value="Jain">
                Jain
              </option>
              <option
                className="bg-background text-foreground"
                value="Swaminarayan"
              >
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
              className="bg-background border-border text-foreground focus:ring-1 focus:ring-foreground"
            />
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="notificationType">WhatsApp Template</Label>
            <select
              id="notificationType"
              value={bookingData.notificationType}
              onChange={(e) =>
                setBookingData({
                  ...bookingData,
                  notificationType: e.target.value,
                })
              }
              className="w-full bg-background border border-border rounded-md p-2 text-foreground text-sm focus:ring-1 focus:ring-foreground"
            >
              <option
                className="bg-background text-foreground"
                value="RESERVATION_CONFIRMATION"
              >
                Unlimited Dinner
              </option>
              <option
                className="bg-background text-foreground"
                value="WEEKDAY_BRUNCH"
              >
                Weekday Brunch
              </option>
              <option
                className="bg-background text-foreground"
                value="WEEKEND_BRUNCH"
              >
                Weekend Brunch
              </option>
              <option
                className="bg-background text-foreground"
                value="A_LA_CARTE"
              >
                A La Carte
              </option>
            </select>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              className="w-full h-11"
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
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Booked Slot</Label>
            <Input
              value={
                editingReservation
                  ? editingReservation.startTime && editingReservation.endTime
                    ? `${formatTo12Hour(editingReservation.startTime)} - ${formatTo12Hour(editingReservation.endTime)}`
                    : editingReservation.slot
                      ? `${formatTo12Hour(editingReservation.slot.startTime)} - ${formatTo12Hour(editingReservation.slot.endTime)}`
                      : "N/A"
                  : ""
              }
              readOnly
              className="bg-muted border-border text-muted-foreground cursor-not-allowed"
            />
          </div>

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
              className="bg-background border-border text-foreground"
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
              className="bg-background border-border text-foreground"
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
                className="bg-background border-border text-foreground"
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
                className="bg-background border-border text-foreground"
              />
            </div>
          </div>
          <div className="space-y-2">
            {/* Dynamic Merge Logic UI */}
            {editingReservation &&
              (() => {
                const totalGuests =
                  (parseInt(editFormData.adults) || 0) +
                  (parseInt(editFormData.kids) || 0);

                let currentCapacity = 0;
                if (editingReservation.groupId) {
                  const groupRes = reservations.filter(
                    (r) => r.groupId === editingReservation.groupId,
                  );
                  const groupTableIds = groupRes.map((r) => r.tableId);
                  const groupTables = tables.filter((t) =>
                    groupTableIds.includes(t.id),
                  );
                  currentCapacity = groupTables.reduce(
                    (sum, t) => sum + t.capacity,
                    0,
                  );
                } else {
                  const currentTable = tables.find(
                    (t) => t.id === editingReservation.tableId,
                  );
                  currentCapacity = currentTable ? currentTable.capacity : 0;
                }

                const addedTables = tables.filter((t) =>
                  editMergeTables.includes(t.id),
                );
                const addedCapacity = addedTables.reduce(
                  (sum, t) => sum + t.capacity,
                  0,
                );
                const totalCapacity = currentCapacity + addedCapacity;

                if (totalGuests > currentCapacity) {
                  return (
                    <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-3 mt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users
                            className={cn(
                              "h-4 w-4",
                              totalCapacity >= totalGuests
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          />
                          <span
                            className={cn(
                              "text-sm font-medium",
                              totalCapacity >= totalGuests
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {totalCapacity >= totalGuests
                              ? "Capacity Met"
                              : `Need ${
                                  totalGuests - totalCapacity
                                } more seats`}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {totalCapacity} / {totalGuests} Guests
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          ADD NEARBY TABLES
                        </p>
                        <div className="grid grid-cols-4 gap-2 max-h-[120px] overflow-y-auto pr-1">
                          {tables
                            .filter((t) => {
                              if (reservations.some((r) => r.tableId === t.id))
                                return false;
                              return true;
                            })
                            .sort((a, b) => b.capacity - a.capacity)
                            .map((t) => {
                              const isSelected = editMergeTables.includes(t.id);
                              return (
                                <div
                                  key={t.id}
                                  onClick={() => {
                                    setEditMergeTables((prev) =>
                                      prev.includes(t.id)
                                        ? prev.filter((id) => id !== t.id)
                                        : [...prev, t.id],
                                    );
                                  }}
                                  className={cn(
                                    "py-1.5 px-1 rounded text-center cursor-pointer transition-all border",
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background border-border text-muted-foreground hover:bg-muted",
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
                }
                return null;
              })()}
          </div>
          <div className="space-y-2">
            <Label>Food Preference</Label>
            <select
              value={editFormData.foodPref}
              onChange={(e) =>
                setEditFormData({ ...editFormData, foodPref: e.target.value })
              }
              className="w-full bg-background border border-border rounded-md p-2 text-foreground focus:ring-1 focus:ring-foreground"
            >
              <option className="bg-background text-foreground" value="Regular">
                Regular
              </option>
              <option className="bg-background text-foreground" value="Jain">
                Jain
              </option>
              <option
                className="bg-background text-foreground"
                value="Swaminarayan"
              >
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
              className="bg-background border-border text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editNotificationType">WhatsApp Template</Label>
            <select
              id="editNotificationType"
              value={editFormData.notificationType}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  notificationType: e.target.value,
                })
              }
              className="w-full bg-background border border-border rounded-md p-2 text-foreground text-sm focus:ring-1 focus:ring-foreground"
            >
              <option
                className="bg-background text-foreground"
                value="RESERVATION_CONFIRMATION"
              >
                Unlimited Dinner
              </option>
              <option
                className="bg-background text-foreground"
                value="WEEKDAY_BRUNCH"
              >
                Weekday Brunch
              </option>
              <option
                className="bg-background text-foreground"
                value="WEEKEND_BRUNCH"
              >
                Weekend Brunch
              </option>
              <option
                className="bg-background text-foreground"
                value="A_LA_CARTE"
              >
                A La Carte
              </option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            <Button
              type="button"
              className="w-full h-11 bg-red-600 hover:bg-red-700 text-white border-transparent"
              onClick={() =>
                editingReservation &&
                handleCancelReservation(editingReservation)
              }
              disabled={cancelLoading}
            >
              {cancelLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Cancel Reservation
            </Button>
            <Button
              type="submit"
              className="w-full h-11"
              disabled={
                bookingLoading ||
                (() => {
                  if (!editingReservation) return false;
                  const totalGuests =
                    (parseInt(editFormData.adults) || 0) +
                    (parseInt(editFormData.kids) || 0);

                  let currentCapacity = 0;
                  if (editingReservation.groupId) {
                    const groupTableIds = reservations
                      .filter((r) => r.groupId === editingReservation.groupId)
                      .map((r) => r.tableId);
                    currentCapacity = tables
                      .filter((t) => groupTableIds.includes(t.id))
                      .reduce((sum, t) => sum + t.capacity, 0);
                  } else {
                    const t = tables.find(
                      (t) => t.id === editingReservation.tableId,
                    );
                    currentCapacity = t ? t.capacity : 0;
                  }

                  const addedCapacity = tables
                    .filter((t) => editMergeTables.includes(t.id))
                    .reduce((sum, t) => sum + t.capacity, 0);
                  return totalGuests > currentCapacity + addedCapacity;
                })()
              }
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
        <div className="space-y-6">
          {/* Add New Slot */}
          <div className="bg-muted p-4 rounded-lg border border-border space-y-4">
            <h3 className="font-semibold text-lg text-foreground">
              Add New Slot
            </h3>
            <form onSubmit={handleAddSlot} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <div className="flex gap-1 sm:gap-2">
                    <select
                      className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm text-foreground focus:ring-1 focus:ring-foreground"
                      value={parseTime(newSlot.startTime).hour}
                      onChange={(e) => {
                        const current = parseTime(newSlot.startTime);
                        setNewSlot({
                          ...newSlot,
                          startTime: convert12to24(
                            e.target.value,
                            current.minute,
                            current.period,
                          ),
                        });
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option
                          key={h}
                          value={h.toString().padStart(2, "0")}
                          className="bg-background text-foreground"
                        >
                          {h.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm text-foreground focus:ring-1 focus:ring-foreground"
                      value={parseTime(newSlot.startTime).minute}
                      onChange={(e) => {
                        const current = parseTime(newSlot.startTime);
                        setNewSlot({
                          ...newSlot,
                          startTime: convert12to24(
                            current.hour,
                            e.target.value,
                            current.period,
                          ),
                        });
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                        <option
                          key={m}
                          value={m.toString().padStart(2, "0")}
                          className="bg-background text-foreground"
                        >
                          {m.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm text-foreground focus:ring-1 focus:ring-foreground"
                      value={parseTime(newSlot.startTime).period}
                      onChange={(e) => {
                        const current = parseTime(newSlot.startTime);
                        setNewSlot({
                          ...newSlot,
                          startTime: convert12to24(
                            current.hour,
                            current.minute,
                            e.target.value,
                          ),
                        });
                      }}
                    >
                      <option
                        value="AM"
                        className="bg-background text-foreground"
                      >
                        AM
                      </option>
                      <option
                        value="PM"
                        className="bg-background text-foreground"
                      >
                        PM
                      </option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <div className="flex gap-1 sm:gap-2">
                    <select
                      className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm text-foreground focus:ring-1 focus:ring-foreground"
                      value={parseTime(newSlot.endTime).hour}
                      onChange={(e) => {
                        const current = parseTime(newSlot.endTime);
                        setNewSlot({
                          ...newSlot,
                          endTime: convert12to24(
                            e.target.value,
                            current.minute,
                            current.period,
                          ),
                        });
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option
                          key={h}
                          value={h.toString().padStart(2, "0")}
                          className="bg-background text-foreground"
                        >
                          {h.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm text-foreground focus:ring-1 focus:ring-foreground"
                      value={parseTime(newSlot.endTime).minute}
                      onChange={(e) => {
                        const current = parseTime(newSlot.endTime);
                        setNewSlot({
                          ...newSlot,
                          endTime: convert12to24(
                            current.hour,
                            e.target.value,
                            current.period,
                          ),
                        });
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                        <option
                          key={m}
                          value={m.toString().padStart(2, "0")}
                          className="bg-background text-foreground"
                        >
                          {m.toString().padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm text-foreground focus:ring-1 focus:ring-foreground"
                      value={parseTime(newSlot.endTime).period}
                      onChange={(e) => {
                        const current = parseTime(newSlot.endTime);
                        setNewSlot({
                          ...newSlot,
                          endTime: convert12to24(
                            current.hour,
                            current.minute,
                            e.target.value,
                          ),
                        });
                      }}
                    >
                      <option
                        value="AM"
                        className="bg-background text-foreground"
                      >
                        AM
                      </option>
                      <option
                        value="PM"
                        className="bg-background text-foreground"
                      >
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
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background text-muted-foreground border-border hover:bg-muted",
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
                  className="text-xs text-muted-foreground h-auto p-0 hover:bg-transparent hover:text-foreground hover:underline"
                >
                  Select All Days
                </Button>
              </div>
              <Button
                type="submit"
                className="w-full h-11"
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
            <h3 className="font-semibold text-lg text-foreground">
              Existing Slots
            </h3>
            <div className="space-y-2">
              {allSlots.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No slots configured.
                </p>
              )}
              {DAYS.map((day, dayIdx) => {
                const daySlots = allSlots.filter((s) => s.dayOfWeek === dayIdx);
                if (daySlots.length === 0) return null;
                return (
                  <div key={day} className="space-y-1">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-2 mb-1">
                      {day}
                    </h4>
                    {daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between bg-muted/30 p-2 rounded-md border border-border"
                      >
                        <span className="text-sm">
                          {formatTo12Hour(slot.startTime)} -{" "}
                          {formatTo12Hour(slot.endTime)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10"
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
        <form onSubmit={handleGroupBookingSubmit} className="space-y-4">
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
              className="bg-background border-border text-foreground"
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
              className="bg-background border-border text-foreground"
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
                className="bg-background border-border text-foreground"
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
                className="bg-background border-border text-foreground"
              />
            </div>
          </div>

          {/* Table Selection */}
          <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-3">
            {(() => {
              const totalGuests =
                (parseInt(groupBookingData.adults) || 0) +
                (parseInt(groupBookingData.kids) || 0);

              const selectedTablesList = tables.filter((t) =>
                groupSelectedTables.includes(t.id),
              );
              const totalCapacity = selectedTablesList.reduce(
                (acc, t) => acc + t.capacity,
                0,
              );

              return (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users
                        className={cn(
                          "h-4 w-4",
                          totalCapacity >= totalGuests && totalGuests > 0
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          totalCapacity >= totalGuests && totalGuests > 0
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {totalCapacity >= totalGuests && totalGuests > 0
                          ? "Capacity Met"
                          : `Need ${totalGuests - totalCapacity} more seats`}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {totalCapacity} / {totalGuests} Guests
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Select Tables ({groupSelectedTables.length})
                    </p>
                    <div className="grid grid-cols-4 gap-2 pr-1">
                      {tables
                        .filter(
                          (t) => !reservations.some((r) => r.tableId === t.id),
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
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-border text-muted-foreground hover:bg-muted",
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

                  <div className="text-xs text-muted-foreground italic pt-1">
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
              className="w-full bg-background border border-border rounded-md p-2 text-foreground focus:ring-1 focus:ring-foreground"
            >
              <option className="bg-background text-foreground" value="Regular">
                Regular
              </option>
              <option className="bg-background text-foreground" value="Jain">
                Jain
              </option>
              <option
                className="bg-background text-foreground"
                value="Swaminarayan"
              >
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
              className="bg-background border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupNotificationType">WhatsApp Template</Label>
            <select
              id="groupNotificationType"
              value={groupBookingData.notificationType}
              onChange={(e) =>
                setGroupBookingData({
                  ...groupBookingData,
                  notificationType: e.target.value,
                })
              }
              className="w-full bg-background border border-border rounded-md p-2 text-foreground text-sm focus:ring-1 focus:ring-foreground"
            >
              <option
                className="bg-background text-foreground"
                value="RESERVATION_CONFIRMATION"
              >
                Unlimited Dinner
              </option>
              <option
                className="bg-background text-foreground"
                value="WEEKDAY_BRUNCH"
              >
                Weekday Brunch
              </option>
              <option
                className="bg-background text-foreground"
                value="WEEKEND_BRUNCH"
              >
                Weekend Brunch
              </option>
              <option
                className="bg-background text-foreground"
                value="A_LA_CARTE"
              >
                A La Carte
              </option>
            </select>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              className="w-full h-11"
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
          <p className="text-sm text-muted-foreground">
            Moving reservation for{" "}
            <span className="text-foreground font-bold">
              {movingReservation?.customerName}
            </span>
          </p>

          {/* Date and Slot Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="group space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                New Date
              </label>
              <div className="relative">
                <Input
                  type="date"
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                  className="bg-background border-border text-foreground w-full appearance-none transition-all focus:ring-1 focus:ring-primary h-10 px-3 pl-10"
                  min={getISTDate()}
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">New Slot</label>
              <select
                value={moveSelectedSlot?.id || ""}
                onChange={(e) => {
                  const s = moveSlots.find(
                    (slot) => slot.id === parseInt(e.target.value),
                  );
                  setMoveSelectedSlot(s || null);
                }}
                className="w-full h-10 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-foreground"
              >
                {moveSlots.map((slot) => (
                  <option
                    key={slot.id}
                    value={slot.id}
                    className="bg-background text-foreground"
                  >
                    {formatTo12Hour(slot.startTime)} -{" "}
                    {formatTo12Hour(slot.endTime)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 col-span-1 sm:col-span-1">
              <label className="text-xs text-muted-foreground">
                WhatsApp Template
              </label>
              <select
                value={moveNotificationType}
                onChange={(e) => setMoveNotificationType(e.target.value)}
                className="w-full h-10 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-foreground"
              >
                <option
                  value="RESERVATION_CONFIRMATION"
                  className="bg-background"
                >
                  Unlimited Dinner
                </option>
                <option value="WEEKDAY_BRUNCH" className="bg-background">
                  Weekday Brunch
                </option>
                <option value="WEEKEND_BRUNCH" className="bg-background">
                  Weekend Brunch
                </option>
                <option value="A_LA_CARTE" className="bg-background">
                  A La Carte
                </option>
              </select>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">Select new table(s):</p>

          {/* Validation Status */}
          {(() => {
            const totalGuests =
              (movingReservation?.adults || 0) + (movingReservation?.kids || 0);
            const totalCapacity = moveSelectedTables.reduce(
              (sum, t) => sum + t.capacity,
              0,
            );
            const isSufficient = totalCapacity >= totalGuests;
            const remaining = totalGuests - totalCapacity;

            return (
              <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Users
                    className={cn(
                      "h-4 w-4",
                      isSufficient
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isSufficient
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {isSufficient
                      ? "Capacity Met"
                      : `Note: Need ${remaining} more seats`}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {totalCapacity} / {totalGuests} Guests
                </div>
              </div>
            );
          })()}

          {/* Available Tables List */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 p-1">
            {moveAvailableTables.length > 0 ? (
              moveAvailableTables.map((table) => {
                const isSelected = moveSelectedTables.some(
                  (t) => t.id === table.id,
                );
                return (
                  <button
                    key={table.id}
                    onClick={() => {
                      setMoveSelectedTables((prev) =>
                        isSelected
                          ? prev.filter((t) => t.id !== table.id)
                          : [...prev, table],
                      );
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Armchair className="h-6 w-6 mb-1" />
                    <span className="font-bold">{table.tableNumber}</span>
                    <span className="text-xs opacity-70">
                      Cap: {table.capacity}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="col-span-3 text-center text-muted-foreground py-4">
                No available tables for this date/slot.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button
              className="w-full h-auto py-2.5 whitespace-normal break-all"
              disabled={
                moveSelectedTables.length === 0 ||
                moveLoading ||
                (() => {
                  const totalGuests =
                    (movingReservation?.adults || 0) +
                    (movingReservation?.kids || 0);
                  const totalCapacity = moveSelectedTables.reduce(
                    (sum, t) => sum + t.capacity,
                    0,
                  );
                  return totalGuests > totalCapacity;
                })()
              }
              onClick={handleMoveSubmit}
            >
              {moveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {(() => {
                const totalGuests =
                  (movingReservation?.adults || 0) +
                  (movingReservation?.kids || 0);
                const totalCapacity = moveSelectedTables.reduce(
                  (sum, t) => sum + t.capacity,
                  0,
                );
                if (totalGuests > totalCapacity) {
                  return `Select tables to allot remaining ${
                    totalGuests - totalCapacity
                  } guests`;
                }
                return `Confirm Move to ID: ${moveSelectedTables
                  .map((t) => t.tableNumber)
                  .join(", ")}`;
              })()}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Time Selector Modal */}
      <Modal
        isOpen={isTimeSelectorOpen}
        onClose={() => setIsTimeSelectorOpen(false)}
        title={`Select Time for ${customTimeSlot ? formatTo12Hour(customTimeSlot.startTime) : "Slot"}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a specific start time. Duration will be automatically set to
            1.5 hours.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {customTimeSlot &&
              generateTimeIntervals(customTimeSlot).map((time) => (
                <Button
                  key={time}
                  variant="outline"
                  onClick={() => {
                    setSelectedSlot(customTimeSlot); // Switch to this slot
                    handleTimeSelect(time);
                  }}
                  className={cn(
                    "border-border hover:bg-muted",
                    customStartTime === time &&
                      selectedSlot?.id === customTimeSlot.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "text-foreground",
                  )}
                >
                  {formatTo12Hour(time)}
                </Button>
              ))}
          </div>
          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                handleTimeSelect(null); // Clear custom time
              }}
            >
              Clear Custom Selection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mobile Actions Modal (Long Press) */}
      <Modal
        isOpen={isLongPressModalOpen}
        onClose={() => setIsLongPressModalOpen(false)}
        title={`Table ${longPressedTable?.tableNumber} Actions`}
      >
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-xl border border-border">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
              Current Guest
            </p>
            <p className="font-bold text-xl text-foreground">
              {movingReservation?.customerName}
            </p>
            {movingReservation?.groupId && (
              <p className="text-xs text-muted-foreground font-semibold mt-1 flex items-center gap-1">
                <Users className="h-3 w-3" /> Merged Group
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {role === "ADMIN" && (
              <Button
                variant="outline"
                className="py-6 h-auto flex items-center justify-start px-6 gap-4"
                onClick={() => {
                  handleMoveClick(movingReservation!);
                }}
              >
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <ArrowLeftRight className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Move Table</p>
                  <p className="text-[10px] opacity-60">
                    Reassign to another table
                  </p>
                </div>
              </Button>
            )}

            <Button
              variant="outline"
              className="py-6 h-auto flex items-center justify-start px-6 gap-4"
              onClick={() => {
                setIsLongPressModalOpen(false);
                if (movingReservation) {
                  setEditingReservation(movingReservation);
                  setEditFormData({
                    customerName: movingReservation.customerName,
                    contact: movingReservation.contact,
                    adults: movingReservation.adults.toString(),
                    kids: movingReservation.kids.toString(),
                    foodPref: movingReservation.foodPref,
                    specialReq: movingReservation.specialReq || "",
                    notificationType:
                      movingReservation.notificationType ||
                      getTemplateTypeForSlot(
                        movingReservation.date,
                        movingReservation.startTime ||
                          (movingReservation.slot
                            ? movingReservation.slot.startTime
                            : "19:00"),
                      ),
                  });
                  setIsEditModalOpen(true);
                }
              }}
            >
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Pencil className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm">Edit Booking</p>
                <p className="text-[10px] opacity-60">
                  Update guest details or preferences
                </p>
              </div>
            </Button>

            {role === "ADMIN" && (
              <Button
                variant="outline"
                className="py-6 h-auto flex items-center justify-start px-6 gap-4 text-red-600 hover:text-red-700 hover:bg-red-500/5 border-border"
                disabled={cancelLoading}
                onClick={() => {
                  if (movingReservation)
                    handleCancelReservation(movingReservation);
                }}
              >
                <div className="p-2 rounded-lg bg-red-500/10">
                  {cancelLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-red-500" />
                  ) : (
                    <Trash2 className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Cancel Reservation</p>
                  <p className="text-[10px] opacity-60">
                    Release table and notify guest
                  </p>
                </div>
              </Button>
            )}
          </div>

          <Button
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground mt-2"
            onClick={() => setIsLongPressModalOpen(false)}
          >
            Close Menu
          </Button>
        </div>
      </Modal>

      {/* Cancel Reservation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Reservation"
      >
        <form onSubmit={confirmCancel} className="space-y-4">
          <div className="space-y-2">
            <p className="text-foreground text-sm">
              {cancelingReservation?.groupId
                ? "This will cancel all tables in this group and make them available immediately."
                : "Are you sure you want to cancel this reservation? This will release the table immediately."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancelReason">Cancellation Reason (Optional)</Label>
            <Textarea
              id="cancelReason"
              placeholder="e.g. Customer requested, No-show..."
              value={cancelReason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setCancelReason(e.target.value)
              }
              className="bg-background border-border text-foreground min-h-[80px]"
            />
          </div>
          <div className="flex justify-end pt-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCancelModalOpen(false)}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              Back
            </Button>
            <Button
              type="submit"
              className="bg-red-600 text-white hover:bg-red-700 border-transparent px-6"
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
