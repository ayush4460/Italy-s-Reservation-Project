"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Calendar, Clock, Armchair, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Slot {
  id: number;
  startTime: string;
  endTime: string;
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
  date: string;
}

export default function ReservationsPage() {
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const [loading, setLoading] = useState(true);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Booking Form Data
  const [bookingData, setBookingData] = useState({
    customerName: "",
    contact: "",
    adults: "",
    kids: "0",
    foodPref: "Regular",
    specialReq: "",
  });
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedSlot && date) {
      fetchReservations();
    }
  }, [selectedSlot, date]);

  const fetchInitialData = async () => {
    try {
      const [slotsRes, tablesRes] = await Promise.all([
        api.get("/reservations/slots"),
        api.get("/tables"),
      ]);
      setSlots(slotsRes.data);
      setTables(tablesRes.data);
      if (slotsRes.data.length > 0) {
        setSelectedSlot(slotsRes.data[0]);
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
    }
  };

  const handleTableClick = (table: Table) => {
    const isBooked = reservations.some((r) => r.tableId === table.id);
    if (isBooked) {
      alert("This table is already booked!");
      return;
    }
    setSelectedTable(table);
    setBookingData((prev) => ({ ...prev, adults: table.capacity.toString() })); // Default to capacity
    setIsBookingModalOpen(true);
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
      fetchReservations(); // Refresh grid
    } catch (err) {
      console.error("Booking failed", err);
      alert("Failed to create reservation");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading)
    return <div className="text-white">Loading reservation system...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-white">Reservations</h2>

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
      <div className="flex overflow-x-auto pb-2 gap-3 no-scrollbar">
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

      {/* Booking Modal */}
      <Modal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        title={`Book Table ${selectedTable?.tableNumber}`}
      >
        <form
          onSubmit={handleBookingSubmit}
          className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"
        >
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
                id="adults"
                type="number"
                value={bookingData.adults}
                onChange={(e) =>
                  setBookingData({ ...bookingData, adults: e.target.value })
                }
                required
                className="glass-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kids">Kids</Label>
              <Input
                id="kids"
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
              className="w-full h-10 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-slate-900"
            >
              <option value="Regular">Regular</option>
              <option value="Jain">Jain</option>
              <option value="Swaminarayan">Swaminarayan</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialReq">Special Requirements</Label>
            <Input
              id="specialReq"
              value={bookingData.specialReq}
              onChange={(e) =>
                setBookingData({ ...bookingData, specialReq: e.target.value })
              }
              placeholder="e.g. High chair, Anniversary"
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
    </div>
  );
}
