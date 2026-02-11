"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Plus, Trash2, User, Loader2, Pencil, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

interface Staff {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function StaffPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  // OTP State
  const [addStep, setAddStep] = useState(1); // 1: Form, 2: OTP
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(0);

  // Password Visibility State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [originalEmail, setOriginalEmail] = useState("");
  const [editStep, setEditStep] = useState(1); // 1: Form, 2: OTP
  const [editOtp, setEditOtp] = useState("");
  const [editTimer, setEditTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (editTimer > 0) {
      interval = setInterval(() => {
        setEditTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [editTimer]);

  useEffect(() => {
    // Basic role check
    const role = localStorage.getItem("role") || "ADMIN";
    if (role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchStaff();
  }, [router]);

  const fetchStaff = async () => {
    try {
      const res = await api.get("/staff");
      setStaffList(res.data);
    } catch (err) {
      console.error("Failed to fetch staff", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (addStep === 1) {
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      setSubmitLoading(true);
      try {
        await api.post("/staff/otp/send", { email: formData.email });
        setAddStep(2);
        setTimer(180); // 3 minutes
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || "Failed to send OTP");
      } finally {
        setSubmitLoading(false);
      }
    } else {
      setSubmitLoading(true);
      try {
        await api.post("/staff", {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          otp,
        });
        setFormData({ name: "", email: "", password: "", confirmPassword: "" });
        setOtp("");
        setAddStep(1);
        setIsModalOpen(false);
        fetchStaff();
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || "Verification failed");
      } finally {
        setSubmitLoading(false);
      }
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    setSubmitLoading(true);
    try {
      await api.post("/staff/otp/send", { email: formData.email });
      setTimer(180);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Failed to resend OTP");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this staff member?")) return;
    try {
      await api.delete(`/staff/${id}`);
      fetchStaff();
    } catch (err) {
      console.error("Failed to delete staff", err);
    }
  };

  const handleEditClick = (staff: Staff) => {
    setEditingId(staff.id);
    setEditFormData({
      name: staff.name,
      email: staff.email,
      password: "",
      confirmPassword: "",
    });
    setOriginalEmail(staff.email);
    setEditStep(1);
    setIsEditModalOpen(true);
    setError("");
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setError("");

    // Detect Email Change
    const isEmailChanged = editFormData.email !== originalEmail;

    if (isEmailChanged && editStep === 1) {
      setSubmitLoading(true);
      try {
        await api.post("/staff/email-change-otp/send", {
          newEmail: editFormData.email,
          staffId: editingId,
        });
        setEditStep(2);
        setEditTimer(180);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || "Failed to send OTP");
      } finally {
        setSubmitLoading(false);
      }
      return;
    }

    if (
      editFormData.password &&
      editFormData.password !== editFormData.confirmPassword
    ) {
      setError("Passwords do not match");
      return;
    }

    setSubmitLoading(true);
    try {
      await api.put(`/staff/${editingId}`, {
        name: editFormData.name,
        email: editFormData.email,
        password: editFormData.password || undefined,
        otp: isEmailChanged ? editOtp : undefined,
      });
      setIsEditModalOpen(false);
      setEditingId(null);
      setEditOtp("");
      setEditStep(1);
      fetchStaff();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const errorMessage =
        error.response?.data?.message || "Failed to update staff";
      setError(errorMessage);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleResendEditOtp = async () => {
    if (editTimer > 0 || !editingId) return;
    setSubmitLoading(true);
    try {
      await api.post("/staff/email-change-otp/send", {
        newEmail: editFormData.email,
        staffId: editingId,
      });
      setEditTimer(180);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "Failed to resend OTP");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading)
    return <div className="text-foreground p-8">Loading staff...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Manage Staff</h2>
          <p className="text-muted-foreground">
            Add and manage staff members with view-only access.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} variant="default">
          <Plus className="mr-2 h-4 w-4" /> Add Staff
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staffList.map((staff) => (
          <Card
            key={staff.id}
            className="bg-card border border-border text-card-foreground hover:bg-muted/50 transition-colors shadow-sm"
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="h-12 w-12 rounded-full bg-linear-to-tr from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 overflow-hidden">
                <CardTitle className="text-lg truncate font-bold">
                  {staff.name}
                </CardTitle>
                <CardDescription className="text-muted-foreground truncate">
                  {staff.email}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-2 flex justify-between items-center">
              <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded-full border border-green-500/20">
                {staff.role}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                  onClick={() => handleEditClick(staff)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => handleDelete(staff.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {staffList.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            No staff members found.
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setAddStep(1);
          setOtp("");
          setError("");
        }}
        title={addStep === 1 ? "Add New Staff Member" : "Verify Staff Email"}
      >
        <form onSubmit={handleCreateStaff} className="space-y-4">
          {addStep === 1 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Staff Name"
                  required
                  className="bg-background border-border h-10 text-sm focus:border-primary transition-all placeholder:text-muted-foreground mr-0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="staff@example.com"
                  required
                  className="bg-background border-border h-10 text-sm focus:border-primary transition-all placeholder:text-muted-foreground mr-0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="••••••••"
                    required
                    className="bg-background border-border h-10 text-sm focus:border-primary transition-all placeholder:text-muted-foreground pr-10"
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
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="••••••••"
                    required
                    className="bg-background border-border h-10 text-sm focus:border-primary transition-all placeholder:text-muted-foreground pr-10"
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
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A verification code has been sent to{" "}
                <span className="text-foreground font-medium">
                  {formData.email}
                </span>
                .
              </p>
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  required
                  maxLength={6}
                  className="bg-background border-border h-10 focus:border-primary transition-all placeholder:text-muted-foreground text-center text-lg tracking-widest"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  Valid for {Math.floor(timer / 60)}:
                  {(timer % 60).toString().padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={timer > 0 || submitLoading}
                  className={`font-medium ${
                    timer > 0
                      ? "text-gray-700 cursor-not-allowed"
                      : "text-blue-400 hover:text-blue-300"
                  }`}
                >
                  Resend OTP
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              variant="default"
              className="w-full"
              disabled={submitLoading}
            >
              {submitLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {addStep === 1 ? "Send Invitation" : "Verify & Create Account"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditStep(1);
          setEditOtp("");
          setError("");
        }}
        title={editStep === 1 ? "Edit Staff Member" : "Verify New Staff Email"}
      >
        <form onSubmit={handleUpdateStaff} className="space-y-4">
          {editStep === 1 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                  placeholder="Staff Name"
                  required
                  className="bg-background border-border h-10 text-sm focus:border-primary transition-all placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, email: e.target.value })
                  }
                  placeholder="staff@example.com"
                  required
                  className="bg-background border-border h-10 text-sm focus:border-primary transition-all placeholder:text-muted-foreground"
                />
              </div>

              <div className="border-t border-border pt-4 mt-2">
                <p className="text-sm text-muted-foreground mb-2">
                  Change Password (Optional)
                </p>
                <div className="space-y-2">
                  <Label htmlFor="edit-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="edit-password"
                      type={showEditPassword ? "text" : "password"}
                      value={editFormData.password}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          password: e.target.value,
                        })
                      }
                      placeholder="Leave blank to keep current"
                      className="bg-background border-border h-10 text-sm focus:border-primary transition-all placeholder:text-muted-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showEditPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2 mt-2">
                  <Label htmlFor="edit-confirmPassword">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="edit-confirmPassword"
                      type={showEditConfirmPassword ? "text" : "password"}
                      value={editFormData.confirmPassword}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          confirmPassword: e.target.value,
                        })
                      }
                      placeholder="Leave blank to keep current"
                      className="bg-background border-border h-10 text-sm focus:border-primary transition-all placeholder:text-muted-foreground pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowEditConfirmPassword(!showEditConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showEditConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A verification code has been sent to the new email:{" "}
                <span className="text-foreground font-medium">
                  {editFormData.email}
                </span>
                .
              </p>
              <div className="space-y-2">
                <Label htmlFor="edit-otp">Verification Code</Label>
                <Input
                  id="edit-otp"
                  value={editOtp}
                  onChange={(e) => setEditOtp(e.target.value)}
                  placeholder="123456"
                  required
                  maxLength={6}
                  className="bg-background border-border h-10 focus:border-primary transition-all placeholder:text-muted-foreground text-center text-lg tracking-widest"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  Valid for {Math.floor(editTimer / 60)}:
                  {(editTimer % 60).toString().padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={handleResendEditOtp}
                  disabled={editTimer > 0 || submitLoading}
                  className={`font-medium ${
                    editTimer > 0
                      ? "text-gray-700 cursor-not-allowed"
                      : "text-blue-400 hover:text-blue-300"
                  }`}
                >
                  Resend OTP
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              variant="default"
              className="w-full"
              disabled={submitLoading}
            >
              {submitLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editStep === 1 ? "Save Changes" : "Verify & Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
