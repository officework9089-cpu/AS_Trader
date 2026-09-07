/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { CustomerOrder } from "../types";
import { exportToCSV, exportToPDF } from "../utils/export";
import { supabase } from "../lib/supabase";
import {
  Plus,
  Trash,
  Edit,
  Search,
  Users,
  TrendingUp,
  FileDown,
  Check,
  X,
  Loader2,
} from "lucide-react";

interface CustomerRecord {
  id: string;
  username?: string;
  customer_name?: string;
  customerName?: string;
  email?: string;
  total_amount?: number;
  totalAmount?: number;
  total_paid?: number;
  totalPaid?: number;
  total_remaining?: number;
  totalRemaining?: number;
  orderCount?: number;
}

interface AdminDashboardProps {
  orders: CustomerOrder[];
  customers: CustomerRecord[];
  stats?: {
    activeCustomers?: number;
    totalTransactions?: number;
    totalCollected?: number;
    totalReceivables?: number;
    totalSourcingCost?: number;
  };
  onAddOrUpdateOrder: (order: any) => Promise<void>;
  onDeleteOrder: (id: string) => Promise<void>;
  activeSubTab: string; // 'overview' | 'customers'
}

// Helper utility to safely format numeric values without throwing TypeError
const formatCurrency = (val: any, decimals: number = 2): string => {
  const num = Number(val);
  return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

export default function AdminDashboard({
  orders = [],
  customers: initialCustomers = [],
  stats = {},
  onAddOrUpdateOrder,
  onDeleteOrder,
  activeSubTab,
}: AdminDashboardProps) {
  const [customers, setCustomers] = useState<CustomerRecord[]>(initialCustomers || []);
  const [isFetchingCustomers, setIsFetchingCustomers] = useState<boolean>(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");

  // Inline grid states
  const [localOrders, setLocalOrders] = useState<CustomerOrder[]>([]);
  const [editingIds, setEditingIds] = useState<string[]>([]);
  const [savingIds, setSavingIds] = useState<string[]>([]);

  // Safely load customer data and billing metrics from Supabase
  const loadCustomersData = async () => {
    setIsFetchingCustomers(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, username, customer_name, email, role, status")
        .eq("role", "customer")
        .eq("status", "active")
        .order("customer_name", { ascending: true });

      if (usersError) throw usersError;

      const { data: ordersData, error: ordersError } = await supabase
        .from("customer_orders")
        .select("customer_id, line_total, paid_amount, remaining_amount");

      if (ordersError) throw ordersError;

      const mappedCustomers: CustomerRecord[] = (usersData || []).map((user) => {
        const userOrders = (ordersData || []).filter((o) => o.customer_id === user.id);

        const totalAmount = userOrders.reduce((sum, o) => sum + Number(o.line_total || 0), 0);
        const totalPaid = userOrders.reduce((sum, o) => sum + Number(o.paid_amount || 0), 0);
        const totalRemaining = userOrders.reduce((sum, o) => sum + Number(o.remaining_amount || 0), 0);

        return {
          id: user.id,
          username: user.username,
          customer_name: user.customer_name,
          customerName: user.customer_name || user.username || user.email || "N/A",
          email: user.email,
          total_amount: totalAmount,
          totalAmount: totalAmount,
          total_paid: totalPaid,
          totalPaid: totalPaid,
          total_remaining: totalRemaining,
          totalRemaining: totalRemaining,
          orderCount: userOrders.length,
        };
      });

      setCustomers(mappedCustomers);
    } catch (err) {
      console.error("Failed to load customer profiles:", err);
      setCustomers(initialCustomers || []);
    } finally {
      setIsFetchingCustomers(false);
    }
  };

  useEffect(() => {
    loadCustomersData();
  }, [orders]);

  useEffect(() => {
    if (initialCustomers && initialCustomers.length > 0 && customers.length === 0) {
      setCustomers(initialCustomers);
    }
  }, [initialCustomers]);

  useEffect(() => {
    if (!selectedCustomerId && customers.length > 0) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId);
  const filteredCustomers = customers.filter((c) => {
    const nameStr = (c.customer_name || c.customerName || c.username || c.email || "").toLowerCase();
    return nameStr.includes(customerSearchTerm.toLowerCase());
  });

  useEffect(() => {
    setLocalOrders((prev) => {
      const tempRows = prev.filter(
        (o) =>
          o.id.startsWith("temp_") &&
          ((o as any).customerId === selectedCustomerId || (o as any).customer_id === selectedCustomerId)
      );

      const dbActiveOrders = (orders || []).filter(
        (o) => (o as any).customerId === selectedCustomerId || (o as any).customer_id === selectedCustomerId
      );

      const mergedRows = dbActiveOrders.map((serverOrder) => {
        const localRow = prev.find((o) => o.id === serverOrder.id && editingIds.includes(serverOrder.id));
        return localRow || serverOrder;
      });

      return [...mergedRows, ...tempRows];
    });
  }, [orders, selectedCustomerId, editingIds]);

  useEffect(() => {
    setEditingIds([]);
    setSavingIds([]);
  }, [selectedCustomerId]);

  const handleAddProduct = () => {
    const tempId = `temp_${Date.now()}`;
    const activeDisplayName =
      activeCustomer?.customer_name || activeCustomer?.customerName || activeCustomer?.username || "";

    const newOrder: any = {
      id: tempId,
      customer_id: selectedCustomerId,
      customerId: selectedCustomerId,
      customer_name: activeDisplayName,
      customerName: activeDisplayName,
      product_name: "",
      productName: "",
      unit_price: 0,
      unitPrice: 0,
      weight: 0,
      qty: 1,
      total_weight: 0,
      line_total: 0,
      lineTotal: 0,
      paid_amount: 0,
      paidAmount: 0,
      remaining_amount: 0,
      remainingAmount: 0,
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setLocalOrders((prev) => [...prev, newOrder]);
    setEditingIds((prev) => [...prev, tempId]);
  };

  const handleInputChange = (id: string, field: string, value: any) => {
    setLocalOrders((prev) =>
      prev.map((o: any) => {
        if (o.id === id) {
          let updated = { ...o };
          if (field === "productName" || field === "product_name") {
            updated.productName = value;
            updated.product_name = value;
          } else if (field === "unitPrice" || field === "unit_price") {
            const num = parseFloat(value) || 0;
            updated.unitPrice = num;
            updated.unit_price = num;
          } else if (field === "weight") {
            const num = parseFloat(value) || 0;
            updated.weight = num;
          } else if (field === "qty") {
            const num = parseInt(value, 10) || 0;
            updated.qty = num;
          } else if (field === "paidAmount" || field === "paid_amount") {
            const num = parseFloat(value) || 0;
            updated.paidAmount = num;
            updated.paid_amount = num;
          }

          const w = Number(updated.weight || 0);
          const q = Number(updated.qty || 0);
          const up = Number(updated.unitPrice ?? updated.unit_price ?? 0);
          const pa = Number(updated.paidAmount ?? updated.paid_amount ?? 0);

          const calculatedTotalWeight = Number((w * q).toFixed(4));
          const calculatedLineTotal = Number((calculatedTotalWeight * up).toFixed(2));
          const calculatedRemaining = Number((calculatedLineTotal - pa).toFixed(2));

          updated.total_weight = calculatedTotalWeight;
          updated.line_total = calculatedLineTotal;
          updated.remaining_amount = calculatedRemaining;

          return updated;
        }
        return o;
      })
    );
  };
const handleSaveRow = async (id: string) => {
  const order: any = localOrders.find((o) => o.id === id);
  if (!order) return;

  const name = order.productName || order.product_name || "";

  if (!name.trim()) {
    alert("Product Name is required.");
    return;
  }

  // Always use the selected customer's ID.
  // This ID comes directly from public.users.
  const customerId = selectedCustomerId;

  if (!customerId) {
    alert("Please select a customer first.");
    return;
  }

  setSavingIds((prev) => [...prev, id]);

  try {
    const activeDisplayName =
      activeCustomer?.customer_name ||
      activeCustomer?.customerName ||
      activeCustomer?.username ||
      "";

    const payload: any = {
      customer_id: customerId,
      customer_name:
        activeDisplayName ||
        order.customerName ||
        order.customer_name ||
        "",

      product_name: name.trim(),

      unit_price: Number(
        order.unitPrice ?? order.unit_price ?? 0
      ),

      weight: Number(order.weight ?? 0),

      qty: Number(order.qty ?? 0),

      paid_amount: Number(
        order.paidAmount ?? order.paid_amount ?? 0
      ),
    };

    // Only include ID when updating an existing order
    if (!id.startsWith("temp_")) {
      payload.id = id;
    }

    console.log("Saving customer order:", payload);

    await onAddOrUpdateOrder(payload);

    setEditingIds((prev) =>
      prev.filter((eid) => eid !== id)
    );

    await loadCustomersData();

  } catch (err: any) {
    console.error(
      "Error while inserting/updating order:",
      err
    );

    alert(
      err?.message ||
      "Failed to save calculation entry."
    );

  } finally {
    setSavingIds((prev) =>
      prev.filter((eid) => eid !== id)
    );
  }
};

  const handleCancelEdit = (id: string) => {
    setEditingIds((prev) => prev.filter((eid) => eid !== id));
    if (id.startsWith("temp_")) {
      setLocalOrders((prev) => prev.filter((o) => o.id !== id));
    }
  };

  const handleEditClick = (id: string) => {
    setEditingIds((prev) => [...prev, id]);
  };

  const handleDeleteClick = async (id: string, prodName: string) => {
    if (id.startsWith("temp_")) {
      setLocalOrders((prev) => prev.filter((o) => o.id !== id));
      setEditingIds((prev) => prev.filter((eid) => eid !== id));
      return;
    }
    if (window.confirm(`Are you sure you want to delete the billing entry for "${prodName}"?`)) {
      try {
        await onDeleteOrder(id);
        await loadCustomersData();
      } catch (err: any) {
        alert(err.message || "Failed to delete item.");
      }
    }
  };

  const localTotalAmount = localOrders.reduce(
    (sum, o: any) => sum + Number(o.lineTotal ?? o.line_total ?? 0),
    0
  );
  const localTotalPaid = localOrders.reduce(
    (sum, o: any) => sum + Number(o.paidAmount ?? o.paid_amount ?? 0),
    0
  );
  const localTotalRemaining = localOrders.reduce(
    (sum, o: any) => sum + Number(o.remainingAmount ?? o.remaining_amount ?? 0),
    0
  );

  const handleExportCSV = () => {
    if (!activeCustomer) return;
    const name = activeCustomer.customer_name || activeCustomer.customerName || "Customer";
    exportToCSV(localOrders, `ASComm_Statement_${name.replace(/\s+/g, "_")}.csv`);
  };

  const handleExportPDF = () => {
    if (!activeCustomer) return;
    const name = activeCustomer.customer_name || activeCustomer.customerName || "Customer";
    exportToPDF(
      name,
      localOrders,
      localTotalAmount,
      localTotalPaid,
      localTotalRemaining
    );
  };

  // ----------------------------------------------------
  // OVERVIEW TAB VIEW
  // ----------------------------------------------------
  if (activeSubTab === "overview") {
    const totalTransactions = Number(stats.totalTransactions || 0);
    const totalCollected = Number(stats.totalCollected || 0);
    const totalSourcingCost = Number(stats.totalSourcingCost || 0);

    const collectionRate =
      totalTransactions > 0
        ? (totalCollected / totalTransactions) * 100
        : 0;

    const sourcingMargin =
      totalSourcingCost > 0
        ? ((totalTransactions - totalSourcingCost) / totalSourcingCost) * 100
        : 0;

    return (
      <div className="space-y-6">
        {/* Banner */}
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">System Overview</h2>
          <p className="text-sm text-slate-custom">
            Welcome to the ASComm administrative command center. Real-time billing and sourcing metrics.
          </p>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-navy-card border border-navy-light p-5 rounded-xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-accent-cyan/5 rounded-full blur-xl pointer-events-none"></div>
            <p className="text-xs text-slate-custom uppercase tracking-widest font-semibold">
              Outstanding Receivables
            </p>
            <p className="text-2xl font-extrabold text-rose-400 mt-2">
              ${(stats.totalReceivables || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 text-xs text-slate-custom/80 flex items-center gap-1">
              <span className="text-rose-400 font-semibold font-mono">Uncollected balance</span> from customers
            </div>
          </div>

          <div className="bg-navy-card border border-navy-light p-5 rounded-xl shadow-lg">
            <p className="text-xs text-slate-custom uppercase tracking-widest font-semibold">
              Total Invoice Billings
            </p>
            <p className="text-2xl font-extrabold text-white mt-2">
              {(stats.totalTransactions || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 text-xs text-slate-custom/80 flex items-center gap-1">
              Total volume across all customer profiles
            </div>
          </div>

          <div className="bg-navy-card border border-navy-light p-5 rounded-xl shadow-lg">
            <p className="text-xs text-slate-custom uppercase tracking-widest font-semibold">
              Collected Cashflow
            </p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-2">
              ${(stats.totalCollected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 text-xs text-slate-custom/80 flex items-center gap-1">
              <span className="text-emerald-400 font-semibold font-mono">
                {collectionRate.toFixed(1)}%
              </span> recovery rate
            </div>
          </div>

          <div className="bg-navy-card border border-navy-light p-5 rounded-xl shadow-lg">
            <p className="text-xs text-slate-custom uppercase tracking-widest font-semibold">
              Sourcing Acquisition Costs
            </p>
            <p className="text-2xl font-extrabold text-accent-cyan mt-2">
              ${(stats.totalSourcingCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 text-xs text-slate-custom/80 flex items-center gap-1">
              Inventory expenditure tracker
            </div>
          </div>
        </div>

        {/* Quick Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-navy-card border border-navy-light rounded-xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-accent-cyan" /> Outstanding Receivables Matrix
            </h3>
            <div className="overflow-x-auto rounded-lg border border-navy-light/60">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-navy-dark text-xs text-accent-cyan uppercase font-bold tracking-wider border-b border-navy-light">
                  <tr>
                    <th className="px-4 py-3">Customer Profile</th>
                    <th className="px-4 py-3 text-right">Invoiced Amount</th>
                    <th className="px-4 py-3 text-right">Paid to Date</th>
                    <th className="px-4 py-3 text-right">Remaining Receivable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-light">
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500 font-mono text-xs">
                        No customer accounts found.
                      </td>
                    </tr>
                  ) : (
                    customers.map((c: any) => {
                      const displayName = c.customer_name || c.username || c.email || "N/A";
                      const totalAmt = Number(c.total_amount ?? c.totalAmount ?? 0);
                      const totalPaid = Number(c.total_paid ?? c.totalPaid ?? 0);
                      const totalRem = Number(c.total_remaining ?? c.totalRemaining ?? 0);

                      return (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedCustomerId(c.id)}
                          className={`cursor-pointer transition-colors ${selectedCustomerId === c.id
                              ? "bg-navy-dark/80 border-l-2 border-emerald-500"
                              : "hover:bg-navy-dark/40"
                            }`}
                        >
                          <td className="px-4 py-3 font-semibold text-white">
                            <div className="flex flex-col">
                              <span>{displayName}</span>
                              {c.username && c.customer_name && (
                                <span className="text-[10px] text-slate-400 font-normal">@{c.username}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-slate-200">
                            ${totalAmt.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-mono text-xs">
                            ${totalPaid.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-400 font-bold font-mono text-xs">
                            ${totalRem.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-navy-card border border-navy-light rounded-xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent-cyan" /> Sourcing vs Collection Efficiency
              </h3>
              <div className="space-y-5 py-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-custom mb-1">
                    <span>Cashflow Collection Rate</span>
                    <span className="text-emerald-400 font-bold font-mono">
                      {collectionRate.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-navy-dark rounded-full h-2 overflow-hidden border border-navy-light/50">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(Math.max(collectionRate, 0), 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-custom mb-1">
                    <span>Sourcing to Billing Margin</span>
                    <span className="text-accent-cyan font-bold font-mono">
                      {sourcingMargin.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-navy-dark rounded-full h-2 overflow-hidden border border-navy-light/50">
                    <div
                      className="bg-accent-cyan h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(Math.max(sourcingMargin, 0), 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-navy-dark/40 rounded-lg p-3 text-xs text-accent-cyan/80 mt-4 leading-relaxed font-mono border border-navy-light">
              ★ Active Customers: {stats.activeCustomers || 0} <br />
              ★ System Time: {new Date().toISOString().split("T")[0]} <br />
              ★ Data Status: Consolidated
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // CUSTOMER BILLING TAB VIEW
  // ----------------------------------------------------
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Customer Accounts Panel */}
      <div className="lg:col-span-4 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col h-[750px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Customer Profiles
          </h2>
          {isFetchingCustomers && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
        </div>

        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={customerSearchTerm}
            onChange={(e) => setCustomerSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2 text-[10px] font-mono text-slate-400 uppercase">Customer</th>
                <th className="px-4 py-2 text-[10px] font-mono text-slate-400 uppercase text-right">Invoiced</th>
                <th className="px-4 py-2 text-[10px] font-mono text-slate-400 uppercase text-right">Paid</th>
                <th className="px-4 py-2 text-[10px] font-mono text-slate-400 uppercase text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500 font-mono text-xs">
                    No customer accounts found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const displayName = c.customer_name || c.customerName || c.username || c.email || "N/A";
                  const totalAmt = c.total_amount ?? c.totalAmount ?? 0;
                  const totalPaid = c.total_paid ?? c.totalPaid ?? 0;
                  const totalRem = c.total_remaining ?? c.totalRemaining ?? 0;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={`cursor-pointer transition-colors ${selectedCustomerId === c.id
                          ? "bg-slate-800/90 border-l-2 border-emerald-500"
                          : "hover:bg-slate-800/40"
                        }`}
                    >
                      <td className="px-4 py-3 font-semibold text-white">
                        <div className="flex flex-col">
                          <span className="text-xs text-white">{displayName}</span>
                          {c.username && c.customer_name && (
                            <span className="text-[10px] text-slate-400 font-normal">@{c.username}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-200">
                        ${formatCurrency(totalAmt)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-mono text-xs">
                        ${formatCurrency(totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-400 font-bold font-mono text-xs">
                        ${formatCurrency(totalRem)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Statement & Calculation Grid */}
      <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col h-[750px]">
        {activeCustomer ? (
          <>
            <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-slate-800 gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {activeCustomer.customer_name || activeCustomer.customerName || activeCustomer.username}
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
                    ID: {activeCustomer.id.slice(0, 8)}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeCustomer.email || "No email associated"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddProduct}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Row
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
            </div>

            {/* Editable Grid */}
            <div className="flex-1 overflow-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase">
                  <tr>
                    <th className="px-3 py-2">Product Description</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Weight (kg)</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Total Weight</th>
                    <th className="px-3 py-2 text-right">Total Price</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">Remaining</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {localOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500 font-mono">
                        No calculations or order records exist for this customer account.
                      </td>
                    </tr>
                  ) : (
                    localOrders.map((o: any) => {
                      const isEditing = editingIds.includes(o.id);
                      const isSaving = savingIds.includes(o.id);

                      const prodName = o.product_name || "";
                      const uPrice = o.unit_price ?? 0;
                      const w = o.weight ?? 0;
                      const q = o.qty ?? 0;
                      const totW = o.total_weight ?? 0;
                      const lineTot = o.line_total ?? 0;
                      const pAmt = o.paid_amount ?? 0;
                      const remAmt = o.remaining_amount ?? 0;

                      if (isEditing) {
                        return (
                          <tr key={o.id} className="bg-slate-800/60 border-l-2 border-emerald-400">
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                value={prodName}
                                onChange={(e) => handleInputChange(o.id, "productName", e.target.value)}
                                placeholder="Product Name"
                                className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={uPrice}
                                onChange={(e) => handleInputChange(o.id, "unitPrice", e.target.value)}
                                className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-right text-white focus:outline-none focus:border-emerald-500 font-mono"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                step="0.0001"
                                value={w}
                                onChange={(e) => handleInputChange(o.id, "weight", e.target.value)}
                                className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-right text-white focus:outline-none focus:border-emerald-500 font-mono"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                value={q}
                                onChange={(e) => handleInputChange(o.id, "qty", e.target.value)}
                                className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-right text-white focus:outline-none focus:border-emerald-500 font-mono"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-400">
                              {formatCurrency(totW, 4)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-white">
                              ${formatCurrency(lineTot)}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={pAmt}
                                onChange={(e) => handleInputChange(o.id, "paidAmount", e.target.value)}
                                className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-right text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-rose-400">
                              ${formatCurrency(remAmt)}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleSaveRow(o.id)}
                                  disabled={isSaving}
                                  className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
                                >
                                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleCancelEdit(o.id)}
                                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-white">{prodName}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-300">${formatCurrency(uPrice)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-300">{formatCurrency(w, 4)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-300">{Number(q || 0)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-400">{formatCurrency(totW, 4)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold text-white">${formatCurrency(lineTot)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-emerald-400">${formatCurrency(pAmt)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-400">${formatCurrency(remAmt)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEditClick(o.id)}
                                className="p-1 text-slate-400 hover:text-white transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(o.id, prodName)}
                                className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Account Summary Footer */}
            <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-3 gap-4 bg-slate-950/60 p-3 rounded-lg border">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Subtotal</span>
                <span className="text-base font-bold font-mono text-white">${formatCurrency(localTotalAmount)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Total Received</span>
                <span className="text-base font-bold font-mono text-emerald-400">${formatCurrency(localTotalPaid)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Remaining Due</span>
                <span className="text-base font-bold font-mono text-rose-400">${formatCurrency(localTotalRemaining)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Users className="w-12 h-12 mb-2 stroke-1" />
            <p className="text-sm">Select a customer profile to manage billing statements.</p>
          </div>
        )}
      </div>
    </div>
  );
}