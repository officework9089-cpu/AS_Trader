import express from "express";
import path from "path";
import bcryptjs from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { initDatabase, getUsers, getOrders, saveOrder, deleteOrder, getSupplierInventory, saveSupplierInventory, deleteSupplierInventory, saveUser, deleteUserById } from "./src/server/db";
import { authenticateJWT, requireRole, generateToken, AuthenticatedRequest } from "./src/server/auth";
import { User, CustomerTotals } from "./src/types";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize the JSON-file database
  initDatabase();

  app.use(express.json());

  // --- API ROUTES ---

  // Auth: Login
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const users = getUsers();
    const user = (await users).find((u) => u.username.toLowerCase() === username.toLowerCase());

    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ error: "Access Denied: Your account has been suspended. Please contact the administrator." });
    }

    const isMatch = bcryptjs.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // Record login timestamp
    user.lastLogin = new Date().toISOString();
    saveUser(user);

    // Exclude password hash from response
    const { password: _, ...userWithoutPassword } = user;
    const token = generateToken(userWithoutPassword);

    res.json({
      token,
      user: userWithoutPassword,
    });
  });

  // Auth: Get Current Profile
  app.get("/api/auth/me", authenticateJWT, (req, res) => {
    const authReq = req as AuthenticatedRequest;
    res.json({ user: authReq.user });
  });

  // --- USER MANAGEMENT ENDPOINTS (Admin Only) ---

  // GET /api/users - Get all accounts
  app.get("/api/users", authenticateJWT, requireRole(["admin"]), async (req, res) => {
    const users = (await getUsers()).map(({ password, ...u }) => u);
    res.json(users);
  });

  // POST /api/users - Create a new account
  app.post("/api/users", authenticateJWT, requireRole(["admin"]), async (req, res) => {
    const { username, role, customer_name, email, status, password } = req.body;

    if (!username || !role) {
      return res.status(400).json({ error: "Username and role are required." });
    }

    // Check duplicate username
    const users = await getUsers();
    const exists = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: "Username already exists." });
    }

    const created = saveUser({
      username,
      role,
      customer_name: customer_name || username,
      email: email || "",
      status: status || "active",
      password: password || "customer123"
    });

    const { password: _, ...responseUser } = created;
    res.status(201).json(responseUser);
  });

  // PUT /api/users/:id - Update user account
  app.put("/api/users/:id", authenticateJWT, requireRole(["admin"]), async (req, res) => {
    const { id } = req.params;
    const { username, role, customer_name, email, status, password } = req.body;

    const users = await getUsers();
    const user = users.find((u) => u.id === id);
    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    // Check duplicate username if updated
    if (username && username.toLowerCase() !== user.username.toLowerCase()) {
      const exists = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
      if (exists) {
        return res.status(400).json({ error: "Username already exists." });
      }
    }

    const updated = saveUser({
      id,
      username: username || user.username,
      role: role || user.role,
      customer_name: customer_name !== undefined ? customer_name : user.customer_name,
      email: email !== undefined ? email : user.email,
      status: status !== undefined ? status : user.status,
      password: password // optional
    });

    const { password: _, ...responseUser } = updated;
    res.json(responseUser);
  });

  // DELETE /api/users/:id - Delete user account
  app.delete("/api/users/:id", authenticateJWT, requireRole(["admin"]), async (req, res) => {
    const { id } = req.params;

    // Prevent self-deletion
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.id === id) {
      return res.status(400).json({ error: "You cannot delete your own admin account." });
    }

    const deleted = deleteUserById(id);
    if (deleted) {
      res.json({ success: true, message: "User account deleted successfully." });
    } else {
      res.status(404).json({ error: "User account not found." });
    }
  });

  // Customers Profiles List (Admin Only)
  app.get("/api/customers", authenticateJWT, requireRole(["admin"]), async (req, res) => {
    const users = (await getUsers()).filter((u) => u.role === "customer");
    const orders = await getOrders();

    const customerProfiles = users.map((customer) => {
      const customerOrders = orders.filter((o) => o.customerId === customer.id);

      const totalAmount = customerOrders.reduce((sum, o) => sum + o.line_total, 0);
      const totalPaid = customerOrders.reduce((sum, o) => sum + o.paid_amount, 0);
      const totalRemaining = customerOrders.reduce((sum, o) => sum + o.remaining_amount, 0);

      return {
        id: customer.id,
        username: customer.username,
        customer_name: customer.customer_name || customer.username,
        totalAmount: Number(totalAmount.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        totalRemaining: Number(totalRemaining.toFixed(2)),
        orderCount: customerOrders.length,
      };
    });

    res.json(customerProfiles);
  });

  // Orders: GET (Admin gets all, Customer gets only their OWN - strict isolation)
  app.get("/api/orders", authenticateJWT, async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user!;
    const orders = await getOrders();

    if (user.role === "admin") {
      res.json(orders);
    } else {
      // Customer: strictly isolate their own orders
      const filteredOrders = (await orders).filter((o) => o.customerId === user.id);
      res.json(filteredOrders);
    }
  });

  // Orders: POST (Admin Only - Create or Update)
  app.post("/api/orders", authenticateJWT, requireRole(["admin"]), async (req, res) => {
    const { id, customerId, productName, unitPrice, weight, qty, paidAmount } = req.body;

    if (!customerId || !productName || unitPrice === undefined || weight === undefined || qty === undefined || paidAmount === undefined) {
      return res.status(400).json({ error: "All calculations grid fields are required." });
    }

    // Resolve customer_name from the users collection
    const users = await getUsers();
    const customer = users.find((u) => u.id === customerId);
    if (!customer) {
      return res.status(400).json({ error: "Selected customer profile does not exist." });
    }

    const saved = saveOrder({
      id,
      customerId,
      customer_name : customer.customer_name || customer.username,
      productName,
      unitPrice: Number(unitPrice),
      weight: Number(weight),
      qty: Number(qty),
      paidAmount: Number(paidAmount),
    });

    res.json(saved);
  });

  // Orders: DELETE (Admin Only)
  app.delete("/api/orders/:id", authenticateJWT, requireRole(["admin"]), (req, res) => {
    const deleted = deleteOrder(req.params.id);
    if (deleted) {
      res.json({ success: true, message: "Order calculations line removed successfully." });
    } else {
      res.status(404).json({ error: "Order calculation line not found." });
    }
  });

  // Supplier Inventory: GET (Admin Only)
  app.get("/api/supplier-inventory", authenticateJWT, requireRole(["admin"]), (req, res) => {
    const inventory = getSupplierInventory();
    res.json(inventory);
  });

  // Supplier Inventory: POST (Admin Only - Create or Update)
  app.post("/api/supplier-inventory", authenticateJWT, requireRole(["admin"]), (req, res) => {
    const { id, supplierName, itemType, quantity, costPrice, sourcingWeight, dateReceived } = req.body;

    if (!supplierName || !itemType || !quantity || costPrice === undefined || sourcingWeight === undefined || !dateReceived) {
      return res.status(400).json({ error: "All supplier inventory fields are required." });
    }

    const saved = saveSupplierInventory({
      id,
      supplierName,
      itemType,
      quantity,
      costPrice: Number(costPrice),
      sourcingWeight: Number(sourcingWeight),
      dateReceived,
    });

    res.json(saved);
  });

  // Supplier Inventory: DELETE (Admin Only)
  app.delete("/api/supplier-inventory/:id", authenticateJWT, requireRole(["admin"]), (req, res) => {
    const deleted = deleteSupplierInventory(req.params.id);
    if (deleted) {
      res.json({ success: true, message: "Supplier inventory record deleted." });
    } else {
      res.status(404).json({ error: "Supplier inventory record not found." });
    }
  });

  // Stats: GET (Admin Only)
  app.get("/api/stats", authenticateJWT, requireRole(["admin"]), async (req, res) => {
    const orders = getOrders();
    const inventory = getSupplierInventory();
    const users = (await getUsers()).filter((u) => u.role === "customer");

    const totalReceivables = (await orders).reduce((sum, o) => sum + o.remainingAmount, 0);
    const totalTransactions = (await orders).reduce((sum, o) => sum + o.lineTotal, 0);
    const totalCollected = (await orders).reduce((sum, o) => sum + o.paidAmount, 0);

    // Total Sourcing Cost
    const totalSourcingCost = (await inventory).reduce((sum, i) => sum + (i.costPrice * parseFloat(i.quantity) || i.costPrice), 0);

    res.json({
      activeCustomers: users.length,
      totalTransactions: Number(totalTransactions.toFixed(2)),
      totalCollected: Number(totalCollected.toFixed(2)),
      totalReceivables: Number(totalReceivables.toFixed(2)),
      totalSourcingCost: Number(totalSourcingCost.toFixed(2)),
    });
  });

  // --- VITE MIDDLEWARE SETUP ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      configFile: "./vite.config.ts",
      server: {
        middlewareMode: true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ASComm Server running on http://0.0.0.0:${PORT} under NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
