"use client";

import React, { useState, useEffect } from "react";
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

export default function ProfilePage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    phone: "",
    bannerUrl: "",
    logoUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/restaurants/me");
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
      <h2 className="text-3xl font-bold text-white mb-8">Restaurant Profile</h2>

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
                <Label htmlFor="email">Email (Read Only)</Label>
                <Input
                  id="email"
                  name="email"
                  value={formData.email}
                  readOnly
                  className="glass-input opacity-70 cursor-not-allowed"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bannerUrl">Banner Image URL</Label>
                <Input
                  id="bannerUrl"
                  name="bannerUrl"
                  value={formData.bannerUrl || ""}
                  onChange={handleChange}
                  placeholder="https://example.com/banner.jpg"
                  className="glass-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo Image URL</Label>
                <Input
                  id="logoUrl"
                  name="logoUrl"
                  value={formData.logoUrl || ""}
                  onChange={handleChange}
                  placeholder="https://example.com/logo.jpg"
                  className="glass-input"
                />
              </div>
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
