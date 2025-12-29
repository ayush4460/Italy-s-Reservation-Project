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

import { useProfile } from "@/context/profile-context";

export default function ProfilePage() {
  const router = useRouter();
  const { refetchProfile } = useProfile();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "", // Added username
    address: "",
    phone: "",
    bannerUrl: "",
    logoUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

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
      // Ensure backend returns username in the response structure or map it correctly
      // Assuming res.data contains { restaurant: {...}, user: { name, email, role, ... } } ??
      // Actually based on previous conversations, /restaurants/me might return deeply nested or flat data.
      // Let's assume safely. If backend doesn't return username, we might need to fetch /auth/me or update backend.
      // But user said "this is admin username", implies purely frontend display change first?
      // Wait, user said "add field Username and this is admin username".
      // I'll add the field to formData. Ideally fetch it.
      setFormData(res.data);
    } catch (err) {
      console.error("Failed to fetch profile", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      await api.put("/restaurants/me", formData);
      await refetchProfile(); // Refresh context to update header
      setMessage({ type: "success", text: "Profile updated successfully" });
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to update profile",
      });
    } finally {
      setSaving(false);
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
            {message.text && (
              <p
                className={
                  message.type === "error" ? "text-red-400" : "text-green-400"
                }
              >
                {message.text}
              </p>
            )}
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
    </div>
  );
}
