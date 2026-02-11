"use client";

import React, { useState, useEffect } from "react";
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
import { Loader2, Eye, EyeOff } from "lucide-react";
import api from "@/lib/api";

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    restaurantName: "",
    ownerName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [signupStep, setSignupStep] = useState(1); // 1: Form, 2: OTP
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (signupStep === 1) {
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        setLoading(false);
        return;
      }

      try {
        await api.post("/auth/signup-otp/send", {
          email: formData.email,
          restaurantName: formData.restaurantName,
        });
        setSignupStep(2);
        setTimer(180); // 3 minutes
      } catch (err: unknown) {
        const msg =
          (err as ApiError).response?.data?.message || "Failed to send OTP";
        setError(msg);
      } finally {
        setLoading(false);
      }
    } else {
      try {
        await api.post("/auth/signup", {
          name: formData.restaurantName,
          username: formData.ownerName,
          email: formData.email,
          password: formData.password,
          otp,
        });
        router.push("/?signup=success");
      } catch (err: unknown) {
        const msg =
          (err as ApiError).response?.data?.message || "Signup failed";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    setLoading(true);
    try {
      await api.post("/auth/signup-otp/send", {
        email: formData.email,
        restaurantName: formData.restaurantName,
      });
      setTimer(180);
    } catch (err: unknown) {
      const msg =
        (err as ApiError).response?.data?.message || "Failed to resend OTP";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Mesh Background - adjusted for light/dark */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-20 dark:opacity-100 -z-10" />

      <Card className="w-full max-w-md bg-card border border-border shadow-xl text-card-foreground p-0">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center text-foreground">
            Create Account
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Register your restaurant to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {signupStep === 1 ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="restaurantName" className="text-foreground">
                    Restaurant Name
                  </Label>
                  <Input
                    id="restaurantName"
                    name="restaurantName"
                    placeholder="Grand Italia"
                    value={formData.restaurantName}
                    onChange={handleChange}
                    required
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ownerName" className="text-foreground">
                    Owner Name
                  </Label>
                  <Input
                    id="ownerName"
                    name="ownerName"
                    placeholder="John Doe"
                    value={formData.ownerName}
                    onChange={handleChange}
                    required
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="owner@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className="bg-background border-border text-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      className="bg-background border-border text-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-foreground">Verify Email</Label>
                    <span className="text-xs font-medium text-foreground">
                      {formData.email}
                    </span>
                  </div>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    className="bg-background border-border text-foreground text-center text-lg tracking-widest"
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Valid for {Math.floor(timer / 60)}:
                    {(timer % 60).toString().padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={timer > 0 || loading}
                    className={`font-medium transition-colors ${
                      timer > 0
                        ? "text-muted-foreground/50 cursor-not-allowed"
                        : "text-foreground hover:underline"
                    }`}
                  >
                    Resend OTP
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="text-destructive font-medium text-sm">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm mt-4"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {signupStep === 1 ? "Send OTP" : "Complete Signup"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-border mt-4 pt-6">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/"
              className="text-foreground hover:underline font-semibold"
            >
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
