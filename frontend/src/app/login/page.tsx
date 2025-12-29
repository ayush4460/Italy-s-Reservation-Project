"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP & New Password
  const [forgotEmail, setForgotEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  // Timer Logic
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);

    try {
      if (forgotStep === 1) {
        // Send OTP
        await api.post("/auth/forgot-password", { email: forgotEmail });
        setForgotStep(2);
        setTimer(180); // 3 minutes
        toast.success("OTP sent to your email");
      } else {
        // Verify & Reset
        if (newPassword !== confirmPassword) {
          toast.error("Passwords do not match");
          return;
        }
        await api.post("/auth/reset-password", {
          email: forgotEmail,
          otp,
          newPassword,
        });
        toast.success("Password reset successfully. Please login.");
        handleCloseForgot();
      }
    } catch (err: unknown) {
      const msg =
        (err as ApiError).response?.data?.message || "Something went wrong";
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    setForgotLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: forgotEmail });
      setTimer(180);
      toast.success("OTP resent successfully");
    } catch (err: unknown) {
      console.error(err); // Log it if needed or just ignore
      toast.error("Failed to resend OTP");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleCloseForgot = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setForgotEmail("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setTimer(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", formData);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.user.role || "ADMIN"); // Store role
      router.push("/dashboard");
    } catch (err: unknown) {
      setError((err as ApiError).response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-mesh p-4">
      <Card className="w-full max-w-md glass-panel border-none text-white">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-center text-gray-300">
            Login to manage your restaurant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="owner@example.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="glass-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                className="glass-input"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button
              type="submit"
              className="w-full glass-button mt-4"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Login
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 justify-center">
          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Forgot Password?
          </button>
          <p className="text-sm text-gray-300">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-blue-300 hover:text-blue-200 font-semibold"
            >
              Sign Up
            </Link>
          </p>
        </CardFooter>
      </Card>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={handleCloseForgot}
        title={forgotStep === 1 ? "Reset Password" : "Verify OTP"}
      >
        <form onSubmit={handleForgotSubmit} className="space-y-4">
          {forgotStep === 1 ? (
            <div className="space-y-2">
              <Label htmlFor="forgotEmail" className="text-white">
                Enter your email address
              </Label>
              <Input
                id="forgotEmail"
                type="email"
                placeholder="owner@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                className="glass-input"
              />
              <p className="text-xs text-gray-400">
                We&apos;ll send a verification code to this email.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-white">Email</Label>
                  <span className="text-xs text-blue-300 pointer-events-none">
                    {forgotEmail}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp" className="text-white">
                  Enter 6-digit OTP
                </Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  className="glass-input text-center text-lg tracking-widest"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPass" className="text-white">
                  New Password
                </Label>
                <Input
                  id="newPass"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="glass-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confPass" className="text-white">
                  Confirm Password
                </Label>
                <Input
                  id="confPass"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="glass-input"
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  Valid for {Math.floor(timer / 60)}:
                  {(timer % 60).toString().padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={timer > 0 || forgotLoading}
                  className={`font-medium ${
                    timer > 0
                      ? "text-gray-600 cursor-not-allowed"
                      : "text-blue-400 hover:text-blue-300"
                  }`}
                >
                  Resend OTP
                </button>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full glass-button"
              disabled={forgotLoading}
            >
              {forgotLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {forgotStep === 1 ? "Send OTP" : "Reset Password"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
