/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "admin" | "customer";
export type UserStatus = "active" | "suspended";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  customer_name?: string;
  password?: string; // Hashed password, excluded in client responses
  email?: string;
  status?: UserStatus;
  lastLogin?: string;
}

/**
 * Public User representation with sensitive fields stripped out.
 * Use this for API responses to guarantee passwords are never returned.
 */
export type PublicUser = Omit<User, "password">;

export interface CustomerOrder {
  weight: any;
  remaining_amount: number;
  paid_amount: number;
  line_total: number;
  total_weight: number;
  unit_price: number;
  product_name: string;
  id: string;
  customerId: string; // References profiles(id)
  customer_name: string;
  qty: number; // integer >= 0
   created_at: string; // ISO 8601 String timestamp with time zone
  updated_at: string; // ISO 8601 String timestamp with time zone
}

/**
 * Payload required to create or update an order.
 * Generated columns (total_weight, line_total, remaining_amount) and 
 * system timestamps (created_at, updated_at) are handled automatically.
 */
export type OrderInput = Omit<
  CustomerOrder,
  | "id"
  | "total_weight"
  | "line_total"
  | "remaining_amount"
  | "created_at"
  | "updated_at"
> & { id?: string };

export interface SupplierInventory {
  id: string;
  supplier_name: string;
  item_type: string;
  quantity: string; // e.g., "13pcs" or "20 units"
  cost_price: number;
  sourcing_weight: number; // weight of stock received
  date_received: string; // ISO string or YYYY-MM-DD
}

/**
 * Payload required to create or update inventory.
 */
export type SupplierInventoryInput = Omit<SupplierInventory, "id"> & { id?: string };

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface CustomerTotals {
  customerId: string;
  customerName: string;
  total_amount: number;
  totalPaid: number;
  totalRemaining: number;
}

/**
 * Database Row mapping type for Supabase client queries.
 * Useful when working with raw snake_case database responses.
 */
export interface CustomerOrderRow {
  id: string;
  customer_id: string;
  customer_name: string;
  product_name: string;
  unit_price: number;
  weight: number;
  qty: number;
  total_weight: number;
  line_total: number;
  paid_amount: number;
  remaining_amount: number;
  created_at: string;
  updated_at: string;
}