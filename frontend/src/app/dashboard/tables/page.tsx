"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Plus, Trash2, Armchair, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/context/profile-context";

interface Table {
  id: number;
  tableNumber: string;
  capacity: number;
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ tableNumber: "", capacity: "" });

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [editFormData, setEditFormData] = useState({
    tableNumber: "",
    capacity: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const { user: profileUser } = useProfile();
  const role = profileUser?.role || null;

  useEffect(() => {
    // Role is now derived from profile context
  }, []);

  const fetchTables = async () => {
    try {
      const res = await api.get("/tables");
      setTables(res.data);
    } catch (err) {
      console.error("Failed to fetch tables", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/tables", formData);
      setFormData({ tableNumber: "", capacity: "" });
      setIsModalOpen(false);
      fetchTables();
      toast.success("Table created successfully");
    } catch (err: unknown) {
      toast.error(
        (err as ApiError).response?.data?.message || "Failed to create table",
      );
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this table?")) return;
    try {
      await api.delete(`/tables/${id}`);
      fetchTables();
      toast.success("Table deleted successfully");
    } catch (err) {
      console.error("Failed to delete table", err);
      toast.error("Failed to delete table");
    }
  };

  const handleEditClick = (table: Table) => {
    setEditingTable(table);
    setEditFormData({
      tableNumber: table.tableNumber,
      capacity: table.capacity.toString(),
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    setEditLoading(true);
    try {
      await api.put(`/tables/${editingTable.id}`, editFormData);
      setIsEditModalOpen(false);
      setEditingTable(null);
      fetchTables();
      toast.success("Table updated successfully");
    } catch (err: unknown) {
      const errorMessage =
        (err as ApiError).response?.data?.message || "Failed to update table";
      toast.error(errorMessage);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="pt-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Table Management
        </h2>
        {role === "ADMIN" && (
          <Button
            onClick={() => setIsModalOpen(true)}
            className="h-9 sm:h-10 text-xs sm:text-sm"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Table
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading tables...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {tables.map((table) => (
            <Card
              key={table.id}
              className="bg-card text-card-foreground border border-border shadow-sm hover:bg-muted/50 transition-colors group"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">
                  Table {table.tableNumber}
                </CardTitle>
                <Armchair className="h-5 w-5 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Capacity: {table.capacity} People
                </p>
              </CardContent>
              {role === "ADMIN" && (
                <CardFooter className="justify-end pt-0 lg:opacity-0 lg:group-hover:opacity-100 transition-all gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                    onClick={() => handleEditClick(table)}
                    title="Edit Table"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={() => handleDelete(table.id)}
                    title="Delete Table"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add Table Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Table"
      >
        <form onSubmit={handleAddTable} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tableNumber">Table Number</Label>
            <Input
              id="tableNumber"
              value={formData.tableNumber}
              onChange={(e) =>
                setFormData({ ...formData, tableNumber: e.target.value })
              }
              placeholder="e.g. A1 or 01"
              required
              className="bg-background text-foreground border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              value={formData.capacity}
              onChange={(e) =>
                setFormData({ ...formData, capacity: e.target.value })
              }
              placeholder="e.g. 4"
              required
              className="bg-background text-foreground border-border"
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" className="w-full">
              Create Table
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Table Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Table"
      >
        <form onSubmit={handleUpdateTable} className="space-y-4">
          <div className="space-y-2">
            <Label>Table Number</Label>
            <Input
              value={editFormData.tableNumber}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  tableNumber: e.target.value,
                })
              }
              placeholder="e.g. A1 or 01"
              required
              className="bg-background text-foreground border-border"
            />
          </div>
          <div className="space-y-2">
            <Label>Capacity</Label>
            <Input
              type="number"
              value={editFormData.capacity}
              onChange={(e) =>
                setEditFormData({ ...editFormData, capacity: e.target.value })
              }
              placeholder="e.g. 4"
              required
              className="bg-background text-foreground border-border"
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" className="w-full" disabled={editLoading}>
              {editLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Update Table
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
