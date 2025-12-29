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
import { Plus, Trash2, User, Loader2, Pencil } from "lucide-react";
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

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

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

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitLoading(true);
    try {
      await api.post("/staff", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });
      setFormData({ name: "", email: "", password: "", confirmPassword: "" });
      setIsModalOpen(false);
      fetchStaff();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const errorMessage =
        error.response?.data?.message || "Failed to create staff";
      setError(errorMessage);
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
    setIsEditModalOpen(true);
    setError("");
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setError("");

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
      });
      setIsEditModalOpen(false);
      setEditingId(null);
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

  if (loading) return <div className="text-white p-8">Loading staff...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Manage Staff</h2>
          <p className="text-gray-400">
            Add and manage staff members with view-only access.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="glass-button">
          <Plus className="mr-2 h-4 w-4" /> Add Staff
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staffList.map((staff) => (
          <Card
            key={staff.id}
            className="glass-panel border-none text-white hover:bg-white/5 transition-colors"
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="h-12 w-12 rounded-full bg-linear-to-tr from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 overflow-hidden">
                <CardTitle className="text-lg truncate">{staff.name}</CardTitle>
                <CardDescription className="text-gray-300 truncate">
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
          <div className="col-span-full text-center text-gray-500 py-12">
            No staff members found.
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Staff Member"
      >
        <form onSubmit={handleCreateStaff} className="space-y-4">
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
              className="glass-input"
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
              className="glass-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="••••••••"
              required
              className="glass-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              placeholder="••••••••"
              required
              className="glass-input"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              className="glass-button w-full"
              disabled={submitLoading}
            >
              {submitLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Staff Member"
      >
        <form onSubmit={handleUpdateStaff} className="space-y-4">
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
              className="glass-input"
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
              className="glass-input"
            />
          </div>

          <div className="border-t border-white/10 pt-4 mt-2">
            <p className="text-sm text-gray-400 mb-2">
              Change Password (Optional)
            </p>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password</Label>
              <Input
                id="edit-password"
                type="password"
                value={editFormData.password}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, password: e.target.value })
                }
                placeholder="Leave blank to keep current"
                className="glass-input"
              />
            </div>
            <div className="space-y-2 mt-2">
              <Label htmlFor="edit-confirmPassword">Confirm New Password</Label>
              <Input
                id="edit-confirmPassword"
                type="password"
                value={editFormData.confirmPassword}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Leave blank to keep current"
                className="glass-input"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              className="glass-button w-full"
              disabled={submitLoading}
            >
              {submitLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
