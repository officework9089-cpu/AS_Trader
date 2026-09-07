/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, useMemo , useRef} from "react";
import { SupplierInventory } from "../types";
import {
  Plus,
  Trash,
  Edit,
  Calendar,
  Package,
  DollarSign,
  Weight,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";


// Flexible interface supporting both camelCase and Supabase snake_case schemas
export interface SupabaseSupplierInventory {
  id: string | number;
  supplier_name?: string;
  item_type?: string;
  quantity?: string | number;
  cost_price?: number;
  sourcing_weight?: number;
  date_received?: string;
  created_at?: string;
}

interface SupplierTrackingProps {
  inventory?: SupplierInventory[] | SupabaseSupplierInventory[];
  onAddOrUpdate?: (item: Omit<SupplierInventory, "id"> & { id?: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onRefreshData?: () => void;
}

export default function SupplierTracking({
  inventory: initialInventory = [],
  onAddOrUpdate,
  onDelete,
  onRefreshData,
}: SupplierTrackingProps) {
  const [inventory, setInventory] = useState<SupplierInventory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [syncError, setSyncError] = useState<string | null>(null);

  // Form states
  const [supplier_name, setsupplier_name] = useState("");
  const [item_type, setitem_type] = useState("");
  const [quantity, setQuantity] = useState("");
  const [cost_price, setcost_price] = useState<number | "">("");
  const [sourcing_weight, setsourcing_weight] = useState<number | "">("");
  const [date_received, setdate_received] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Normalize incoming records from Supabase (snake_case) or standard local state (camelCase)
  const normalizeInventory = (rawItems: any[]): SupplierInventory[] => {
    return rawItems.map((item) => ({
      id: String(item.id),
      supplier_name: item.supplier_name || item.supplier_name || "Unknown Supplier",
      item_type: item.item_type || item.item_type || "General",
      quantity: String(item.quantity ?? "1"),
      cost_price: Number(item.cost_price ?? item.cost_price ?? 0),
      sourcing_weight: Number(item.sourcing_weight ?? item.sourcing_weight ?? 0),
      date_received:
        item.date_received ||
        item.date_received ||
        new Date().toISOString().split("T")[0],
    }));
  };

  // Fetch supplier inventory from Supabase database
  const fetchSupabaseInventory = async () => {
    if (!supabase) return;

    setLoading(true);
    setSyncError(null);

    try {
      const { data, error } = await supabase
        .from("supplier_inventory")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        setInventory(normalizeInventory(data));
      }
    } catch (err: any) {
      console.error("Error fetching supplier inventory from Supabase:", err);
      setSyncError(err.message || "Failed to sync supplier inventory from database.");
    } finally {
      setLoading(false);
    }
  };

  // Sync initial inventory prop or fetch directly from Supabase
  useEffect(() => {
    if (initialInventory && initialInventory.length > 0) {
      setInventory(normalizeInventory(initialInventory));
    } else {
      fetchSupabaseInventory();
    }
  }, [initialInventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(
      (item) =>
        item.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  const totalCost = useMemo(
    () =>
      inventory.reduce(
        (sum, item) => sum + item.cost_price * (parseFloat(item.quantity) || 1),
        0
      ),
    [inventory]
  );

  const totalWeight = useMemo(
    () => inventory.reduce((sum, item) => sum + item.sourcing_weight, 0),
    [inventory]
  );

  const resetForm = () => {
    setsupplier_name("");
    setitem_type("");
    setQuantity("");
    setcost_price("");
    setsourcing_weight("");
    setdate_received(new Date().toISOString().split("T")[0]);
    setIsEditing(false);
    setEditId(undefined);
    setFormError("");
  };

  const handleEdit = (item: SupplierInventory) => {
    setsupplier_name(item.supplier_name);
    setitem_type(item.item_type);
    setQuantity(item.quantity);
    setcost_price(item.cost_price);
    setsourcing_weight(item.sourcing_weight);
    setdate_received(item.date_received);
    setEditId(item.id);
    setIsEditing(true);
  };


const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  const numCost = Number(cost_price);
  const numWeight = Number(sourcing_weight);

  // Validate form fields
  if (
    !supplier_name.trim() ||
    !item_type.trim() ||
    !quantity.trim() ||
    cost_price === "" ||
    isNaN(numCost) ||
    numCost < 0 ||
    sourcing_weight === "" ||
    isNaN(numWeight) ||
    numWeight < 0 ||
    !date_received
  ) {
    setFormError("All fields are required and numeric values must not be negative.");
    return;
  }

  setIsSubmitting(true);
  setFormError("");

  const recordPayload = {
    supplier_name: supplier_name.trim(),
    item_type: item_type.trim(),
    quantity: quantity.trim(),
    cost_price: numCost,
    sourcing_weight: numWeight,
    date_received,
  };

  // Replace lines inside handleSubmit in SupplierTracking.tsx:

try {
  if (onAddOrUpdate) {
    // Ensure id is passed if editing, or generate a new UUID if inserting
    await onAddOrUpdate({
      id: editId || crypto.randomUUID(),
      ...recordPayload,
    });
  } else if (supabase) {
    if (editId) {
      // Update existing record
      const { error } = await supabase
        .from("supplier_inventory")
        .update(recordPayload)
        .eq("id", editId);

      if (error) throw error;
    } else {
      // Insert new record with UUID
      const { error } = await supabase
        .from("supplier_inventory")
        .insert([
          {
            id: crypto.randomUUID(),
            ...recordPayload,
          },
        ]);

      if (error) throw error;
    }
    await fetchSupabaseInventory();
  }

  resetForm();
} catch (err: unknown) {
    const errorMsg =
      err instanceof Error
        ? err.message
        : "Failed to save supplier inventory batch.";
    setFormError(errorMsg);
  } finally {
    setIsSubmitting(false);
  }
};

  const handleDeleteItem = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete this shipment from ${name}?`)) {
      return;
    }

    try {
      if (onDelete) {
        await onDelete(id);
      } else if (supabase) {
        const { error } = await supabase
          .from("supplier_inventory")
          .delete()
          .eq("id", id);
        if (error) throw error;
        await fetchSupabaseInventory();
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message || "Unknown error"}`);
    }
  };

  const handleRefresh = () => {
    fetchSupabaseInventory();
    if (onRefreshData) onRefreshData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Supplier Sourcing & Inventory
          </h2>
          <p className="text-sm text-slate-custom">
            Track and manage inventory batches, sourcing costs, and product acquisition logistics.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 bg-navy-card hover:bg-navy-dark text-slate-custom hover:text-white border border-navy-light px-3.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all shadow-md cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-accent-cyan" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Sync error banner */}
      {syncError && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{syncError}</span>
          </div>
          <button
            onClick={fetchSupabaseInventory}
            className="underline font-bold hover:text-rose-300 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Aggregate metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-navy-card border border-navy-light p-5 rounded-xl shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-navy-dark flex items-center justify-center text-accent-cyan shadow-md border border-navy-light">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-custom uppercase tracking-widest font-semibold">
              Total Sourced Shipments
            </p>
            <p className="text-2xl font-bold text-white mt-1">{inventory.length} Batches</p>
          </div>
        </div>

        <div className="bg-navy-card border border-navy-light p-5 rounded-xl shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-navy-dark flex items-center justify-center text-accent-cyan shadow-md border border-navy-light">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-custom uppercase tracking-widest font-semibold">
              Total Sourcing Cost
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-navy-card border border-navy-light p-5 rounded-xl shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-navy-dark flex items-center justify-center text-accent-cyan shadow-md border border-navy-light">
            <Weight className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-custom uppercase tracking-widest font-semibold">
              Total Sourced Weight
            </p>
            <p className="text-2xl font-bold text-white mt-1">{totalWeight.toFixed(2)} kg</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form panel */}
        <div className="lg:col-span-1 bg-navy-card border border-navy-light rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-accent-cyan"></div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            {isEditing ? <Edit className="h-5 w-5 text-accent-cyan" /> : <Plus className="h-5 w-5 text-accent-cyan" />}
            {isEditing ? "Modify Shipment" : "Log Sourced Shipment"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1.5">
                Supplier Name
              </label>
              <input
                type="text"
                value={supplier_name}
                onChange={(e) => setsupplier_name(e.target.value)}
                placeholder='e.g., "John" or "David Textiles"'
                className="w-full bg-navy-dark border border-navy-light rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1.5">
                Item Type / Description
              </label>
              <input
                type="text"
                value={item_type}
                onChange={(e) => setitem_type(e.target.value)}
                placeholder='e.g., "Shirts", "Fabrics"'
                className="w-full bg-navy-dark border border-navy-light rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1.5">
                  Quantity
                </label>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder='e.g., "13pcs", "50m"'
                  className="w-full bg-navy-dark border border-navy-light rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1.5">
                  Unit Cost ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cost_price}
                  onChange={(e) => setcost_price(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-navy-dark border border-navy-light rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1.5">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={sourcing_weight}
                  onChange={(e) => setsourcing_weight(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-navy-dark border border-navy-light rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1.5">
                  Date Received
                </label>
                <input
                  type="date"
                  value={date_received}
                  onChange={(e) => setdate_received(e.target.value)}
                  className="w-full bg-navy-dark border border-navy-light rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-accent-cyan transition-all"
                  required
                />
              </div>
            </div>

            {formError && (
              <p className="text-xs font-semibold text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
                {formError}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                id="supplier-form-submit"
                disabled={isSubmitting}
                className="flex-1 bg-accent-cyan hover:bg-accent-cyan/90 text-navy-dark font-bold py-2 px-4 rounded-lg text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{isEditing ? "Update Batch" : "Log Batch"}</span>
              </button>
              {isEditing && (
                <button
                  type="button"
                  id="supplier-form-cancel"
                  onClick={resetForm}
                  className="bg-transparent border border-navy-light hover:bg-navy-dark text-slate-custom hover:text-white font-semibold py-2 px-4 rounded-lg text-sm transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List Grid Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex bg-navy-card border border-navy-light rounded-xl p-3 shadow-md items-center gap-3">
            <Search className="h-5 w-5 text-slate-custom" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by supplier name or item type..."
              className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none"
            />
          </div>

          <div className="bg-navy-card border border-navy-light rounded-xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              {/* Desktop Table View */}
              <table className="hidden md:table w-full text-left text-sm text-gray-300">
                <thead className="bg-navy-dark text-xs font-bold text-accent-cyan uppercase tracking-wider border-b border-navy-light">
                  <tr>
                    <th className="px-5 py-4">Supplier</th>
                    <th className="px-5 py-4">Item Type</th>
                    <th className="px-5 py-4">Quantity</th>
                    <th className="px-5 py-4">Unit Cost</th>
                    <th className="px-5 py-4">Weight</th>
                    <th className="px-5 py-4">Date Recv</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-light/30">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-custom">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 text-accent-cyan animate-spin" />
                          <span className="text-xs">Fetching supplier records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredInventory.length > 0 ? (
                    filteredInventory.map((item) => (
                      <tr key={item.id} className="hover:bg-navy-dark/30 transition-colors duration-200">
                        <td className="px-5 py-4 font-semibold text-white">{item.supplier_name}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded-md bg-accent-cyan/10 px-2 py-1 text-xs font-medium text-accent-cyan ring-1 ring-inset ring-accent-cyan/20">
                            {item.item_type}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs">{item.quantity}</td>
                        <td className="px-5 py-4 font-mono text-xs">${item.cost_price.toFixed(2)}</td>
                        <td className="px-5 py-4 font-mono text-xs">{item.sourcing_weight.toFixed(2)} kg</td>
                        <td className="px-5 py-4 text-xs font-mono">
                          <div className="flex items-center gap-1.5 text-slate-custom">
                            <Calendar className="h-3.5 w-3.5" />
                            {item.date_received}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-2.5">
                            <button
                              id={`supplier-edit-${item.id}`}
                              onClick={() => handleEdit(item)}
                              className="p-1.5 rounded-lg border border-accent-cyan/20 hover:border-accent-cyan/50 text-accent-cyan hover:bg-navy-dark transition-all"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              id={`supplier-delete-${item.id}`}
                              onClick={() => handleDeleteItem(item.id, item.supplier_name)}
                              className="p-1.5 rounded-lg border border-rose-500/20 hover:border-rose-500/50 text-rose-400 hover:bg-rose-500/10 transition-all"
                              title="Delete"
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-custom/60">
                        No supplier inventory logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Mobile Card View */}
              <div className="block md:hidden p-4 space-y-4">
                {loading ? (
                  <div className="text-center py-8 text-slate-custom flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 text-accent-cyan animate-spin" />
                    <span className="text-xs">Loading supplier records...</span>
                  </div>
                ) : filteredInventory.length > 0 ? (
                  filteredInventory.map((item) => (
                    <div key={item.id} className="bg-navy-dark/40 border border-navy-light p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <h5 className="font-bold text-white text-sm">{item.supplier_name}</h5>
                        <span className="inline-flex items-center rounded bg-accent-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-accent-cyan ring-1 ring-inset ring-accent-cyan/20 uppercase tracking-widest">
                          {item.item_type}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-custom pt-2 border-t border-navy-light/40">
                        <div>
                          <span className="block text-[10px] uppercase text-slate-custom/60">Quantity</span>
                          <span className="font-semibold font-mono text-white">{item.quantity}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase text-slate-custom/60">Unit Cost</span>
                          <span className="font-semibold font-mono text-white">${item.cost_price.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase text-slate-custom/60">Sourcing Weight</span>
                          <span className="font-semibold font-mono text-white">{item.sourcing_weight.toFixed(2)} kg</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase text-slate-custom/60">Date Received</span>
                          <span className="font-semibold font-mono text-white">{item.date_received}</span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-navy-light/40">
                        <button
                          id={`supplier-edit-mob-${item.id}`}
                          onClick={() => handleEdit(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-dark border border-navy-light text-accent-cyan text-xs font-semibold hover:bg-navy-dark/80 transition"
                        >
                          <Edit className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          id={`supplier-delete-mob-${item.id}`}
                          onClick={() => handleDeleteItem(item.id, item.supplier_name)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-dark border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition"
                        >
                          <Trash className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-6 text-slate-custom/60 text-xs">
                    No supplier inventory logs found.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}