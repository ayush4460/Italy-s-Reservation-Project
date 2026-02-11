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
import { Loader2, Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login Mode State
  const [loginMode, setLoginMode] = useState<"password" | "otp">("password");
  const [loginStep, setLoginStep] = useState(1); // 1: Email, 2: OTP
  const [loginOtp, setLoginOtp] = useState("");
  const [loginTimer, setLoginTimer] = useState(0);

  // Login OTP Timer
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loginTimer > 0) {
      interval = setInterval(() => {
        setLoginTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loginTimer]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      if (loginMode === "password") {
        const res = await api.post("/auth/login", formData);
        handleLoginSuccess(res.data);
      } else {
        if (loginStep === 1) {
          // Send OTP
          await api.post("/auth/login-otp/send", { email: formData.email });
          setLoginStep(2);
          setLoginTimer(180);
          toast.success("OTP sent to your email");
          setLoading(false);
        } else {
          // Verify OTP
          const res = await api.post("/auth/login-otp/verify", {
            email: formData.email,
            otp: loginOtp,
          });
          handleLoginSuccess(res.data);
        }
      }
    } catch (err: unknown) {
      const msg = (err as ApiError).response?.data?.message || "Login failed";

      if (msg === "Email not registered") {
        toast.error(msg);
        setError("");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  const handleLoginSuccess = (data: {
    token: string;
    user: { role: string };
  }) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.user.role || "ADMIN");
    toast.success("Login successful");
    router.push("/dashboard");
  };

  const handleResendLoginOtp = async () => {
    if (loginTimer > 0) return;
    setLoading(true);
    try {
      await api.post("/auth/login-otp/send", { email: formData.email });
      setLoginTimer(180);
      toast.success("OTP resent successfully");
    } catch {
      toast.error("Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Mesh Background - adjusted for light/dark */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-20 dark:opacity-100 -z-10" />

      <Card className="w-full max-w-md bg-card border border-border shadow-xl text-card-foreground">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-foreground">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Login to manage your restaurant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Toggle Login Mode */}
          <div className="flex bg-muted p-1 rounded-lg mb-6 border border-border">
            <button
              type="button"
              onClick={() => {
                setLoginMode("password");
                setError("");
              }}
              className={`flex-1 py-1 text-sm font-medium rounded-md transition-all ${
                loginMode === "password"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode("otp");
                setError("");
              }}
              className={`flex-1 py-1 text-sm font-medium rounded-md transition-all ${
                loginMode === "otp"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              By OTP
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {loginMode === "password" && (
              <>
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
              </>
            )}

            {loginMode === "otp" && (
              <>
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
                    disabled={loginStep === 2}
                    className="bg-background border-border text-foreground"
                  />
                </div>
                {loginStep === 2 && (
                  <div className="space-y-2">
                    <Label htmlFor="loginOtp" className="text-foreground">
                      Enter OTP
                    </Label>
                    <Input
                      id="loginOtp"
                      name="loginOtp"
                      type="text"
                      placeholder="123456"
                      maxLength={6}
                      value={loginOtp}
                      onChange={(e) => setLoginOtp(e.target.value)}
                      required
                      className="bg-background border-border text-foreground text-center text-lg tracking-widest"
                      autoFocus
                    />
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">
                        Valid for {Math.floor(loginTimer / 60)}:
                        {(loginTimer % 60).toString().padStart(2, "0")}
                      </span>
                      <button
                        type="button"
                        onClick={handleResendLoginOtp}
                        disabled={loginTimer > 0 || loading}
                        className={`font-medium transition-colors ${
                          loginTimer > 0
                            ? "text-muted-foreground/50 cursor-not-allowed"
                            : "text-foreground hover:underline"
                        }`}
                      >
                        Resend OTP
                      </button>
                    </div>
                  </div>
                )}
              </>
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
              {loginMode === "password"
                ? "Login"
                : loginStep === 1
                  ? "Send OTP"
                  : "Verify & Login"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 justify-center border-t border-border mt-4 pt-6">
          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Forgot Password?
          </button>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-foreground hover:underline font-semibold"
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
              <Label htmlFor="forgotEmail" className="text-foreground">
                Enter your email address
              </Label>
              <Input
                id="forgotEmail"
                type="email"
                placeholder="owner@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                className="bg-background border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                We&apos;ll send a verification code to this email.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-foreground">Email</Label>
                  <span className="text-xs font-medium text-foreground">
                    {forgotEmail}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp" className="text-foreground">
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
                  className="bg-background border-border text-foreground text-center text-lg tracking-widest"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPass" className="text-foreground">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="newPass"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="bg-background border-border text-foreground pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confPass" className="text-foreground">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confPass"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="bg-background border-border text-foreground pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Valid for {Math.floor(timer / 60)}:
                  {(timer % 60).toString().padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={timer > 0 || forgotLoading}
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

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
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
