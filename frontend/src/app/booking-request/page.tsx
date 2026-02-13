"use client";

import { useState } from "react";
import { useForm, useWatch, type FieldValues } from "react-hook-form";
import { toast } from "sonner";

import { Clock, Users, CheckCircle2, Phone, User } from "lucide-react";
import { motion } from "framer-motion";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// Slot Configurations
const WEEKEND_SLOTS = [
  "11:00 AM - 12:30 PM",
  "12:30 PM - 02:00 PM",
  "02:00 PM - 03:30 PM",
  "07:00 PM - 08:30 PM",
  "08:30 PM - 10:00 PM",
  "10:00 PM - 11:30 PM",
];

const WEEKDAY_SLOTS = [
  "12:00 PM - 01:30 PM",
  "01:30 PM - 03:00 PM",
  "07:00 PM - 08:30 PM",
  "08:30 PM - 10:00 PM",
  "10:00 PM - 11:30 PM",
];

const MENUS = ["Unlimited Dinner", "Brunch", "Menu Based Ordering"];
const PREPARATIONS = ["Regular", "Jain", "Swaminarayan"];

export default function BookingRequestPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm({
    defaultValues: {
      name: "",
      contact: "",
      date: "",
      slot: "",
      adults: "",
      kids: "",
      menu: "",
      sitting: "",
      foodPref: "",
      specialReq: "",
    },
  });

  // Dynamic Slot Logic
  // Dynamic Slot Logic
  const selectedDate = useWatch({
    control: form.control,
    name: "date",
  });

  const getAvailableSlots = () => {
    if (!selectedDate) return [];

    const date = new Date(selectedDate);
    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const day = date.getDay();
    const isWeekend = day === 0 || day === 6; // Sunday or Saturday

    const slots = isWeekend ? WEEKEND_SLOTS : WEEKDAY_SLOTS;

    // Filter by time if the date is TODAY
    const now = new Date();
    // Convert current time to IST string to check date
    const istDateString = now.toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    if (selectedDate === istDateString) {
      // It's today, filter passed slots
      const istTime = now.toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour12: false,
      });
      const [currentHour, currentMinute] = istTime.split(":").map(Number);
      const currentTotalMinutes = currentHour * 60 + currentMinute;

      return slots.filter((slot) => {
        const startTime = slot.split(" - ")[0]; // e.g., "11:00 AM"

        // Parse start time to minutes
        const [time, modifier] = startTime.split(" ");
        const [rawHours, minutes] = time.split(":").map(Number);
        let hours = rawHours;

        if (hours === 12) {
          hours = modifier === "PM" ? 12 : 0;
        } else if (modifier === "PM") {
          hours += 12;
        }

        const slotStartMinutes = hours * 60 + minutes;

        // Allow booking if slot hasn't started yet (or strictly passed)
        // Adding a small buffer (e.g., 30 mins) could be good, but strict for now
        return slotStartMinutes > currentTotalMinutes;
      });
    }

    return slots;
  };

  const availableSlots = getAvailableSlots();

  const onSubmit = async (data: FieldValues) => {
    try {
      const payload = {
        ...data,
        name: data.name?.trim(),
      };

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/public/request-reservation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        setIsSubmitted(true);
        toast.success("Request sent successfully!");
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to send request");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-black relative overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0 z-0 opacity-40 bg-cover bg-center"
          style={{ backgroundImage: "url('/pizza_bg_dark.png')" }}
        />
        <div className="absolute inset-0 z-0 bg-linear-to-t from-black via-black/80 to-transparent" />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 max-w-lg w-full bg-zinc-950/80 backdrop-blur-md border border-amber-500/20 rounded-2xl p-8 text-center space-y-6 shadow-2xl"
        >
          <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-4 border border-green-500/20">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-white font-serif">
            Request Received
          </h2>
          <p className="text-zinc-400">
            Grazies! We have received your reservation request. Our team will
            check availability and confirm your booking shortly on WhatsApp.
          </p>
          <Button
            variant="outline"
            className="mt-6 border-amber-600/50 text-amber-500 hover:bg-amber-950 hover:text-amber-400 w-full h-12"
            onClick={() => {
              setIsSubmitted(false);
              form.reset();
            }}
          >
            Make Another Request
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black relative overflow-visible py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Background Image & Overlay */}
      <div
        className="fixed inset-0 z-0 bg-contain bg-center bg-no-repeat sm:bg-cover"
        style={{ backgroundImage: "url('/pizza_bg_dark.png')" }}
      />
      {/* Gradient Overlay for Readability */}
      <div className="fixed inset-0 z-0 bg-linear-to-b from-black/80 via-black/60 to-black/90 sm:bg-black/70" />

      {/* Main Container */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start"
      >
        {/* Left Side: Branding / Intro */}
        <div className="space-y-6 pt-10 text-center lg:text-left">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white tracking-tight font-serif">
              <span className="text-amber-500">Italy&apos;s</span> <br />
              Waitlist & <br />
              Reservations
            </h1>
          </motion.div>

          <p className="text-lg text-zinc-300 max-w-md mx-auto lg:mx-0 leading-relaxed">
            Experience the authentic taste of wood-fired pizzas and Italian
            heritage. Reserve your table request below and let us serve you an
            unforgettable meal.
          </p>

          <div className="hidden lg:flex flex-col gap-4 text-zinc-400 mt-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="font-medium text-white">Opening Hours</p>
                <p className="text-sm">All Days: 11:00 AM - 11:00 PM</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <Phone className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="font-medium text-white">Contact</p>
                <p className="text-sm">+91 99090 00317</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form Card */}
        <div className="w-full bg-zinc-950/70 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl ring-1 ring-white/5">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">Book a Table</h2>
            <p className="text-zinc-500 text-sm">
              Fill in your details to request a reservation.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Personal Details Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  rules={{ required: "Name is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400">Your Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                          <Input
                            placeholder="John Doe"
                            className="pl-9 bg-white/5 border-white/10 text-white focus:border-amber-500/50 focus:ring-amber-500/20"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contact"
                  rules={{
                    required: "Phone number is required",
                    pattern: {
                      value: /^\d{10}$/,
                      message: "Phone number must be 10 digits",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400">
                        Phone Number
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                          <Input
                            placeholder="9876543210"
                            className="pl-9 bg-white/5 border-white/10 text-white focus:border-amber-500/50 focus:ring-amber-500/20"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Date & Slot Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  rules={{ required: "Date is required" }}
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-zinc-400">Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          min={new Date().toLocaleDateString("en-CA", {
                            timeZone: "Asia/Kolkata",
                          })}
                          className="bg-white/5 border-white/10 text-white focus:border-amber-500/50 focus:ring-amber-500/20 scheme-dark relative w-full h-10 py-2 sm:py-2 appearance-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 placeholder:text-zinc-500"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slot"
                  rules={{ required: "Time slot is required" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400">Time Slot</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white hover:bg-white/10 focus:ring-amber-500/20">
                            <SelectValue placeholder="Select Slot" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableSlots.length > 0 ? (
                            availableSlots.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-zinc-400 text-center">
                              {selectedDate
                                ? "No slots available"
                                : "Select a date first"}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Guests Row */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="adults"
                  rules={{
                    required: "Number of adults is required",
                    min: { value: 1, message: "At least 1 adult required" },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400">Adults</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Users className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                          <Input
                            type="number"
                            min="1"
                            placeholder="2"
                            className="pl-9 bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="kids"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400">
                        Kids (5-10 yrs)
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Users className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            className="pl-9 bg-white/5 border-white/10 text-white focus:border-amber-500/50"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Preferences Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="menu"
                  rules={{ required: "Please select a menu" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400">
                        Preferred Menu
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white hover:bg-white/10 focus:ring-amber-500/20 pl-2">
                            <SelectValue placeholder="Select Menu" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MENUS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="foodPref"
                  rules={{ required: "Please select a food preference" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400">
                        Food Preparation
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white hover:bg-white/10 focus:ring-amber-500/20">
                            <SelectValue placeholder="Select Prep" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PREPARATIONS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Ambience Selection */}
              <FormField
                control={form.control}
                name="sitting"
                rules={{ required: "Please select a sitting area" }}
                render={({ field }) => (
                  <FormItem className="space-y-3 pt-2">
                    <FormLabel className="text-zinc-500 text-xs uppercase tracking-wider font-semibold pl-1">
                      Ambience Preference
                    </FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-2 gap-4 sm:gap-6">
                        {/* Indoor Card */}
                        <div
                          className={`group cursor-pointer transition-all duration-300 ${field.value === "Indoor" ? "scale-[1.02]" : "hover:scale-[1.01]"}`}
                          onClick={() => field.onChange("Indoor")}
                        >
                          <div
                            className={`relative aspect-4/3 sm:aspect-video w-full overflow-hidden rounded-2xl border bg-zinc-900 shadow-sm transition-all duration-500 ${
                              field.value === "Indoor"
                                ? "border-amber-500 shadow-lg shadow-amber-500/20 ring-1 ring-amber-500"
                                : "border-white/5 group-hover:border-white/20 group-hover:shadow-lg group-hover:shadow-amber-500/5"
                            }`}
                          >
                            <Image
                              src="/Italys_Indoor.jpeg"
                              alt="Indoor Dining"
                              fill
                              className={`object-cover transition-transform duration-700 ${
                                field.value === "Indoor"
                                  ? "scale-105 opacity-100"
                                  : "scale-100 opacity-60 group-hover:scale-105 group-hover:opacity-90"
                              }`}
                            />
                            {field.value === "Indoor" && (
                              <div className="absolute top-2 right-2 bg-amber-500 text-black p-1 rounded-full shadow-lg animate-in fade-in zoom-in duration-300">
                                <CheckCircle2 className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="mt-3 flex items-center justify-center gap-2">
                            <div
                              className={`h-1 w-1 rounded-full transition-colors ${field.value === "Indoor" ? "bg-amber-500" : "bg-zinc-600 group-hover:bg-amber-500"}`}
                            />
                            <p
                              className={`text-xs font-medium uppercase tracking-widest transition-colors ${field.value === "Indoor" ? "text-amber-500" : "text-zinc-400 group-hover:text-amber-500"}`}
                            >
                              Indoor
                            </p>
                            <div
                              className={`h-1 w-1 rounded-full transition-colors ${field.value === "Indoor" ? "bg-amber-500" : "bg-zinc-600 group-hover:bg-amber-500"}`}
                            />
                          </div>
                        </div>

                        {/* Outdoor Card */}
                        <div
                          className={`group cursor-pointer transition-all duration-300 ${field.value === "Outdoor" ? "scale-[1.02]" : "hover:scale-[1.01]"}`}
                          onClick={() => field.onChange("Outdoor")}
                        >
                          <div
                            className={`relative aspect-4/3 sm:aspect-video w-full overflow-hidden rounded-2xl border bg-zinc-900 shadow-sm transition-all duration-500 ${
                              field.value === "Outdoor"
                                ? "border-amber-500 shadow-lg shadow-amber-500/20 ring-1 ring-amber-500"
                                : "border-white/5 group-hover:border-white/20 group-hover:shadow-lg group-hover:shadow-amber-500/5"
                            }`}
                          >
                            <Image
                              src="/Italys_Outdoor.jpeg"
                              alt="Outdoor Garden"
                              fill
                              className={`object-cover transition-transform duration-700 ${
                                field.value === "Outdoor"
                                  ? "scale-105 opacity-100"
                                  : "scale-100 opacity-60 group-hover:scale-105 group-hover:opacity-90"
                              }`}
                            />
                            {field.value === "Outdoor" && (
                              <div className="absolute top-2 right-2 bg-amber-500 text-black p-1 rounded-full shadow-lg animate-in fade-in zoom-in duration-300">
                                <CheckCircle2 className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="mt-3 flex items-center justify-center gap-2">
                            <div
                              className={`h-1 w-1 rounded-full transition-colors ${field.value === "Outdoor" ? "bg-amber-500" : "bg-zinc-600 group-hover:bg-amber-500"}`}
                            />
                            <p
                              className={`text-xs font-medium uppercase tracking-widest transition-colors ${field.value === "Outdoor" ? "text-amber-500" : "text-zinc-400 group-hover:text-amber-500"}`}
                            >
                              Outdoor
                            </p>
                            <div
                              className={`h-1 w-1 rounded-full transition-colors ${field.value === "Outdoor" ? "bg-amber-500" : "bg-zinc-600 group-hover:bg-amber-500"}`}
                            />
                          </div>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specialReq"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-400">
                      Special Requirements (Optional)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any special requests..."
                        className="bg-white/5 border-white/10 text-white focus:border-amber-500/50 min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 text-lg bg-linear-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-medium rounded-xl shadow-lg shadow-amber-900/20 transition-all duration-300 hover:scale-[1.02]"
              >
                Send Request
              </Button>
            </form>
          </Form>
        </div>
      </motion.div>
    </div>
  );
}
