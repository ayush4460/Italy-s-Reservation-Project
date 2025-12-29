"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { useProfile } from "@/context/profile-context";
import { Modal } from "@/components/ui/modal";

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const { refetchProfile } = useProfile();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "",
    address: "",
    phone: "",
    bannerUrl: "",
    logoUrl: "",
  });
  const [originalEmail, setOriginalEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchProfile();
  }, [router]);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/restaurants/me");
      setFormData(res.data);
      setOriginalEmail(res.data.email);
    } catch (err) {
      console.error("Failed to fetch profile", err);
      toast.error("Failed to fetch profile data");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if email has changed
    if (formData.email !== originalEmail) {
      setSaving(true);
      try {
        await api.post("/restaurants/email-otp/send", {
          newEmail: formData.email,
        });
        setShowOtpModal(true);
        setOtpTimer(180); // 3 minutes
        toast.success("Verification code sent to your new email");
      } catch (err: unknown) {
        const msg =
          (err as ApiError).response?.data?.message || "Failed to send OTP";
        toast.error(msg);
      } finally {
        setSaving(false);
      }
      return;
    }

    saveProfile();
  };

  const saveProfile = async (code?: string) => {
    setSaving(true);
    setOtpLoading(true);

    try {
      const payload = { ...formData, otp: code };
      await api.put("/restaurants/me", payload);
      await refetchProfile();
      setOriginalEmail(formData.email);
      setShowOtpModal(false);
      setOtp("");
      toast.success("Profile updated successfully");
    } catch (err: unknown) {
      const msg =
        (err as ApiError).response?.data?.message || "Failed to update profile";
      toast.error(msg);
    } finally {
      setSaving(false);
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpTimer > 0) return;
    setOtpLoading(true);
    try {
      await api.post("/restaurants/email-otp/send", {
        newEmail: formData.email,
      });
      setOtpTimer(180);
      toast.success("OTP resent successfully");
    } catch (err: unknown) {
      const msg =
        (err as ApiError).response?.data?.message || "Failed to resend OTP";
      toast.error(msg);
    } finally {
      setOtpLoading(false);
    }
  };

  if (loading) return <div className="text-white">Loading profile...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Split: Left (Restaurant Name) & Right (Admin Username) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">
            {formData.name || "Restaurant Profile"}
          </h2>
          <p className="text-gray-400 text-sm">
            Manage your restaurant details
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="glass-panel border-none text-white">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Restaurant Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="glass-input"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  value={formData.username || ""}
                  onChange={handleChange}
                  className="glass-input"
                  placeholder="Enter admin username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                value={formData.address || ""}
                onChange={handleChange}
                placeholder="123 Main St, City"
                className="glass-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone || ""}
                onChange={handleChange}
                placeholder="+1 234 567 890"
                className="glass-input"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-4">
            <Button
              type="submit"
              className="glass-button w-full md:w-auto"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Modal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        title="Verify New Email"
      >
        <div className="space-y-4 pt-4">
          <p className="text-sm text-gray-400">
            A verification code has been sent to{" "}
            <span className="text-white font-medium">{formData.email}</span>.
            Please enter it below to confirm the change.
          </p>

          <div className="space-y-2">
            <Label className="text-white">Verification Code</Label>
            <Input
              type="text"
              placeholder="123456"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="glass-input text-center text-2xl tracking-[0.5em] font-bold py-6"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between text-sm pt-2">
            <span className="text-gray-500">
              Valid for {Math.floor(otpTimer / 60)}:
              {(otpTimer % 60).toString().padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={otpTimer > 0 || otpLoading}
              className={`font-medium ${
                otpTimer > 0
                  ? "text-gray-700 cursor-not-allowed"
                  : "text-blue-400 hover:text-blue-300"
              }`}
            >
              Resend Code
            </button>
          </div>

          <Button
            onClick={() => saveProfile(otp)}
            disabled={otp.length !== 6 || otpLoading}
            className="w-full glass-button mt-4 py-6 text-lg"
          >
            {otpLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              "Verify & Save Changes"
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
