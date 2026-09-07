import { useState, useEffect, FormEvent } from "react";
import { supabase } from "./lib/supabase";
import { CustomerOrder, SupplierInventory } from "./types";
import Sidebar from "./components/Sidebar";
import AdminDashboard from "./components/AdminDashboard";
import CustomerPortal from "./components/CustomerPortal";
import SupplierTracking from "./components/SupplierTracking";
import UserManagement from "./components/UserManagement";
import { Lock, User as UserIcon, Loader2, AlertCircle } from "lucide-react";
import logo from "@/assets/Logo.png";

interface UserProfile {
  id: string;
  username: string;
  role: "admin" | "customer";
  customerName?: string;
  email?: string;
}

export default function App() {
  // Auth states
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Login form states
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);

  // Application data states
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [supplierInventory, setSupplierInventory] = useState<SupplierInventory[]>([]);
  const [stats, setStats] = useState({
    activeCustomers: 0,
    totalTransactions: 0,
    totalCollected: 0,
    totalReceivables: 0,
    totalSourcingCost: 0,
  });

  // UI state
  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [appError, setAppError] = useState("");

  // Load user profile helper
  const loadUserProfile = async (userId: string) => {
    const { data: profile, error } = await supabase
      .from("users")
      .select("id, username, role, customer_name, email, status")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!profile) throw new Error("User profile record not found.");

    if (profile.status !== "active") {
      await supabase.auth.signOut();
      throw new Error("Account is inactive. Please contact administrator.");
    }

    const userProfile: UserProfile = {
      id: profile.id,
      username: profile.username || profile.email,
      role: profile.role as "admin" | "customer",
      customerName: profile.customer_name || profile.username,
      email: profile.email,
    };

    setCurrentUser(userProfile);
    return userProfile;
  };

  // Initialize Supabase Auth state listener
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadUserProfile(session.user.id);
        }
      } catch (err: any) {
        console.error("Auth initialization failed:", err);
      } finally {
        setIsInitializingAuth(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          try {
            await loadUserProfile(session.user.id);
          } catch (err: any) {
            setLoginError(err.message || "Failed to load user profile.");
          }
        } else if (event === "SIGNED_OUT") {
          setCurrentUser(null);
          setOrders([]);
          setCustomers([]);
          setSupplierInventory([]);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sync active tab and fetch data when user changes
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === "customer") {
        setActiveTab("customer-portal");
        fetchCustomerData(currentUser);
      } else {
        setActiveTab("overview");
        fetchAdminData();
      }
    }
  }, [currentUser]);

  // Login handler using Supabase Auth
  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim() || !password.trim()) {
      setLoginError("Please provide both credentials.");
      return;
    }
    setLoginError("");
    setIsLoggingIn(true);

    try {
      let targetEmail = emailOrUsername.trim();

      // If user typed a username instead of email, resolve email first
      if (!targetEmail.includes("@")) {
        const { data: foundUser } = await supabase
          .from("users")
          .select("email")
          .eq("username", targetEmail)
          .maybeSingle();

        if (foundUser?.email) {
          targetEmail = foundUser.email;
        }
      }

      // Authenticate with Supabase Auth to retrieve session and JWT token for RLS
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password.trim(),
      });

      if (authError) {
        setLoginError("Invalid credentials or authentication error.");
        return;
      }

      if (authData.user) {
        // Update last_login timestamp
        await supabase
          .from("users")
          .update({ last_login: new Date().toISOString() })
          .eq("id", authData.user.id);

        await loadUserProfile(authData.user.id);
      }
    } catch (e: any) {
      console.error("Login Error:", e);
      setLoginError(e.message || "Server communication failure. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const fetchAdminData = async () => {
    setIsDataLoading(true);
    setAppError("");
    try {
      // 1. Fetch Orders
      const { data: ordersData, error: ordersErr } = await supabase
        .from("customer_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (ordersErr) throw ordersErr;

      // 2. Fetch Supplier Inventory
      const { data: inventoryData, error: inventoryErr } = await supabase
        .from("supplier_inventory")
        .select("*")
        .order("created_at", { ascending: false });

      if (inventoryErr) throw inventoryErr;

      // 3. Fetch Users/Customers
      const { data: customersData, error: customersErr } = await supabase
        .from("users")
        .select("*");

      if (customersErr) throw customersErr;

      // 4. Calculate Aggregate Stats
      const totalCollected = (ordersData || []).reduce((acc, item) => acc + Number(item.paid_amount || 0), 0);
      const totalReceivables = (ordersData || []).reduce((acc, item) => acc + Number(item.remaining_amount || 0), 0);
      const totalSourcingCost = (inventoryData || []).reduce((acc, item) => acc + Number(item.cost_price || 0), 0);

      setOrders(ordersData || []);
      setSupplierInventory(inventoryData || []);
      setCustomers(customersData || []);
      setStats({
        activeCustomers: (customersData || []).filter((c) => c.status === "active").length,
        totalTransactions: ordersData?.length || 0,
        totalCollected,
        totalReceivables,
        totalSourcingCost,
      });
    } catch (e: any) {
      setAppError(e.message || "Network error. Failed to load portfolio statements.");
    } finally {
      setIsDataLoading(false);
    }
  };

  const fetchCustomerData = async (user = currentUser) => {
    if (!user) return;
    setIsDataLoading(true);
    setAppError("");
    try {
      const { data, error } = await supabase
        .from("customer_orders")
        .select("*")
        .or(`customer_id.eq.${user.id},customer_name.eq.${user.customerName || user.username}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (e: any) {
      setAppError(e.message || "Failed to load personal financial records.");
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setOrders([]);
    setCustomers([]);
    setSupplierInventory([]);
  };

  // Order Operations
  const handleAddOrUpdateOrder = async (orderData: Partial<CustomerOrder>) => {
    try {
      const { error } = await supabase
        .from("customer_orders")
        .upsert([orderData]);

      if (error) throw error;
      await fetchAdminData();
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message || "Failed to commit order calculation.");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from("customer_orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;
      await fetchAdminData();
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message || "Failed to delete order entry.");
    }
  };

  // Supplier Operations
  const handleAddOrUpdateSupplier = async (supplierItem: Partial<SupplierInventory>) => {
    try {
      const { error } = await supabase
        .from("supplier_inventory")
        .upsert([supplierItem]);

      if (error) throw error;
      await fetchAdminData();
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message || "Failed to log supplier shipment.");
    }
  };

  const handleDeleteSupplier = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("supplier_inventory")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
      await fetchAdminData();
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message || "Failed to delete supplier inventory entry.");
    }
  };

  const handleQuickLogin = (email: string, pass: string) => {
    setEmailOrUsername(email);
    setPassword(pass);
    setLoginError("");
  };

  if (isInitializingAuth) {
    return (
      <div className="min-h-screen bg-navy-dark flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-accent-cyan animate-spin" />
        <p className="text-sm text-gray-400 font-mono">Authenticating Session...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-navy-dark flex flex-col items-center justify-center p-4 selection:bg-accent-cyan/30 selection:text-white">
        <div className="w-full max-w-md bg-navy-card border border-navy-light rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-cyan to-cyan-600"></div>
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent-cyan/5 rounded-full blur-2xl"></div>

          <div className="text-center mb-8">
            <div className="inline-flex justify-center rounded-xl bg-navy-dark border border-navy-light">
              <img src={logo} alt="ASComm Logo" className="w-auto h-auto rounded-lg" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-wide">
              AS<span className="text-accent-cyan">Comm</span>
            </h1>
            <p className="text-[10px] text-slate-custom font-medium tracking-widest uppercase mt-1">
              Enterprise Billing & Sourcing Portal
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5 text-accent-cyan/80" /> Email / Username
              </label>
              <input
                type="text"
                id="login-username"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                placeholder="Enter email or username"
                className="w-full bg-navy-dark border border-navy-light rounded-lg px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:border-transparent transition-all duration-300 shadow-inner"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-accent-cyan/80" /> Password
              </label>
              <input
                type="password"
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-navy-dark border border-navy-light rounded-lg px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:border-transparent transition-all duration-300 shadow-inner"
                required
              />
            </div>

            {loginError && (
              <div className="flex items-start gap-2 text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 text-xs font-semibold leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              id="login-submit-button"
              disabled={isLoggingIn}
              className="w-full bg-accent-cyan hover:bg-accent-cyan/90 disabled:bg-cyan-950 text-navy-dark font-extrabold py-3 px-4 rounded-lg text-sm transition-all duration-300 uppercase tracking-wider glow-cyan flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                "Authenticate Session"
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-navy-light space-y-3">
            <h4 className="text-[10px] font-bold text-accent-cyan uppercase tracking-widest text-center">
              Quick Demo Account Switcher
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                id="quick-login-admin"
                type="button"
                onClick={() => handleQuickLogin("admin@ascomm.com", "admin123")}
                className="w-full bg-navy-dark/60 hover:bg-navy-dark text-left px-3 py-2 rounded-lg border border-navy-light flex justify-between items-center text-xs text-gray-300 transition-colors"
              >
                <div>
                  <span className="font-bold text-accent-cyan">Admin:</span> admin@ascomm.com
                </div>
                <span className="text-[9px] uppercase tracking-widest text-accent-cyan font-bold bg-navy-card px-1 py-0.5 rounded">
                  Full CRUD
                </span>
              </button>

              <button
                id="quick-login-customer-john"
                type="button"
                onClick={() => handleQuickLogin("john@ascomm.com", "customer123")}
                className="w-full bg-navy-dark/60 hover:bg-navy-dark text-left px-3 py-2 rounded-lg border border-navy-light flex justify-between items-center text-xs text-gray-300 transition-colors"
              >
                <div>
                  <span className="font-bold text-slate-custom">Customer:</span> john@ascomm.com
                </div>
                <span className="text-[9px] uppercase tracking-widest text-slate-custom font-bold bg-navy-card px-1 py-0.5 rounded">
                  Isolated Portal
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-dark text-slate-custom font-sans selection:bg-accent-cyan/20 selection:text-white flex">
      <Sidebar
        currentTab={activeTab}
        setTab={setActiveTab}
        role={currentUser.role}
        username={currentUser.username}
        customerName={currentUser.customerName}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <main className="flex-1 md:ml-64 p-6 md:p-10 pt-20 md:pt-10 max-w-7xl mx-auto w-full min-w-0">
        {appError && (
          <div className="mb-6 flex items-start gap-2 text-rose-400 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 text-xs font-semibold leading-relaxed">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{appError}</span>
            <button onClick={() => setAppError("")} className="ml-auto text-rose-400 hover:text-white font-bold">
              Close
            </button>
          </div>
        )}

        {isDataLoading && orders.length === 0 && (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
            <p className="text-sm text-gray-400 font-mono">Consolidating Statements...</p>
          </div>
        )}

        <div className={isDataLoading && orders.length === 0 ? "hidden" : ""}>
          {currentUser.role === "admin" ? (
            activeTab === "overview" ? (
              <AdminDashboard
                orders={orders}
                customers={customers}
                stats={stats}
                onAddOrUpdateOrder={handleAddOrUpdateOrder}
                onDeleteOrder={handleDeleteOrder}
                activeSubTab="overview"
              />
            ) : activeTab === "customers" ? (
              <AdminDashboard
                orders={orders}
                customers={customers}
                stats={stats}
                onAddOrUpdateOrder={handleAddOrUpdateOrder}
                onDeleteOrder={handleDeleteOrder}
                activeSubTab="customers"
              />
            ) : activeTab === "supplier" ? (
              <SupplierTracking
                inventory={supplierInventory}
                onAddOrUpdate={handleAddOrUpdateSupplier}
                onDelete={handleDeleteSupplier}
              />
            ) : activeTab === "users" ? (
              <UserManagement
                currentUserId={currentUser.id}
                onRefreshStats={fetchAdminData}
              />
            ) : null
          ) : (
            (activeTab === "customer-portal" || activeTab === "overview") && (
              <CustomerPortal
                customerName={currentUser.customerName || currentUser.username}
                orders={orders}
              />
            )
          )}
        </div>
      </main>
    </div>
  );
}
