/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from "react";
import { CustomerOrder } from "../types";
import { exportToCSV, exportToPDF } from "../utils/export";
import {
  FileDown,
  ShieldCheck,
  DollarSign,
  Percent,
  ShoppingBag,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../lib/supabase"; // Adjust import path if needed for your supabase setup

// Flexible interface accommodating Supabase DB schema (snake_case) & local types (camelCase)
export interface SupabaseCustomerOrder {
  id: string | number;
  customer_id?: string | number;
  customer_name?: string;
  product_name?: string;
  unit_price?: number;
  weight?: number;
  qty?: number;
  quantity?: number;
  total_weight?: number;
  line_total?: number;
  paid_amount?: number;
  remaining_amount?: number;
  created_at?: string;
}

interface CustomerPortalProps {
  customerName: string;
  customerId?: string | number;
  orders?: CustomerOrder[] | SupabaseCustomerOrder[];
  onRefreshData?: () => void;
}

export default function CustomerPortal({
  customerName,
  customerId,
  orders: initialOrders = [],
  onRefreshData,
}: CustomerPortalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize incoming orders (convert snake_case from Supabase DB into standard CustomerOrder format)
  const normalizeOrders = (rawOrders: any[]): CustomerOrder[] => {
    return rawOrders.map((o) => {
      const unitPrice = Number(o.unitPrice ?? o.unit_price ?? 0);
      const qty = Number(o.qty ?? o.quantity ?? 1);
      const weight = Number(o.weight ?? 0);
      const totalWeight = Number(o.totalWeight ?? o.total_weight ?? weight * qty);
      const lineTotal = Number(o.lineTotal ?? o.line_total ?? unitPrice * qty);
      const paidAmount = Number(o.paidAmount ?? o.paid_amount ?? 0);
      const remainingAmount = Number(
        o.remainingAmount ?? o.remaining_amount ?? Math.max(0, lineTotal - paidAmount)
      );

      return {
        id: String(o.id),
        customerId: String(o.customerId ?? o.customer_id ?? customerId ?? ""),
        customer_name: o.customer_name || o.customerName || customerName || "",
        created_at: o.created_at || "",
        updated_at: o.updated_at || o.created_at || "",
        productName: o.productName || o.product_name || "Unassigned Product",
        product_name: o.productName || o.product_name || "Unassigned Product",
        unitPrice,
        unit_price: unitPrice,
        weight,
        qty,
        totalWeight,
        total_weight: totalWeight,
        lineTotal,
        line_total: lineTotal,
        paidAmount,
        paid_amount: paidAmount,
        remainingAmount,
        remaining_amount: remainingAmount,
      };
    });
  };

  // Fetch orders from Supabase DB if customerId is provided
  const fetchSupabaseOrders = async () => {
    if (!customerId && !supabase) return;

    setLoading(true);
    setError(null);

    try {
      // Queries 'customer_orders' or 'orders' table in Supabase
      const { data, error: dbError } = await supabase
        .from("customer_orders")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (dbError) throw dbError;

      if (data) {
        setOrders(normalizeOrders(data));
      }
    } catch (err: any) {
      console.error("Error fetching orders from Supabase:", err);
      setError(err.message || "Failed to sync statement records from database.");
    } finally {
      setLoading(false);
    }
  };

  // Load initial orders or sync from Supabase when customer ID/orders change
  useEffect(() => {
    if (customerId) {
      fetchSupabaseOrders();
    } else if (initialOrders && initialOrders.length > 0) {
      setOrders(normalizeOrders(initialOrders));
    } else {
      setOrders([]);
    }
  }, [customerId, initialOrders]);

  // Filtered orders based on search input
  const filteredOrders = useMemo(() => {
    return orders.filter((o) =>
      o.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);

  // Financial aggregates calculated dynamically from state
  const totalAmount = useMemo(
    () => orders.reduce((sum, o) => sum + (o.line_total || 0), 0),
    [orders]
  );
  const totalPaid = useMemo(
    () => orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0),
    [orders]
  );
  const totalRemaining = useMemo(
    () => orders.reduce((sum, o) => sum + (o.remaining_amount || 0), 0),
    [orders]
  );

  const handleExportCSV = () => {
    exportToCSV(orders, `ASComm_Statement_${customerName.replace(/\s+/g, "_")}.csv`);
  };

  const handleExportPDF = () => {
    exportToPDF(customerName, orders, totalAmount, totalPaid, totalRemaining);
  };

  const handleRefresh = () => {
    if (customerId) {
      fetchSupabaseOrders();
    }
    if (onRefreshData) {
      onRefreshData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-navy-card border border-navy-light p-6 rounded-xl relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent-cyan/5 rounded-full blur-2xl pointer-events-none" />
        <div>
          <div className="flex items-center gap-2 text-accent-cyan text-xs font-bold tracking-widest uppercase mb-1">
            <ShieldCheck className="h-4 w-4" />
            Secure Customer Portal Session
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Welcome back, <span className="text-accent-cyan font-extrabold">{customerName}</span>!
          </h2>
          <p className="text-sm text-slate-custom mt-1">
            Access and download your live itemized statements, product calculations, and outstanding balances powered by Supabase.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            id="customer-refresh-db"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 bg-navy-dark hover:bg-navy-dark/80 text-slate-custom hover:text-white border border-navy-light px-3.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-accent-cyan" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            id="customer-export-csv"
            onClick={handleExportCSV}
            disabled={orders.length === 0}
            className="flex items-center gap-2 bg-navy-dark hover:bg-navy-dark/80 text-accent-cyan border border-accent-cyan/20 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="h-4 w-4" />
            Export CSV
          </button>
          <button
            id="customer-export-pdf"
            onClick={handleExportPDF}
            disabled={orders.length === 0}
            className="flex items-center gap-2 bg-accent-cyan hover:bg-accent-cyan/90 text-navy-dark px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_15px_rgba(100,255,218,0.25)] hover:shadow-[0_0_20px_rgba(100,255,218,0.5)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Database sync error state */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchSupabaseOrders}
            className="underline font-bold hover:text-rose-300 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Financial overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-navy-card border border-navy-light p-5 rounded-xl shadow-lg flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-lg bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-custom uppercase tracking-widest font-semibold">Total Purchased Value</p>
            <p className="text-2xl font-extrabold text-white mt-1">
              ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-navy-card border border-navy-light p-5 rounded-xl shadow-lg flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center text-accent-cyan shrink-0">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-custom uppercase tracking-widest font-semibold">Total Paid Amount</p>
            <p className="text-2xl font-extrabold text-white mt-1">
              ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-navy-card border border-navy-light p-5 rounded-xl shadow-lg flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="w-12 h-12 rounded-lg bg-rose-950/40 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <Percent className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-rose-400 uppercase tracking-widest font-semibold">Outstanding Balance</p>
            <p className="text-2xl font-extrabold text-rose-400 mt-1">
              ${totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Statements grid */}
      <div className="space-y-4">
        <div className="flex bg-navy-card border border-navy-light rounded-xl p-3 shadow-md items-center gap-3">
          <Search className="h-5 w-5 text-slate-custom shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search your purchased items..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none"
          />
        </div>

        <div className="bg-navy-card border border-navy-light rounded-xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-navy-light bg-navy-dark flex justify-between items-center">
            <h3 className="text-sm font-bold text-accent-cyan uppercase tracking-wider">
              Itemized Calculations Grid
            </h3>
            <div className="flex items-center gap-3">
              {loading && <Loader2 className="h-4 w-4 text-accent-cyan animate-spin" />}
              <span className="text-xs font-mono text-slate-custom">
                {filteredOrders.length} Products Logged
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {/* 1. Desktop Data Table */}
            <table className="hidden md:table w-full text-left text-sm text-gray-300">
              <thead className="bg-navy-dark text-xs font-bold text-accent-cyan uppercase tracking-wider border-b border-navy-light">
                <tr>
                  <th className="px-5 py-4">Product Name</th>
                  <th className="px-5 py-4 text-right">Unit Price</th>
                  <th className="px-5 py-4 text-right">Unit Weight</th>
                  <th className="px-5 py-4 text-right">Quantity</th>
                  <th className="px-5 py-4 text-right">Total Weight</th>
                  <th className="px-5 py-4 text-right">Line Total</th>
                  <th className="px-5 py-4 text-right">Paid Amount</th>
                  <th className="px-5 py-4 text-right">Remaining Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-light/30">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-custom">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 text-accent-cyan animate-spin" />
                        <span className="text-xs">Syncing statement data from Supabase...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-navy-dark/30 transition-colors duration-200">
                      <td className="px-5 py-4 font-semibold text-white">{o.product_name}</td>
                      <td className="px-5 py-4 text-right font-mono text-xs">${o.unit_price.toFixed(2)}</td>
                      <td className="px-5 py-4 text-right font-mono text-xs">{o.weight.toFixed(3)} kg</td>
                      <td className="px-5 py-4 text-right font-mono text-xs">{o.qty}</td>
                      <td className="px-5 py-4 text-right font-mono text-xs">{o.total_weight.toFixed(2)} kg</td>
                      <td className="px-5 py-4 text-right font-semibold text-white font-mono text-xs">
                        ${o.line_total.toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-right text-emerald-400 font-mono text-xs">
                        ${o.paid_amount.toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-right font-extrabold text-rose-400 font-mono text-xs">
                        ${o.remaining_amount.toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-custom/60 text-xs">
                      No order statement records found in database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* 2. Mobile Responsive Cards */}
            <div className="block md:hidden p-4 space-y-4">
              {loading ? (
                <div className="text-center py-10 text-slate-custom flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 text-accent-cyan animate-spin" />
                  <span className="text-xs">Loading statement data...</span>
                </div>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((o) => (
                  <div key={o.id} className="bg-navy-dark/40 border border-navy-light p-4 rounded-xl space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <h5 className="font-bold text-white text-sm">{o.product_name}</h5>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          o.remaining_amount > 0
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {o.remaining_amount > 0 ? "Receivable" : "Settled"}
                      </span>
                    </div>

                    {/* Calculations Matrix Grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-custom pt-2 border-t border-navy-light/40">
                      <div>
                        <span className="block text-[10px] uppercase text-slate-custom/60">Unit Price</span>
                        <span className="font-semibold font-mono text-white">${o.unit_price.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-slate-custom/60">Quantity</span>
                        <span className="font-semibold font-mono text-white">{o.qty} pcs</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-slate-custom/60">Unit Weight</span>
                        <span className="font-semibold font-mono text-white">{o.weight.toFixed(3)} kg</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-slate-custom/60">Total Weight</span>
                        <span className="font-semibold font-mono text-accent-cyan">{o.total_weight.toFixed(2)} kg</span>
                      </div>
                      <div className="col-span-2 py-1.5 my-1 bg-navy-dark/60 rounded px-2 flex justify-between">
                        <div>
                          <span className="block text-[10px] uppercase text-slate-custom/60">Line Total</span>
                          <span className="font-extrabold font-mono text-white text-sm">${o.line_total.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] uppercase text-slate-custom/60">Paid Amount</span>
                          <span className="font-extrabold font-mono text-emerald-400 text-sm">${o.paid_amount.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="col-span-2 flex justify-between items-center bg-rose-500/5 rounded border border-rose-500/10 px-2.5 py-1.5">
                        <span className="text-rose-400 font-semibold text-[11px] uppercase tracking-wider">Remaining Balance</span>
                        <span className="font-mono font-black text-rose-400 text-sm">${o.remaining_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-slate-custom/60 text-xs">
                  No statement records found.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}