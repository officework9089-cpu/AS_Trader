/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { User } from "../types";
import { supabase } from "../lib/supabase";
import {
  UserPlus,
  Edit,
  Trash,
  UserCheck,
  UserX,
  Mail,
  Key,
  RefreshCw,
  Clock,
  Search,
  AlertCircle,
  CheckCircle,
  X
} from "lucide-react";

interface UserManagementProps {
  currentUserId: string;
  onRefreshStats: () => void;
}

export default function UserManagement({ currentUserId, onRefreshStats }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "customer">("customer");
  const [customer_name, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"active" | "suspended">("active");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else if (data) {
      setUsers(data);
    }

    setLoading(false);
  };

  const handleResetForm = () => {
    setEditUserId(null);
    setUsername("");
    setPassword("");
    setRole("customer");
    setCustomerName("");
    setEmail("");
    setStatus("active");
    setIsFormOpen(false);
  };

  const handleOpenCreate = () => {
    setError("");
    setSuccessMsg("");
    handleResetForm();
    setIsFormOpen(true);
  };

  const handleEditClick = (user: User) => {
    setError("");
    setSuccessMsg("");
    setEditUserId(user.id);
    setUsername(user.username);
    setPassword("");
    setRole(user.role);
    setCustomerName(user.customer_name || "");
    setEmail(user.email || "");
    setStatus(user.status || "active");
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!username.trim()) {
      setError("Username is required.");
      return;
    }

    const payload: Record<string, any> = {
      username: username.trim(),
      role,
      customer_name: role === "customer" ? customer_name.trim() || username.trim() : null,
      email: email.trim() || null,
      status,
    };

    if (password.trim() !== "") {
      payload.password = password.trim();
    }

    try {
      if (editUserId) {
        const { data, error: updateError } = await supabase
          .from("users")
          .update(payload)
          .eq("id", editUserId)
          .select()
          .single();

        if (updateError) throw updateError;

        setUsers((prev) => prev.map((u) => (u.id === editUserId ? data : u)));
        setSuccessMsg("Account details updated successfully.");
      } else {
  const { data, error: insertError } = await supabase
    .from("users")
    .insert([payload])
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const details = insertError.details || insertError.message;

      if (details.includes("users_email_key")) {
        throw new Error("An account with this email address already exists.");
      }
      if (details.includes("users_username_key")) {
        throw new Error("This username is already taken.");
      }
      if (details.includes("users_phone_key")) {
        throw new Error("An account with this phone number already exists.");
      }

      throw new Error("A user with these credentials already exists.");
    }
    throw insertError;
  }

  setUsers((prev) => [data, ...prev]);
  setSuccessMsg("New account registered successfully.");
}

      handleResetForm();
      onRefreshStats();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while saving.");
    }
  };

  const handleToggleStatus = async (user: User) => {
    setError("");
    setSuccessMsg("");
    if (user.id === currentUserId) {
      setError("You cannot suspend your own administrative session.");
      return;
    }

    const newStatus = user.status === "suspended" ? "active" : "suspended";

    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({ status: newStatus })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setSuccessMsg(`User status updated to ${newStatus}.`);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
      );
    } catch (err: any) {
      setError(err.message || "Failed to update user status.");
    }
  };

  const handleDeleteUser = async (user: User) => {
    setError("");
    setSuccessMsg("");
    if (user.id === currentUserId) {
      setError("Deletion of your own active administrator credentials is prohibited.");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete the user account "${user.username}"?`
      )
    ) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("users")
        .delete()
        .eq("id", user.id);

      if (deleteError) throw deleteError;

      setSuccessMsg("Account credentials removed successfully.");
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      onRefreshStats();
    } catch (err: any) {
      setError(err.message || "Failed to execute account termination.");
    }
  };

  const handleGenerateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let generated = "";
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
  };

  const filteredUsers = users.filter((u) => {
    const search = searchTerm.toLowerCase();
    return (
      u.username.toLowerCase().includes(search) ||
      (u.customer_name && u.customer_name.toLowerCase().includes(search)) ||
      (u.email && u.email.toLowerCase().includes(search)) ||
      u.role.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-navy-card border border-navy-light p-6 rounded-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent-cyan/5 rounded-full blur-2xl"></div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Credential & User Management
          </h2>
          <p className="text-sm text-slate-custom mt-1">
            Generate credentials, reset secure sessions, monitor user active logs, and manage roles.
          </p>
        </div>
        <button
          id="btn-create-account"
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-accent-cyan hover:bg-accent-cyan/90 text-navy-dark px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          Register Account
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-start gap-2 text-rose-400 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 text-xs font-semibold leading-relaxed">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-auto hover:text-white font-bold text-rose-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2 text-emerald-400 bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-xs font-semibold leading-relaxed animate-fade-in">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="ml-auto hover:text-white font-bold text-emerald-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Account Form */}
        {isFormOpen && (
          <div className="lg:col-span-1 bg-navy-card border border-navy-light rounded-xl p-5 shadow-xl relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-accent-cyan"></div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                {editUserId ? <Edit className="h-4 w-4 text-accent-cyan" /> : <UserPlus className="h-4 w-4 text-accent-cyan" />}
                {editUserId ? "Edit User Profile" : "Create User Account"}
              </h3>
              <button onClick={handleResetForm} className="text-slate-custom hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g., john_doe"
                  disabled={!!editUserId}
                  className="w-full bg-navy-dark border border-navy-light rounded-lg px-3 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-accent-cyan disabled:opacity-50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1">
                  Account Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "customer")}
                  className="w-full bg-navy-dark border border-navy-light rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-accent-cyan"
                >
                  <option value="customer">Customer Profile (Default)</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              {role === "customer" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1">
                    Display Customer Name
                  </label>
                  <input
                    type="text"
                    value={customer_name}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g., John Doe"
                    className="w-full bg-navy-dark border border-navy-light rounded-lg px-3 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-accent-cyan"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-custom/80" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full bg-navy-dark border border-navy-light rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-accent-cyan"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider">
                    {editUserId ? "New Password (Leave blank to keep current)" : "Secure Password"}
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPassword}
                    className="text-[10px] font-bold text-accent-cyan hover:underline uppercase flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" /> Auto-Gen
                  </button>
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-custom/80" />
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editUserId ? "••••••••" : "At least 6 characters"}
                    className="w-full bg-navy-dark border border-navy-light rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-accent-cyan font-mono"
                    required={!editUserId}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-custom uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "suspended")}
                  className="w-full bg-navy-dark border border-navy-light rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-accent-cyan"
                >
                  <option value="active">Active (Access Allowed)</option>
                  <option value="suspended">Suspended (Access Revoked)</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="flex-1 bg-transparent border border-navy-light text-slate-custom hover:text-white font-semibold py-2 rounded-lg text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-accent-cyan hover:bg-accent-cyan/90 text-navy-dark font-bold py-2 rounded-lg text-xs transition shadow-md cursor-pointer"
                >
                  {editUserId ? "Save Changes" : "Create Profile"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Directory List */}
        <div className={`${isFormOpen ? "lg:col-span-2" : "lg:col-span-3"} space-y-4`}>
          <div className="flex bg-navy-card border border-navy-light rounded-xl p-3 shadow-md items-center gap-3">
            <Search className="h-5 w-5 text-slate-custom" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search user accounts by username, name, email or role..."
              className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none"
            />
          </div>

          <div className="bg-navy-card border border-navy-light rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-navy-light bg-navy-dark/60 flex justify-between items-center">
              <h3 className="text-xs font-bold text-accent-cyan uppercase tracking-wider">
                Account Credentials Matrix
              </h3>
              <span className="text-xs font-mono text-slate-custom">
                {filteredUsers.length} Logged Profiles
              </span>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-custom font-mono">Querying database accounts...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="hidden md:table w-full text-left text-sm text-gray-300">
                  <thead className="bg-navy-dark text-xs font-bold text-accent-cyan uppercase tracking-wider border-b border-navy-light">
                    <tr>
                      <th className="px-5 py-4">Account Profile</th>
                      <th className="px-5 py-4">Role</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Last Login Time</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-light/30">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-navy-dark/30 transition-colors duration-200">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-navy-dark border border-navy-light flex items-center justify-center font-bold text-accent-cyan uppercase text-xs">
                                {u.username[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-white text-sm">
                                  {u.customer_name || u.username}
                                </p>
                                <p className="text-xs text-slate-custom font-mono">@{u.username}</p>
                                {u.email && (
                                  <p className="text-[11px] text-slate-custom/80 flex items-center gap-1 mt-0.5">
                                    <Mail className="h-3 w-3 inline" /> {u.email}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-widest ${
                                u.role === "admin"
                                  ? "bg-accent-cyan/10 text-accent-cyan ring-1 ring-inset ring-accent-cyan/20"
                                  : "bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition-all duration-300 cursor-pointer ${
                                u.status === "suspended"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                              }`}
                              title="Toggle Active/Suspended account access"
                            >
                              {u.status === "suspended" ? (
                                <>
                                  <UserX className="h-3.5 w-3.5" /> Suspended
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3.5 w-3.5" /> Active
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-5 py-4 font-mono text-xs">
                            {u.lastLogin ? (
                              <div className="flex items-center gap-1.5 text-slate-custom">
                                <Clock className="h-3.5 w-3.5 text-accent-cyan/60" />
                                <span>{new Date(u.lastLogin).toLocaleString()}</span>
                              </div>
                            ) : (
                              <span className="text-slate-custom/40">Never authenticated</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleEditClick(u)}
                                className="p-1.5 rounded-lg bg-navy-dark border border-navy-light text-accent-cyan hover:bg-navy-dark/80 transition-all duration-300 cursor-pointer"
                                title="Edit Profile Details & Credentials"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                disabled={u.id === currentUserId}
                                className={`p-1.5 rounded-lg bg-navy-dark border transition-all duration-300 ${
                                  u.id === currentUserId
                                    ? "border-gray-500/10 text-gray-500 opacity-30 cursor-not-allowed"
                                    : "border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 cursor-pointer"
                                }`}
                                title="Terminate Credentials"
                              >
                                <Trash className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-slate-custom/60 text-xs">
                          No matching credential accounts found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Mobile Cards View */}
                <div className="block md:hidden p-4 space-y-4">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        className="bg-navy-dark/40 border border-navy-light p-4 rounded-xl space-y-3 relative overflow-hidden"
                      >
                        <div className="absolute top-4 right-4">
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                              u.role === "admin"
                                ? "bg-accent-cyan/10 text-accent-cyan ring-1 ring-inset ring-accent-cyan/20"
                                : "bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20"
                            }`}
                          >
                            {u.role}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-navy-dark border border-navy-light flex items-center justify-center font-bold text-accent-cyan uppercase text-sm shrink-0">
                            {u.username[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white text-sm truncate">
                              {u.customer_name || u.username}
                            </p>
                            <p className="text-xs text-slate-custom font-mono truncate">
                              @{u.username}
                            </p>
                          </div>
                        </div>

                        <div className="text-xs space-y-2 pt-2 border-t border-navy-light/40">
                          {u.email && (
                            <p className="text-slate-custom flex items-center gap-1.5 truncate">
                              <Mail className="h-3.5 w-3.5 text-accent-cyan/60" /> {u.email}
                            </p>
                          )}
                          <div className="flex justify-between items-center text-slate-custom">
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-accent-cyan/60" />
                              Last Active:
                            </span>
                            <span className="font-mono font-medium text-[11px]">
                              {u.lastLogin
                                ? new Date(u.lastLogin).toLocaleDateString()
                                : "Never"}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-slate-custom font-medium">Session Access:</span>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all duration-300 cursor-pointer ${
                                u.status === "suspended"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                              }`}
                            >
                              {u.status === "suspended" ? (
                                <UserX className="h-3 w-3" />
                              ) : (
                                <UserCheck className="h-3 w-3" />
                              )}
                              {u.status === "suspended" ? "Suspended" : "Active"}
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-navy-light/40">
                          <button
                            onClick={() => handleEditClick(u)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-navy-dark border border-navy-light text-accent-cyan text-[11px] font-bold uppercase tracking-wider hover:bg-navy-dark/80 cursor-pointer"
                          >
                            <Edit className="h-3.5 w-3.5" /> Edit Profile
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={u.id === currentUserId}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-navy-dark border ${
                              u.id === currentUserId
                                ? "border-gray-500/10 text-gray-500 opacity-30 cursor-not-allowed"
                                : "border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 cursor-pointer"
                            }`}
                          >
                            <Trash className="h-3.5 w-3.5" /> Terminate
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-8 text-slate-custom/60 text-xs">
                      No matching user accounts registered.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}