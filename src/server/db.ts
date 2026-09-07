import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";
import bcryptjs from "bcryptjs";
import { User, CustomerOrder, SupplierInventory } from "../types";

const DB_PATH = path.join(process.cwd(), "db.json");

interface DatabaseSchema {
  users: User[];
  orders: CustomerOrder[];
  inventory: SupplierInventory[];
}

// In-memory cache
let dbCache: DatabaseSchema | null = null;

/**
 * Safely generates initial seed data if db.json doesn't exist.
 */
function createSeedData(): DatabaseSchema {
  const salt = bcryptjs.genSaltSync(10);
  const adminPasswordHash = bcryptjs.hashSync("admin123", salt);
  const customerPasswordHash = bcryptjs.hashSync("customer123", salt);

  const users: User[] = [
    {
      id: "u1",
      username: "admin",
      role: "admin",
      password: adminPasswordHash,
      email: "admin@ascomm.com",
      status: "active",
      lastLogin: new Date().toISOString(),
    },
    {
      id: "u2",
      username: "john_doe",
      role: "customer",
      customer_name: "John Doe",
      password: customerPasswordHash,
      email: "john.doe@gmail.com",
      status: "active",
      lastLogin: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "u3",
      username: "alice_smith",
      role: "customer",
      customer_name: "Alice Smith",
      password: customerPasswordHash,
      email: "alice.smith@outlook.com",
      status: "active",
      lastLogin: new Date(Date.now() - 7200000).toISOString(),
    },
  ];

  const orders: CustomerOrder[] = [
    {
      id: "o1",
      customerId: "u2",
      customer_name: "John Doe",
      product_name: "Premium Cotton Shirts",
      unit_price: 15.0,
      weight: 0.25,
      qty: 100,
      total_weight: 25.0,
      line_total: 375.0,
      paid_amount: 200.0,
      remaining_amount: 175.0,
      updated_at: new Date("2026-06-20T10:00:00Z").toISOString(),
      created_at: new Date("2026-06-20T10:00:00Z").toISOString(),
    },
    {
      id: "o2",
      customerId: "u2",
      customer_name: "John Doe",
      product_name: "Denim Jackets",
      unit_price: 35.0,
      weight: 0.8,
      qty: 50,
      total_weight  : 40.0,
      line_total: 1400.0,
      paid_amount: 1400.0,
      remaining_amount: 0.0,
      updated_at: new Date("2026-06-21T11:30:00Z").toISOString(),
      created_at: new Date("2026-06-21T11:30:00Z").toISOString(),
    },
    {
      id: "o3",
      customerId: "u3",
      customer_name: "Alice Smith",
      product_name: "Silk Scarves",
      unit_price: 45.0,
      weight: 0.05,
      qty: 200,
      total_weight: 10.0,
      line_total: 450.0,
      paid_amount: 150.0,
      remaining_amount: 300.0,
      updated_at: new Date("2026-06-24T14:15:00Z").toISOString(),
      created_at: new Date("2026-06-24T14:15:00Z").toISOString(),
    },
  ];

  const inventory: SupplierInventory[] = [
    {
      id: "s1",
      supplier_name: "John Sourcing Ltd",
      item_type: "Shirts",
      quantity: "150pcs",
      cost_price: 8.5,
      sourcing_weight: 37.5,
      date_received: "2026-06-15",
    },
    {
      id: "s2",
      supplier_name: "David Textiles",
      item_type: "Denim Jackets",
      quantity: "60pcs",
      cost_price: 18.0,
      sourcing_weight: 48.0,
      date_received : "2026-06-18",
    },
    {
      id: "s3",
      supplier_name: "Varanasi Silk Weaver",
      item_type: "Silk Scarves",
      quantity: "250pcs",
      cost_price: 22.0,
      sourcing_weight: 12.5,
      date_received: "2026-06-22",
    },
  ];

  return { users, orders, inventory };
}

/**
 * Async database initialization.
 */
export async function initDatabase(): Promise<DatabaseSchema> {
  if (dbCache) return dbCache;

  try {
    const data = await fs.readFile(DB_PATH, "utf8");
    dbCache = JSON.parse(data);
    return dbCache!;
  } catch {
    console.warn("db.json not found or corrupted. Initializing new dataset...");
  }

  const initialDb = createSeedData();
  await saveDatabase(initialDb);
  return dbCache!;
}

/**
 * Synchronous initialization backup for bootstrap scripts if necessary.
 */
export function initDatabaseSync(): DatabaseSchema {
  if (dbCache) return dbCache;

  if (fsSync.existsSync(DB_PATH)) {
    try {
      const data = fsSync.readFileSync(DB_PATH, "utf8");
      dbCache = JSON.parse(data);
      return dbCache!;
    } catch (e) {
      console.error("Error reading db.json, re-initializing...", e);
    }
  }

  const initialDb = createSeedData();
  saveDatabaseSync(initialDb);
  return dbCache!;
}

/**
 * Writes data atomically to prevent corruption during file save interrupts.
 */
export async function saveDatabase(data: DatabaseSchema): Promise<void> {
  const tempPath = `${DB_PATH}.tmp`;
  try {
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tempPath, DB_PATH);
    dbCache = data;
  } catch (e) {
    console.error("Error writing db.json", e);
  }
}

export function saveDatabaseSync(data: DatabaseSchema): void {
  const tempPath = `${DB_PATH}.tmp`;
  try {
    fsSync.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
    fsSync.renameSync(tempPath, DB_PATH);
    dbCache = data;
  } catch (e) {
    console.error("Error writing db.json synchronously", e);
  }
}

// --- DB ACCESSORS & MUTATORS ---

export async function getUsers(): Promise<User[]> {
  const db = await initDatabase();
  return db.users;
}

export async function saveUser(
  userData: Partial<User> & { username: string; role: "customer" | "admin" }
): Promise<User> {
  const db = await initDatabase();
  const salt = bcryptjs.genSaltSync(10);

  if (userData.id) {
    const idx = db.users.findIndex((u) => u.id === userData.id);
    if (idx !== -1) {
      const existing = db.users[idx];
      let updatedPass = existing.password;

      if (userData.password && userData.password.trim() !== "") {
        const isBcrypt = /^\$2[aby]\$/.test(userData.password);
        updatedPass = isBcrypt ? userData.password : bcryptjs.hashSync(userData.password, salt);
      }

      const updated: User = {
        ...existing,
        ...userData,
        password: updatedPass,
        email: userData.email ?? existing.email ?? "",
        status: userData.status ?? existing.status ?? "active",
        customer_name: userData.customer_name ?? existing.customer_name  ?? userData.username,
      };

      db.users[idx] = updated;
      await saveDatabase(db);
      return updated;
    }
  }

  // Create new user
  let passwordHash = "";
  if (userData.password && userData.password.trim() !== "") {
    const isBcrypt = /^\$2[aby]\$/.test(userData.password);
    passwordHash = isBcrypt ? userData.password : bcryptjs.hashSync(userData.password, salt);
  } else {
    passwordHash = bcryptjs.hashSync("customer123", salt);
  }

  const newUser: User = {
    id: userData.id || `u_${crypto.randomUUID()}`,
    username: userData.username,
    role: userData.role,
    customer_name: userData.customer_name ?? userData.username,
    email: userData.email || "",
    status: userData.status || "active",
    lastLogin: userData.lastLogin || "",
    password: passwordHash,
  };

  db.users.push(newUser);
  await saveDatabase(db);
  return newUser;
}

export async function deleteUserById(userId: string): Promise<boolean> {
  const db = await initDatabase();
  const initialLen = db.users.length;
  db.users = db.users.filter((u) => u.id !== userId);

  if (db.users.length !== initialLen) {
    await saveDatabase(db);
    return true;
  }
  return false;
}

export async function getOrders(): Promise<CustomerOrder[]> {
  const db = await initDatabase();
  return db.orders;
}

export async function saveOrder(
  orderData: Omit<CustomerOrder, "totalWeight" | "lineTotal" | "remainingAmount" | "updatedAt"> & { id?: string }
): Promise<CustomerOrder> {
  const db = await initDatabase();

  const totalWeight = Number((orderData.weight * orderData.qty).toFixed(4));
  const lineTotal = Number((totalWeight * orderData.unit_price).toFixed(2));
  const remainingAmount = Number((lineTotal - orderData.paid_amount).toFixed(2));
  const updatedAt = new Date().toISOString();

  if (orderData.id) {
    const index = db.orders.findIndex((o) => o.id === orderData.id);
    if (index !== -1) {
      const updatedOrder: CustomerOrder = {
        ...db.orders[index],
        ...orderData,
        id: orderData.id,
        total_weight: totalWeight,
        line_total: lineTotal,
        remaining_amount: remainingAmount,
        updated_at: updatedAt,
      };
      db.orders[index] = updatedOrder;
      await saveDatabase(db);
      return updatedOrder;
    }
  }

  const newOrder: CustomerOrder = {
    id: orderData.id || `o_${crypto.randomUUID()}`,
    customerId: orderData.customerId,
    customer_name: orderData.customer_name,
    product_name: orderData.product_name,
    unit_price: orderData.unit_price,
    weight: orderData.weight,
    qty: orderData.qty,
    total_weight: totalWeight,
    line_total: lineTotal,
    paid_amount: orderData.paid_amount,
    remaining_amount: remainingAmount,
    updated_at: updatedAt,
    created_at: ""
  };

  db.orders.push(newOrder);
  await saveDatabase(db);
  return newOrder;
}

export async function deleteOrder(orderId: string): Promise<boolean> {
  const db = await initDatabase();
  const initialLength = db.orders.length;
  db.orders = db.orders.filter((o) => o.id !== orderId);

  if (db.orders.length !== initialLength) {
    await saveDatabase(db);
    return true;
  }
  return false;
}

export async function getSupplierInventory(): Promise<SupplierInventory[]> {
  const db = await initDatabase();
  return db.inventory;
}

export async function saveSupplierInventory(
  item: Omit<SupplierInventory, "id"> & { id?: string }
): Promise<SupplierInventory> {
  const db = await initDatabase();

  if (item.id) {
    const index = db.inventory.findIndex((i) => i.id === item.id);
    if (index !== -1) {
      const updatedItem: SupplierInventory = {
        ...db.inventory[index],
        ...item,
        id: item.id,
      };
      db.inventory[index] = updatedItem;
      await saveDatabase(db);
      return updatedItem;
    }
  }

  const newItem: SupplierInventory = {
    ...item,
    id: `s_${crypto.randomUUID()}`,
  };

  db.inventory.push(newItem);
  await saveDatabase(db);
  return newItem;
}

export async function deleteSupplierInventory(itemId: string): Promise<boolean> {
  const db = await initDatabase();
  const initialLength = db.inventory.length;
  db.inventory = db.inventory.filter((i) => i.id !== itemId);

  if (db.inventory.length !== initialLength) {
    await saveDatabase(db);
    return true;
  }
  return false;
}