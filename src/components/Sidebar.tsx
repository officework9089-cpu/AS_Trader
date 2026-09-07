/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LayoutDashboard, Users, Truck, LogOut, Menu, X, UserCog } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import logo from "@/assets/logo.png";

interface SidebarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  role: "admin" | "customer";
  username: string;
  customerName?: string;
  onLogout: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function Sidebar({
  currentTab,
  setTab,
  role,
  username,
  customerName,
  onLogout,
  isOpen,
  setIsOpen,
}: SidebarProps) {
  const menuItems =
    role === "admin"
      ? [
          { id: "overview", label: "Overview", icon: LayoutDashboard },
          { id: "customers", label: "Customer Grid", icon: Users },
          { id: "supplier", label: "Supplier Tracking", icon: Truck },
          { id: "users", label: "User Accounts", icon: UserCog },
        ]
      : [{ id: "customer-portal", label: "My Statements", icon: LayoutDashboard }];

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        id="sidebar-mobile-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2.5 rounded-lg bg-navy-card border border-accent-cyan/30 text-gray-100 hover:text-accent-cyan focus:outline-none focus:ring-2 focus:ring-accent-cyan md:hidden transition-all duration-300 glow-cyan cursor-pointer"
        aria-label="Toggle Navigation Menu"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar Layout */}
      <div
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-navy-dark border-r border-navy-light flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header Branding */}
        <div className="p-4 border-b border-navy-light bg-navy-dark">
          <div className="flex flex-col items-start justify-center">
            <img 
              src={logo} 
              alt="ASComm Logo" 
              className="h-9 w-auto max-w-full object-contain rounded-lg" 
            />
            <p className="text-[10px] text-slate-custom uppercase tracking-[3px] mt-2 font-semibold">
              {role === "admin" ? "Management" : "Customer Portal"}
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-link-${item.id}`}
                onClick={() => {
                  setTab(item.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-navy-card border border-accent-cyan/30 text-white glow-cyan"
                    : "text-slate-custom hover:bg-navy-card hover:text-white"
                }`}
              >
                <IconComponent className={`h-5 w-5 shrink-0 ${isActive ? "text-accent-cyan" : "text-slate-custom"}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Footer Profile & Logout */}
        <div className="p-4 border-t border-navy-light bg-navy-dark space-y-3">
          <div className="flex items-center gap-3 p-1.5">
            <div className="w-9 h-9 rounded-full bg-navy-card border border-navy-light flex items-center justify-center text-accent-cyan font-bold uppercase shrink-0">
              {username?.charAt(0) || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">
                {customerName || "Administrator"}
              </p>
              <p className="text-xs text-slate-custom truncate font-mono">
                @{username}
              </p>
            </div>
            {role === "admin" && (
              <span className="inline-flex items-center rounded bg-accent-cyan/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-cyan ring-1 ring-inset ring-accent-cyan/20 uppercase tracking-widest shrink-0">
                Admin
              </span>
            )}
          </div>

          <button
            id="sidebar-logout-button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold uppercase tracking-wider transition-all duration-300 hover:border-rose-500/40 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Mobile Backdrop Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-30 bg-black/60 md:hidden backdrop-blur-xs"
          />
        )}
      </AnimatePresence>
    </>
  );
}