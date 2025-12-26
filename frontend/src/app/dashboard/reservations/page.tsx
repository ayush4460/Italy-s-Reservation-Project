"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  Calendar,
  Clock,
  Armchair,
  Users,
  Loader2,
  Plus,
  Trash2,
  Settings,
  Edit2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Slot {
  id: number;
  startTime: string;
  endTime: string;
  dayOfWeek?: number;
}

interface Table {
  id: number;
  tableNumber: string;
  capacity: number;
}

interface Reservation {
  id: number;
  tableId: number;
  customerName: string;
  contact: string;
  adults: number;
  kids: number;
  foodPref: string;
  specialReq?: string;
  date: string;
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function ReservationsPage() {
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
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

  useEffect(() => {
    fetchInitialData();
  }, [date]); // Refetch slots when date changes to get day-specific slots

  useEffect(() => {
    if (selectedSlot && date) {
      fetchReservations();
    }
  }, [selectedSlot, date]);

  const fetchInitialData = async () => {
    try {
      const [slotsRes, tablesRes] = await Promise.all([
        api.get("/reservations/slots", { params: { date } }),
        api.get("/tables"),
      ]);
      setSlots(slotsRes.data);
      setTables(tablesRes.data);
      if (slotsRes.data.length > 0) {
        setSelectedSlot(slotsRes.data[0]);
      } else {
        setSelectedSlot(null);
      }
    } catch (err) {
      console.error("Failed to load initial data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReservations = async () => {
    if (!selectedSlot) return;
    try {
      const res = await api.get("/reservations", {
        params: { date, slotId: selectedSlot.id },
      });
      setReservations(res.data);
    } catch (err) {
      console.error("Failed to fetch reservations", err);
      // If 404/error, maybe clear reservations
      setReservations([]);
    }
  };

  const handleTableClick = (table: Table) => {
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
      setIsBookingModalOpen(true);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !selectedSlot) return;

    setBookingLoading(true);
    try {
      await api.post("/reservations", {
        tableId: selectedTable.id,
        slotId: selectedSlot.id,
        date,
        ...bookingData,
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
      fetchReservations();
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
      await api.put(`/reservations/${editingReservation.id}`, {
        ...editFormData,
      });
      setIsEditModalOpen(false);
      setEditingReservation(null);
      fetchReservations();
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
      await api.delete(`/reservations/${editingReservation.id}`);
      setIsEditModalOpen(false);
      setEditingReservation(null);
      fetchReservations();
    } catch (err) {
      console.error("Cancel failed", err);
      alert("Failed to cancel reservation");
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
      const res = await api.get("/reservations/slots?all=true");
      setAllSlots(res.data);
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
      await api.post("/reservations/slots", newSlot);
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
      await api.delete(`/reservations/slots/${id}`);
      fetchAllSlots();
      fetchInitialData();
    } catch (err) {
      console.error("Failed to delete slot", err);
    }
  };

  if (loading)
    return <div className="text-white">Loading reservation system...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-bold text-white">Reservations</h2>
          <Button
            onClick={openManageSlots}
            size="sm"
            variant="outline"
            className="glass-button text-xs gap-2"
          >
            <Settings className="h-4 w-4" /> Manage Slots
          </Button>
        </div>

        {/* Date Picker */}
        <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-2 border border-white/20">
          <Calendar className="h-5 w-5 text-gray-300" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-white focus:outline-none [&::-webkit-calendar-picker-indicator]:invert"
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
              {slot.startTime} - {slot.endTime}
            </span>
          </button>
        ))}
      </div>

      {/* Tables Grid */}
      <Card className="glass-panel border-none text-white min-h-[500px]">
        <CardHeader>
          <CardTitle>
            Tables for {date} (
            {selectedSlot
              ? `${selectedSlot.startTime} - ${selectedSlot.endTime}`
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
                  className={cn(
                    "relative aspect-square rounded-xl flex flex-col items-center justify-center p-4 border-2 transition-all cursor-pointer shadow-lg",
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
              disabled={bookingLoading}
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
                  <Input
                    type="time"
                    value={newSlot.startTime}
                    onChange={(e) =>
                      setNewSlot({ ...newSlot, startTime: e.target.value })
                    }
                    required
                    className="glass-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={newSlot.endTime}
                    onChange={(e) =>
                      setNewSlot({ ...newSlot, endTime: e.target.value })
                    }
                    required
                    className="glass-input"
                  />
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
                          {slot.startTime} - {slot.endTime}
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
    </div>
  );
}
