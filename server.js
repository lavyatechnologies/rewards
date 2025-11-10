// server.js
import express from 'express';
import axios from 'axios'; 
import mysql from 'mysql2';
import cors from 'cors';
import bodyParser from 'body-parser';
import util from 'util';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import https from 'https';
import fs from 'fs';
import { Client } from "whatsapp-web.js";
import qrcode from 'qrcode-terminal';
import { glob } from "glob";  
import { promisify } from "util";
import Razorpay from "razorpay";
import crypto from "crypto";
// const URL = "http://localhost:3002";
const app = express();
app.set('trust proxy', true);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = process.env.PORT || 3002;
const globPromise = promisify(glob);

// Static folders
app.use('/slider', express.static(path.join(__dirname, 'slider')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/logos', express.static(path.join(__dirname, 'logos')));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MySQL Pool
// const pool = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'saralrewards',
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     multipleStatements: true
// });

// MySQL Pool
// const pool = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     password: '3307',
//     database: 'saralrewardsreactdb',
//      port: 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     multipleStatements: true
// });


const pool = mysql.createPool({
    host: '103.21.58.4',
    user: 'saralrewardsreact',
    password: 'saral@rewardsreact',
    database: 'saralrewardsreactdb',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true
});






// Test DB connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to DB:', err);
        return;
    }
    console.log('Connected to MySQL database');
    connection.release();
});

// Promisify query
const query = util.promisify(pool.query).bind(pool);

// ===== MULTER SETUP - DEFINE EARLY =====
// Logo Storage
//const logoStorage = multer.diskStorage({
 // destination: (req, file, cb) => cb(null, "logos/"),
//  filename: (req, file, cb) => cb(null, file.originalname),
//});
//const uploadLogo = multer({ storage: logoStorage });
const logoDir = path.join(__dirname, "logos");
if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logoDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const uploadLogo = multer({ storage: logoStorage });


// Regular uploads
//const storage = multer.diskStorage({
 // destination: (req, file, cb) => cb(null, 'uploads/'),
 // filename: (req, file, cb) => cb(null, file.originalname)
//});
//const upload = multer({ storage });
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Gift uploads
const giftDir = path.join(__dirname, "gift");
if (!fs.existsSync(giftDir)) fs.mkdirSync(giftDir);
const storagegift = multer.diskStorage({
  destination: (req, file, cb) => cb(null, giftDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const uploadgift = multer({ storage: storagegift });

// Slider directory
//const SLIDER_DIR = path.join(__dirname, 'slider');
//if (!fs.existsSync(SLIDER_DIR)) fs.mkdirSync(SLIDER_DIR, { recursive: true });
const  SLIDER_DIR = path.join(__dirname, "slider");
if (!fs.existsSync( SLIDER_DIR)) fs.mkdirSync( SLIDER_DIR, { recursive: true });

const storageSlider = multer.diskStorage({
  destination: (req, file, cb) => cb(null, sliderDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const uploadSlider = multer({ storage: storageSlider });

// ---------- ROUTES ----------

// Root check
app.get('/check', (req, res) => {
  res.send('Welcome to the API!');
});



// Razorpay instance
const razorpay = new Razorpay({
  // key_id: "rzp_test_RZa5NEeFkZpL4v",
  // key_secret: "1K2HFkgh6S5w62GiO6k0tuhM",
  key_id: "rzp_live_Rdueu2VqCCamfY",
  key_secret: "hXTwI7JxJ8f3ywDDya9FJdzX", 
});

// Create order endpoint
// ✅ Create order endpoint
app.post("/create-order", async (req, res) => {
  try {
    const { amount, currency, loginId } = req.body;

    if (!amount || !loginId) {
      return res.status(400).json({ success: false, message: "Missing amount or loginId" });
    }

    const options = {
      amount: amount * 100, // convert to paise
      currency: currency || "INR",
      receipt: `receipt_${Date.now()}`,
    };

    // 1️⃣ Create Razorpay order
    const order = await razorpay.orders.create(options);

    // 2️⃣ Check if Razorpay responded successfully
    if (!order || !order.id || order.status !== "created") {
      console.error("❌ Razorpay order creation failed:", order);
      return res.status(400).json({
        success: false,
        message: "Failed to create Razorpay order.",
      });
    }

    // 3️⃣ Insert into DB only after success
    // await pool.promise().query("CALL InsertOrder(?, ?, ?)", [
    //   order.id,          // Razorpay order ID
    //   loginId,           // User ID
    //   order.amount / 100 // amount in rupees
    // ]);

    // 4️⃣ Return success to frontend
    res.json({
      success: true,
      message: "Order created successfully.",
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error("❌ Create order error:", err);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
});


// Payment success endpoint
app.post("/payment-success", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // 1️⃣ Verify Razorpay signature
    const generated_signature = crypto
      // .createHmac("sha256", "1K2HFkgh6S5w62GiO6k0tuhM")
.createHmac("sha256", "hXTwI7JxJ8f3ywDDya9FJdzX")

        
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed!" });
    }

    // 2️⃣ Fetch order details from Razorpay to get amount + created_at
    const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
    const amount = orderDetails.amount / 100; // in rupees
   // const createdOn = new Date(orderDetails.created_at * 1000); // Convert to JS date
// Razorpay created_at UNIX timestamp (seconds)
const createdOn = new Date(orderDetails.created_at * 1000);

// Convert to IST
const offset = 5.5 * 60; // IST = UTC + 5:30
const istDate = new Date(createdOn.getTime() + offset * 60 * 1000);

// Convert to MySQL DATETIME format
const mysqlDatetime = istDate.toISOString().slice(0, 19).replace('T', ' ');



      
    // 3️⃣ Insert into DB with Created_ON
    await pool.promise().query("CALL InsertOrder(?, ?, ?, ?)", [
      razorpay_order_id,
      userId,
      amount,
      mysqlDatetime
    ]);

    // 4️⃣ Update validity (1 year extension)
    const [rows] = await pool.promise().query("CALL UpdateValidity(?)", [userId]);
    const newValidityRow = Array.isArray(rows) && rows[0] && rows[0][0] ? rows[0][0] : null;
    const newValidity = newValidityRow ? newValidityRow.NewValidityDate : null;

    // 5️⃣ Respond to frontend
    res.json({
      success: true,
      message: "Payment verified, order saved, and validity updated!",
      amount,
      createdOn,
      newValidity
    });

  } catch (err) {
    console.error("Payment success error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});






app.get("/api/orders", async (req, res) => {
  try {
    const [rows] = await pool.promise().query("CALL GetAllOrders()");
    res.json({ success: true, orders: rows[0] });
  } catch (err) {
    console.error("❌ Fetch all orders error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});






// Signup
app.post('/api/signup', async (req, res) => {
  const { businessName, mobile, password } = req.body;
  if (!businessName || !mobile || !password) return res.status(400).json({ error: "All fields required" });

  try {
    const [results] = await pool.promise().query("CALL sp_signup_user(?, ?, ?)", [businessName, mobile, password]);
    const user = results[0][0];
    if (user && user.id) return res.json({ success: true, user });
    return res.status(500).json({ success: false, error: "User creation failed" });
  } catch (err) {
    console.error("Signup error:", err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: "Mobile number already exists." });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { mobile, password } = req.body;
  if (!mobile || !password) return res.status(400).json({ success: false, message: "Mobile and password required" });

  try {
    const sql = `
      CALL sp_login_user(?, ?, @id, @businessName, @phone, @isEnable, @validityDate, @waApi, @waEnabled, @role, @pointPerc,@IsPointMode, @cityId, @maxDeals);
      SELECT 
        @id AS id,
        @businessName AS businessName,
        @phone AS mobile,
        @isEnable AS isEnable,
        @validityDate AS validityDate,
        @waApi AS WA_API,
        @waEnabled AS WA_enabled,
        @role AS role,
        @pointPerc AS pointPercentage,
          @IsPointMode AS IsPointMode,
           @cityId AS cityId,
            @maxDeals AS maxAllowedDeals; 
        ;
    `;
    const [results] = await pool.promise().query(sql, [mobile, password]);
    const user = results[1][0];

    if (user.id && user.id !== 0) return res.json({ success: true, user });
    res.json({ success: false, message: "Invalid credentials or account expired/disabled" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// Add Customer
app.post('/api/add-customer', async (req, res) => {
  const { Name, Mobile, fLoginID, Birthday, Anniversary } = req.body;
  if (!Name || !Mobile || !fLoginID) {
    return res.status(400).json({ success: false, message: "All fields required" });
  }

  try {
    await query("CALL sp_add_customer(?, ?, ?, ?, ?)", [Name, Mobile, fLoginID, Birthday, Anniversary]);
    res.json({ success: true, message: "Customer added successfully!" });
  } catch (err) {
    console.error("Add customer error:", err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: "Mobile number already exists." });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Issue Points
app.post("/api/issue-points", async (req, res) => {
  const { fCustomerID, Points, Narration } = req.body;
  if (!fCustomerID || !Points) return res.status(400).json({ success: false, message: "Missing fields" });

  try {
    await pool.promise().query("CALL sp_issue_points(?, ?, ?)", [fCustomerID, Points, Narration || '']);
    res.json({ success: true });
  } catch (err) {
    console.error("Issue points error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get Customers by LoginID
app.get('/api/customers', async (req, res) => {
  const { fLoginID } = req.query;
  if (!fLoginID) return res.status(400).json({ message: "fLoginID required" });

  try {
    const [rows] = await pool.promise().query("CALL sp_get_customers(?)", [fLoginID]);
    res.json(rows[0]);
  } catch (err) {
    console.error("Fetch customers error:", err);
    res.status(500).json({ message: "Error fetching customers" });
  }
});

// Update Customer
app.put('/api/update-customer', async (req, res) => {
  const { CustomerID, Name, Mobile, fLoginID, Birthday, Anniversary } = req.body;
  if (!CustomerID || !Name || !Mobile || !fLoginID) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    await pool.promise().query("CALL sp_update_customer(?, ?, ?, ?, ?, ?)", 
      [CustomerID, Name, Mobile, fLoginID, Birthday, Anniversary]);
    res.json({ success: true, message: "Customer updated successfully" });
  } catch (err) {
    console.error("Update customer error:", err);

    // Map MySQL "wrong value for type" to friendly message
    if (err && (err.code === 'ER_WRONG_VALUE_FOR_TYPE' || err.errno === 1411)) {
      return res.status(400).json({
        success: false,
        message: "Failed to update. Please check date values (Birthday/Anniversary)."
      });
    }
    res.status(500).json({ success: false, message: "Error updating customer" });
  }
});

// Delete Customer
app.delete('/api/delete-customer/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, message: "CustomerID required" });

  try {
    await pool.promise().query("CALL sp_delete_customer(?)", [id]);
    res.json({ success: true, message: "Customer deleted successfully" });
  } catch (err) {
    console.error("Delete customer error:", err);
    res.status(500).json({ success: false, message: "Error deleting customer" });
  }
});

// Get Profile
app.get('/api/profile', async (req, res) => {
  const { loginId } = req.query;
  if (!loginId) return res.status(400).json({ message: "loginId required" });

  try {
    const [rows] = await pool.promise().query("CALL sp_get_profile(?)", [loginId]);
    if (rows[0].length === 0) return res.status(404).json({ message: "Profile not found" });
    res.json(rows[0][0]);
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// ===== UPDATE PROFILE WITH LOGO =====
// ===== UPDATE PROFILE WITH LOGO =====
app.post("/api/profile/update", uploadLogo.single("Logo"), async (req, res) => {
  const { LoginID, BusinessName, Password, PointPercentage, IsPointMode } = req.body;

  if (!LoginID || !BusinessName || !Password || PointPercentage === undefined || IsPointMode === undefined) {
    return res.status(400).json({ message: "All fields required" });
  }

  try {
    // Fetch old logo
    const [existingRows] = await pool.promise().query("SELECT Logo FROM login WHERE LoginID = ?", [LoginID]);
    let logoFilename = existingRows[0]?.Logo || "";

    // ===== Handle Logo Upload =====
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const newLogoName = `${LoginID}${ext}`;
      const destPath = path.join(__dirname, "logos", newLogoName);

      // Delete old logo if exists
      if (logoFilename) {
        const oldPath = path.join(__dirname, "logos", logoFilename);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.warn("⚠️ Failed to delete old logo:", e);
          }
        }
      }

      // Move new logo to final destination
      fs.renameSync(req.file.path, destPath);
      logoFilename = newLogoName;
    }

    // ===== Call Stored Procedure to update profile (including logo) =====
    await pool
      .promise()
      .query("CALL sp_update_profile(?, ?, ?, ?, ?, ?)", [
        LoginID,
        BusinessName,
        Password,
        PointPercentage,
        IsPointMode,
        logoFilename,
      ]);

    res.json({
      success: true,
      message: "✅ Profile updated successfully",
      logo: logoFilename,
    });
  } catch (err) {
    console.error("❌ Update profile error:", err);
    res.status(500).json({ message: "Error updating profile", error: err.message });
  }
});

// Redeem Points
app.post('/api/redeem-points', async (req, res) => {
  const { fCustomerID, Points, Narration } = req.body;
  if (!fCustomerID || !Points)
    return res.status(400).json({ success: false, message: "CustomerID and Points required" });

  try {
    const sql = `
      CALL sp_redeem_points(?, ?, ?, @pSuccess, @pMessage);
      SELECT @pSuccess AS success, @pMessage AS message;
    `;

    const [results] = await pool.promise().query(sql, [fCustomerID, Points, Narration || '']);
    
    // results[1] contains the OUT parameters
    const outParams = results[1][0];
    
    res.json({ success: outParams.success === 1, message: outParams.message });
  } catch (err) {
    console.error("Redeem points error:", err);
    res.status(500).json({ success: false, message: "Error redeeming points" });
  }
});

// Customer Points
app.get('/api/customer-points', async (req, res) => {
  const { customerId } = req.query;
  if (!customerId) return res.status(400).json({ success: false, message: "customerId required" });

  try {
    const [rows] = await pool.promise().query("CALL sp_get_total_points(?)", [customerId]);
    res.json({ success: true, total: rows[0][0].totalPoints });
  } catch (err) {
    console.error("Customer points error:", err);
    res.status(500).json({ success: false, message: "Error fetching points" });
  }
});

// Users API
app.get("/api/users", async (req, res) => {
  try {
    const [rows] = await pool.promise().query("CALL sp_get_users()");
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Add User with Logo
app.post("/api/add-user", uploadLogo.single("Logo"), async (req, res) => {
  const IsEnable = parseInt(req.body.IsEnable) || 0;
  const WA_enabled= parseInt(req.body.WA_enabled) || 0;
  
  try {
    const {
      BusinessName, PhoneNumber, Password, Role, IsEnable,
      WA_enabled, Point_Percentage, WA_API, ValidityDate,
      CityID, CategoryID, Map, Address, CallContactNo, IsPointMode, MaxAllowedDeals
    } = req.body;

    const isPointMode = parseInt(IsPointMode) || 0;

   
    const [result] = await pool.promise().query(
      "CALL sp_add_user(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        BusinessName, PhoneNumber, Password, Role,
        IsEnable, WA_enabled , Point_Percentage,
        WA_API || "", ValidityDate, CityID, CategoryID || null,
        Map || "", Address || "", CallContactNo || "",isPointMode, "", MaxAllowedDeals || 0
      ]
    );

    const loginID = result[0][0].LoginID;
    let logoFilename = "";

   
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      logoFilename = `${loginID}${ext}`;
      const destPath = path.resolve("logos", logoFilename);
      fs.renameSync(req.file.path, destPath);

    
      await pool.promise().query(
        "UPDATE login SET Logo = ? WHERE LoginID = ?",
        [logoFilename, loginID]
      );
    }

    res.json({ success: true, loginID, logo: logoFilename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Update User
app.put("/api/update-user", uploadLogo.single("Logo"), async (req, res) => {
  try {
    const body = req.body || {};
    const {
      LoginID, BusinessName, PhoneNumber, Password, Role, IsEnable,
      WA_enabled, IsPointMode, Point_Percentage, WA_API, ValidityDate,
      CityID, CategoryID, Map, Address, CallContactNo, MaxAllowedDeals
    } = body;
         
    if (!LoginID) return res.status(400).json({ success: false, message: "LoginID is required" });

    const isEnable = parseInt(IsEnable) || 0;
    const waEnabled = parseInt(WA_enabled) || 0;
    const isPointMode = parseInt(IsPointMode) || 0;

 
    const [existingRows] = await pool.promise().query("SELECT Logo FROM login WHERE LoginID = ?", [LoginID]);
    if (existingRows.length === 0) return res.status(404).json({ success: false, message: "User not found" });

    let logoFilename = existingRows[0].Logo;

    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const newLogoName = `${LoginID}${ext}`;
      const destPath = path.join(__dirname, "logos", newLogoName);

    
      const oldPath = logoFilename ? path.join(__dirname, "logos", logoFilename) : null;
      if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

      fs.renameSync(req.file.path, destPath);
      logoFilename = newLogoName;
    }

    await pool.promise().query(
      `UPDATE login SET
        BusinessName = ?, PhoneNumber = ?, Password = ?, Role = ?, IsEnable = ?, WA_enabled = ?,
        IsPointMode = ?, Point_Percentage = ?, WA_API = ?, ValidityDate = ?, fCityID = ?, fCategoryID = ?,
        Map = ?, Address = ?, CallContactNo = ?, Logo = ?, MaxAllowedDeals = ?
      WHERE LoginID = ?`,
      [
        BusinessName || "", PhoneNumber || "", Password || "", Role || "", isEnable, waEnabled,
        isPointMode, Point_Percentage || 0, WA_API || "", ValidityDate || null, CityID || null, CategoryID || null,
        Map || "", Address || "", CallContactNo || "", logoFilename || "", MaxAllowedDeals || 0, LoginID
      ]
    );

    res.json({ success: true, message: "User updated", logo: logoFilename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

app.get("/api/cities", async (req, res) => {
  try {
    const [rows] = await pool.promise().query("CALL sp_get_cities()");
    res.json(rows[0]); // rows[0] contains the actual data
  } catch (err) {
    console.error("Error fetching cities:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Delete User
app.delete("/api/delete-user/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Get the current logo filename
    const [existingRows] = await pool.promise().query(
      "SELECT Logo FROM login WHERE LoginID = ?",
      [id]
    );

    let logoFilename = "";
    if (existingRows.length > 0) {
      logoFilename = existingRows[0].Logo;
    }

    // 2️⃣ Delete the user via stored procedure
    await pool.promise().query("CALL sp_delete_user(?)", [id]);

    // 3️⃣ Delete logo file if exists
    if (logoFilename) {
      const logoPath = path.join(__dirname, "logos", logoFilename);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// WhatsApp Send
app.post("/api/send-whatsapp", async (req, res) => {
  try {
    const { mobile, message, waApi } = req.body;

    if (!waApi) {
      return res.status(400).json({ error: "WA_API not provided" });
    }

    const apiUrl = `https://wa.lavyatech.com/api/send_text?number=${mobile}&message=${encodeURIComponent(message)}&instance_id=${waApi}`;

    // HTTPS agent to bypass expired SSL cert
    const agent = new https.Agent({ rejectUnauthorized: false });

    const response = await fetch(apiUrl, { agent });

    // 🔹 Use text() only once and try parsing JSON
    const raw = await response.text(); 
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      data = raw; // fallback to raw text if not JSON
    }

    console.log("WhatsApp response:", data);
    res.json({ success: true, data });

  } catch (err) {
    console.error("Error sending WhatsApp:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.get("/api/history/customers/:loginId", async (req, res) => {
  try {
    const loginId = req.params.loginId;
    const [results] = await pool.promise().query("CALL sp_get_customer_points(?)", [loginId]);
    res.json(results[0]);  // MySQL returns results as an array
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get points history for a specific customer
app.get("/api/history/points/:customerId", async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const [results] = await pool.promise().query("CALL sp_get_points_history(?)", [customerId]);
    res.json(results[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/dashboard/:loginID", async (req, res) => {
  const loginID = req.params.loginID;

  try {
    const [results] = await pool
      .promise()
      .query("CALL sp_get_dashboard_data(?)", [loginID]);

    // results[0] contains the SELECT output
    res.json(results[0][0]);
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    res.status(500).json({ success: false, message: "Server error", error: err });
  }
});

app.delete("/api/history/delete-point/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.promise().query("CALL sp_delete_point(?)", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error deleting point" });
  }
});

app.get("/api/offers", async (req, res) => {
  const { fLoginID } = req.query;
  if (!fLoginID) return res.json([]);

  try {
    const [rows] = await pool.promise().query("CALL sp_get_offers(?)", [fLoginID]);
    res.json(rows[0] || []);
  } catch (err) {
    console.error("Error fetching offers:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get Offers for a User
app.get("/api/offers1", async (req, res) => {
  const { fLoginID } = req.query;
  if (!fLoginID) return res.json([]);

  try {
    const [rows] = await pool.promise().query("CALL sp_get_offers1(?)", [fLoginID]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add Offer
app.post("/api/offers", async (req, res) => {
  const { Offer, Points, fLoginID } = req.body;
  try {
    await pool.promise().query("CALL sp_add_offer(?, ?, ?)", [Offer, Points, fLoginID]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
 if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, message: "Duplicate Entry" });
    }
      
    res.status(500).json({ success: false, message: "Failed to add offer" });
  }
});

// Update Offer
app.put("/api/offers", async (req, res) => {
  const { OfferID, Offer, Points } = req.body;
  try {
    await pool.promise().query("CALL sp_update_offer(?, ?, ?)", [OfferID, Offer, Points]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
  if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, message: "Duplicate Entry" });
    }
      
    res.status(500).json({ success: false, message: "Failed to update offer" });
  }
});

// Delete Offer
app.delete("/api/offers/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.promise().query("CALL sp_delete_offer(?)", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to delete offer" });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ success: false, message: "Mobile number required." });
  let finalNumber = mobile.trim();

  // अगर पहले से +91 नहीं है तो prepend कर दो
  if (!finalNumber.startsWith("91")) {
    finalNumber = "91" + finalNumber;
  }

  try {
    const [rows] = await pool.promise().query("CALL sp_get_password_by_mobile(?)", [mobile]);
    const userRow = rows[0][0];
    if (!userRow) return res.status(404).json({ success: false, message: "Mobile number not found." });

    const { Password, AdminWA,BusinessName } = userRow; // AdminWA is the instance_id

    const waMessage = `Hello ${BusinessName},

We received a request to reset the password for your Saral Rewards Points account.

Here are your new login details:

🔑 Temporary Password: ${Password}

Please log in and change your password immediately.`;

    // Construct API URL
    const apiUrl = `https://wa.lavyatech.com/api/send_text?number=${finalNumber }&message=${encodeURIComponent(waMessage)}&instance_id=${AdminWA}`;

    // HTTPS agent to bypass SSL if needed
    const agent = new https.Agent({ rejectUnauthorized: false });

    // Send request
    const response = await fetch(apiUrl, { agent });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } 
    catch (err) { data = raw; }

    console.log("WhatsApp response:", data);

    res.json({ success: true, message: "✅ Reset password sent on WhatsApp. Please check your message.", data });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

app.get('/api/offersTR', async (req, res) => {
  const uid = req.query.uid;
  console.log('UID received in API:', uid);

  if (!uid) {
    return res.status(400).json({ message: 'UID is required' });
  }

  try {
    const [results] = await pool.promise().query('CALL GetUserOffers(?)', [uid]);

    // ✅ results[0] is always the actual rows
    const rows = results[0];
    console.log("Parsed rows:", rows);

    res.json(rows || []);
  } catch (err) {
    console.error('❌ Error fetching user offers:', err);
    res.status(500).json({ message: 'Failed to fetch offers' });
  }
});

app.get("/api/offersTR/Admin", async (req, res) => {
  try {
    const [results] = await pool.promise().query("CALL GetUserOffersAdmin()");
    const offers = results[0]; // ✅ extract actual rows

    res.status(200).json(offers); // send clean array directly
  } catch (err) {
    console.error("❌ Error fetching Offer:", err);
    res.status(500).json({ error: "Database error while fetching Offer" });
  }
});

// Offer insertion API
app.post('/api/offers/add', upload.single('photo'), async (req, res) => {
  const { title, details, validTill, fUID } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: 'Photo is required' });
  }

  const ext = path.extname(file.originalname).slice(1); // e.g., 'jpg'

  try {
    // Step 1: Call stored procedure
    await pool.promise().query(
      'CALL InsertOffer(?, ?, ?, ?, ?, @newOfferID)',
      [title, details, validTill, ext, fUID]
    );

    // Step 2: Fetch @newOfferID
    const [rows] = await pool.promise().query('SELECT @newOfferID AS offerId');
    const offerId = rows[0]?.offerId;

    if (!offerId) {
      return res.status(500).json({ message: 'Offer ID not generated' });
    }

    // Step 3: Rename uploaded file to OfferID.extension
    const newFileName = `${offerId}.${ext}`;
    const oldPath = file.path;
    const newPath = path.join('uploads', newFileName);

    await fs.promises.rename(oldPath, newPath);

    res.status(200).json({ message: 'Offer added successfully' });
  } catch (err) {
    console.error('Error adding offer:', err);
    res.status(500).json({ message: err.sqlMessage || 'Failed to add offer' });
  }
});

app.post('/api/offers/update', upload.single('photo'), async (req, res) => {
  const { title, details, validTill, fUID, offerId } = req.body;
  const photoExt = req.file ? path.extname(req.file.originalname).slice(1) : null;

  try {
    // Step 1: Get current photo filename
    const [rows] = await pool.promise().query(
      'SELECT Photo FROM deals WHERE DealID = ?',
      [offerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    const oldPhoto = rows[0].Photo;
    const oldPhotoPath = path.join(__dirname, 'uploads', oldPhoto);

    // Step 2: Update offer via stored procedure
    await pool.promise().query(
      'CALL UpdateOffer(?, ?, ?, ?, ?, ?)',
      [offerId, title, details, validTill, photoExt, fUID]
    );

    // Step 3: If new photo uploaded
    if (req.file && photoExt) {
      // Step 4: Delete old photo if exists
      try {
        await fs.promises.unlink(oldPhotoPath);
        console.log(`🗑️ Deleted old photo: ${oldPhotoPath}`);
      } catch (deleteErr) {
        // File may not exist, log only
        console.warn('⚠️ Error deleting old photo (maybe missing):', deleteErr.message);
      }

      // Step 5: Rename newly uploaded file
      const newPath = path.join('uploads', `${offerId}.${photoExt}`);
      await fs.promises.rename(req.file.path, newPath);

      return res.status(200).json({ message: 'Offer updated successfully with new photo.' });
    }

    // No new photo case
    res.status(200).json({ message: 'Offer updated successfully without new photo.' });
  } catch (err) {
    console.error('Error updating offer:', err);
    res.status(500).json({ message: err.sqlMessage || 'Failed to update offer' });
  }
});

app.post('/api/offers/delete', async (req, res) => {
  const { offerId } = req.body;
  console.log("Deleting offer:", offerId);

  try {
    // 1️⃣ Get exact photo filename from DB
    const [rows] = await pool.promise().query(
      'SELECT Photo FROM deals WHERE DealID = ?',
      [offerId]
    );

    const photo = rows[0]?.Photo;
    if (photo) {
      const photoPath = path.join(__dirname, 'uploads', photo);

      try {
        await fs.promises.unlink(photoPath);
        console.log(`🗑️ Deleted photo: ${photoPath}`);
      } catch (unlinkErr) {
        console.warn(`⚠️ Could not delete photo: ${photoPath}`, unlinkErr.message);
      }
    }

    // 2️⃣ Delete offer from DB
    await pool.promise().query('CALL DeleteOffer(?)', [offerId]);

    res.status(200).json({ message: 'Offer deleted successfully' });

  } catch (err) {
    console.error('❌ Error deleting offer:', err);
    res.status(500).json({ message: err.sqlMessage || 'Error deleting offer' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.promise().query('CALL GetAllCategories()');

    // rows[0] contains actual data from stored procedure
    res.status(200).json({ categories: rows[0] });
  } catch (err) {
    console.error('❌ Error fetching categories:', err);
    res.status(500).json({ message: err.sqlMessage || 'Failed to fetch categories' });
  }
});

app.post('/api/categories/add', async (req, res) => {
  const { Category, Sequence, Icon } = req.body;

  try {
    const [result] = await pool.promise().query(
      'CALL AddOrUpdateCategory(?,?,?,?)',
      [0, Category, parseInt(Sequence), Icon]
    );

    res.json({ message: 'Category added successfully', result });
  } catch (err) {
    console.error('Insert failed:', err);
    res.status(500).json({ message: 'Insert failed', error: err.sqlMessage || err });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  const id = +req.params.id;
  const { Category, Sequence, Icon } = req.body;

  try {
    const [result] = await pool
      .promise()
      .query('CALL AddOrUpdateCategory(?,?,?,?)', [
        id,
        Category,
        parseInt(Sequence),
        Icon,
      ]);

    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    console.error('Update failed:', err);
    res.status(500).json({ message: 'Update failed', error: err });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  const id = +req.params.id;

  try {
    await pool.promise().query('CALL DeleteCategory(?)', [id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Delete failed:', err);
    res.status(500).json({ message: 'Delete failed', error: err });
  }
});

app.get('/api/slider', async (req, res) => {
  try {
    const [results] = await pool.promise().query('CALL GetAllSliderImage()');
    
    // results[0] contains actual rows
    res.json({ slider: results[0] || [] });
  } catch (err) {
    console.error('❌ Error fetching slider:', err);
    res.status(500).json({ message: 'DB error', error: err });
  }
});

app.post('/api/slider/add', upload.single('image'), async (req, res) => {
  const { title = '', subtitle = '', fCityID = null } = req.body;

  try {
    // 1. Insert initial row without image
    await pool.promise().query(
      'CALL AddOrUpdateSliderImage(?,?,?,?,?)',
      [0, title, subtitle, '', fCityID]
    );

    // 2. Get last insert id
    const [rows] = await pool.promise().query('SELECT LAST_INSERT_ID() AS id');
    if (!rows || rows.length === 0) {
      return res.status(500).json({ message: 'UID fetch failed' });
    }
    const id = rows[0].id;

    // 3. If no file, return early
    if (!req.file) {
      return res.json({ message: 'Slider added (no image)', id });
    }

    // 4. Generate new filename
    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname) || '.jpg';
    const newName = `${id}_${timestamp}${ext}`;
    const newPath = path.join(SLIDER_DIR, newName);

    // 5. Move uploaded file
    await fs.promises.rename(req.file.path, newPath);

    // 6. Update DB with image name
    await pool.promise().query(
      'CALL AddOrUpdateSliderImage(?,?,?,?,?)',
      [id, title, subtitle, newName, fCityID]
    );

    return res.json({
      message: 'Slider added with image',
      id,
      image: newName
    });

  } catch (err) {
    console.error('❌ Slider add failed:', err);
    return res.status(500).json({ message: 'Slider add failed', error: err });
  }
});

app.put('/api/slider/:id', upload.single('image'), async (req, res) => {
  const id = +req.params.id;
  const { title = '', subtitle = '', existingImage = '', fCityID = null } = req.body;

  try {
    // No new image → just update DB with existing filename
    if (!req.file) {
      await pool.promise().query(
        'CALL AddOrUpdateSliderImage(?,?,?,?,?)',
        [id, title, subtitle, existingImage || '', fCityID]
      );
      return res.json({ message: 'Updated slider (no new image)' });
    }

    // Generate new file name
    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname) || '.jpg';
    const newName = `${id}_${timestamp}${ext}`;
    const newPath = path.join(SLIDER_DIR, newName);

    // Delete old image if it exists
    if (existingImage) {
      const oldPath = path.join(SLIDER_DIR, existingImage);
      if (fs.existsSync(oldPath)) {
        try {
          await fs.promises.unlink(oldPath);
        } catch (e) {
          console.warn('⚠️ Failed to delete old image:', e);
        }
      }
    }

    // Move uploaded file into place
    await fs.promises.rename(req.file.path, newPath);

    // Update DB with new filename
    await pool.promise().query(
      'CALL AddOrUpdateSliderImage(?,?,?,?,?)',
      [id, title, subtitle, newName, fCityID]
    );

    return res.json({
      message: 'Slider updated with new image',
      image: newName,
    });

  } catch (err) {
    console.error('❌ Slider update failed:', err);
    res.status(500).json({ message: 'Slider update failed', error: err });
  }
});

app.delete('/api/slider/:id', async (req, res) => {
  const id = +req.params.id;

  try {
    // 1. fetch record to know filename
    const [results] = await pool.promise().query('CALL GetSliderImageById(?)', [id]);
    const row = (results[0] || [])[0];

    if (row && row.image) {
      const p = path.join(SLIDER_DIR, row.image);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (e) {
          console.warn('unlink failed', e);
        }
      }
    }

    // 2. call delete proc
    await pool.promise().query('CALL DeleteSliderImage(?)', [id]);

    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('❌ Error deleting slider:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get("/getcities", async (req, res) => {
  try {
    const [rows] = await pool.promise().query("CALL GetCities()");
    res.status(200).json({ cities: rows });
  } catch (err) {
    console.error("❌ Error fetching cities:", err);
    res.status(500).json({ error: "Database error while fetching cities" });
  }
});

app.get('/api/deals', async (req, res) => {
  try {
    const [result] = await pool.promise().query('CALL GetAllDeals()');

    const deals = result[0].map(row => ({
      id: row.id,
      title: row.Title,
      description: row.description,
      validTill: row.validTill,
      image: `/uploads/${row.image}`,
      shopkeeper: {
        name: row.shopName,
        avatar: `/logos/${row.avatar}`
      },
      UID: row.ShopkeeperUID,
      phone: row.phone,
      address: row.address,
      map: row.mapLocation, // Map location
      categoryID: String(row.CategoryID),
      categoryName: row.CategoryName,
      cityID: String(row.CityID),
      rating: 4.5,
      originalPrice: 100,
      discountPrice: 50
    }));

    res.status(200).json({ deals });
  } catch (err) {
    console.error('Error fetching deals:', err);
    res.status(500).json({ message: 'Database error while fetching deals' });
  }
});

app.get("/api/slider-images", async (req, res) => {
  const cityID = req.query.cityID;
  if (!cityID) {
    return res.status(400).json({ error: "cityID is required" });
  }

  try {
    const [results] = await pool.promise().query("CALL GetSliderImagesByCity(?)", [cityID]);

    const slides = results[0] || [];
      const BASE_URL = `${req.protocol}://${req.get("host")}`;

    const formatted = slides.map((item) => ({
      ...item,
      // url: `http://localhost:3002/slider/${item.image}`,

        url: `${BASE_URL}/slider/${item.image}`,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Error calling stored procedure:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/offers/increment", async (req, res) => {
  const { offerId, actionType } = req.body;
  console.log("Increment API called with:", { offerId, actionType });

  if (!offerId || !actionType) {
    return res.status(400).json({ error: "offerId and actionType are required" });
  }

  try {
    const [result] = await pool.promise().query("CALL IncrementOfferCount(?, ?)", [
      offerId,
      actionType,
    ]);

    console.log("Query Result:", result); // Debug log
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error updating count:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/signupcustomer", async (req, res) => {
  try {
    const { BusinessName, Mobile, Password } = req.body;

    if (!BusinessName || !Mobile || !Password) {
      return res.status(400).json({ message: "Please fill all the required fields." });
    }

    // ✅ Procedure call
    const sql = "CALL InsertCustomer(?, ?, ?)";
    const [rows] = await pool.promise().query(sql, [BusinessName, Mobile, Password]);

    // ✅ Procedure से लौटे हुए result से ID निकाले
    const insertId =
      rows && rows[0] && rows[0][0] && rows[0][0].insertId
        ? rows[0][0].insertId
        : null;

    if (!insertId) {
      return res.status(500).json({ message: "Failed to get inserted customer ID" });
    }

    res.status(200).json({
      message: "User registered successfully!",
      user: {
        CusLoginID: insertId,
        Mobile,
        BusinessName,
      },
    });
  } catch (err) {
    console.error("❌ Error inserting user:", err);

     if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ success: false, message: "Mobile number already exists" });
    }
    res.status(500).json({ message: "Database error while inserting user" });
  }
});

app.post("/api/logincustomer", async (req, res) => {
  const { Mobile, Password } = req.body;

  if (!Mobile || !Password) {
    return res
      .status(400)
      .json({ message: "Mobile and Password are required" });
  }

  try {
    const sql = "CALL CheckCustomerLogin(?, ?)";
    const [results] = await pool.promise().query(sql, [Mobile, Password]);

    // Stored procedure returns nested array
    const user = results[0][0];

    if (user) {
      return res.status(200).json({ message: "Login successful", user });
    } else {
      return res.status(401).json({
        message: "Invalid credentials or account expired/inactive",
      });
    }
  } catch (err) {
    console.error("Login query error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

//Vikas Developer
app.post("/api/addCity", async (req, res) => {
  const { City, State, IsActive } = req.body;

  // Validation
  if (!City || !State || IsActive === undefined ) {
      return res.status(400).json({ message: "All fields are required" });
  }

  try {
      const sql = "CALL insertCity(?, ?, ?)";
      const [results] = await pool.promise().query(sql, [
          City,
          State,
          IsActive,
      ]);

      return res.status(200).json({ message: "City added successfully", results: results[0] });
  } catch (err) {
      console.error("Add city error:", err);
      return res.status(500).json({ message: "Database error" });
  }
});

app.get("/api/getCityAdmin", async (req, res) => {
  try {
      const sql = "CALL getCityAdmin()"; // Stored procedure call
      const [results] = await pool.promise().query(sql);

      // Stored procedure returns nested array
      const cities = results[0];

      return res.status(200).json({ message: "Cities fetched successfully", cities });
  } catch (err) {
      console.error("Get city admin error:", err);
      return res.status(500).json({ message: "Database error" });
  }
});

// Update city
app.post("/api/updateCity", async (req, res) => {
  const { CityID, City, State, IsActive } = req.body;

  if (!CityID || !City || !State || IsActive === undefined) {
      return res.status(400).json({ message: "All fields are required" });
  }

  try {
      const sql = "CALL updateCity(?, ?, ?, ?)";
      await pool.promise().query(sql, [CityID, City, State, IsActive]);
      return res.status(200).json({ message: "City updated successfully" });
  } catch (err) {
      console.error("Update city error:", err);
      return res.status(500).json({ message: "Database error" });
  }
});

// Delete city
app.post("/api/deleteCity", async (req, res) => {
  const { CityID } = req.body;

  if (!CityID) {
      return res.status(400).json({ message: "CityID is required" });
  }

  try {
      const sql = "CALL deleteCity(?)";
      await pool.promise().query(sql, [CityID]);
      return res.status(200).json({ message: "City deleted successfully" });
  } catch (err) {
      console.error("Delete city error:", err);
      return res.status(500).json({ message: "Database error" });
  }
});

app.get("/api/getBusinessNameAll", async (req, res) => {
  try {
      const sql = "CALL getBusinessNameAll()"; // Stored procedure call
      const [results] = await pool.promise().query(sql);

      // Stored procedure returns nested array
      const BusinessName = results[0];

      return res.status(200).json({ message: "BusinessName fetched successfully", BusinessName });
  } catch (err) {
      console.error("Get city admin error:", err);
      return res.status(500).json({ message: "Database error" });
  }
});
//End

app.get("/api/customer/points", async (req, res) => {
  const { mobile } = req.query;
   
  if (!mobile) return res.status(400).json({ error: "Mobile number required" });

  try {
    const [results] = await pool.promise().query("CALL GetCustomerPoints(?)", [mobile]);

    // results[0] = summary (BusinessName + Total Points)
    // results[1] = detailed transactions
    // results[2] = points schemes
    res.json({
      summary: results[0],
      details: results[1],
      schemes: results[2]
    });
  } catch (err) {
    console.error("❌ Error fetching customer points:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/check-mobile", async (req, res) => {
  try {
    const { Mobile } = req.body;

    if (!Mobile) {
      return res.status(400).json({ success: false, message: "Mobile number is required" });
    }

    const sql = "CALL CheckMobileExists(?)";
    const [rows] = await pool.promise().query(sql, [Mobile]);

    const count = rows[0][0].count;

    if (count > 0) {
      return res.status(200).json({ success: false, message: "Mobile number already exists" });
    } else {
      return res.status(200).json({ success: true, message: "Mobile number is available" });
    }
  } catch (err) {
    console.error("❌ Error checking mobile:", err);
    res.status(500).json({ success: false, message: "Database error while checking mobile" });
  }
});

app.post("/api/forgot-passwordcustomer", async (req, res) => {
  let mobile;
  try {
    mobile = req.body.mobile;
    console.log("Received mobile:", mobile);

    if (!mobile) {
      return res.status(400).json({ success: false, message: "Mobile is required" });
    }

    // Normalize mobile
    mobile = mobile.toString().replace(/\D/g, "");
    if (mobile.startsWith("0")) mobile = mobile.slice(1);

    const dbMobile = mobile;
    const waMobile = "91" + mobile;

    // Fetch password from DB
    const [rows] = await pool.promise().query("CALL GetUserPassword(?)", [dbMobile]);

    if (!rows || !rows[0] || rows[0].length === 0) {
      return res.status(404).json({ success: false, message: "Mobile number not found" });
    }

    const password = rows[0][0].Password;
    const waApi = "WA21-1739508781";

    // Send WhatsApp message — catch errors internally
    try {
      await axios.post(`${URL}/api/send-whatsapp`, {
        mobile: waMobile,
        message: `We received a request to reset the password for your Saral Rewards Points account.

🔑 Temporary Password: ${password}

Please log in and change your password immediately.`,
        waApi,
      });
    } catch (waError) {
      console.error("WhatsApp API error:", waError.response?.data || waError.message);
      // IMPORTANT: DO NOT throw — frontend still receives success
    }

    // Always return 200 to frontend
    return res.status(200).json({
      success: true,
      message: "✅ Reset password sent on WhatsApp. Please check your message.",
    });

  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------------- Points Scheme APIs ----------------

// Get all points schemes by fLoginID
app.get("/api/pointscheme/:loginId", async (req, res) => {
  try {
    const [rows] = await pool.promise().query("CALL GetPointsSchemes(?)", [req.params.loginId]);
    res.json(rows[0]);
  } catch (err) {
    console.error("Get schemes error:", err);
    res.status(500).json({ error: "Error fetching schemes" });
  }
});

// Add or Update points scheme
app.post("/api/pointsScheme", uploadgift.single("Image"), async (req, res) => {
  const { SchemeID, Gift, Points_Req, fLoginID, ExistingImage } = req.body;

  try {
    // Call SP with empty image initially
    const [rows] = await pool.promise().query(
      "CALL AddOrUpdatePointsScheme(?, ?, ?, ?, ?)",
      [SchemeID || null, Gift, Points_Req, fLoginID, ""]
    );

    const newId = rows[0][0].NewID || rows[0][0].UpdatedID;
    let finalImageName = null;

    if (req.file) {
      // new image selected → rename and save
      finalImageName = `${newId}${path.extname(req.file.originalname)}`;
      const finalPath = path.join(giftDir, finalImageName);
      fs.renameSync(req.file.path, finalPath);

      await pool.promise().query(
        "UPDATE points_scheme SET Image=? WHERE SchemeID=?",
        [finalImageName, newId]
      );
    } else if (ExistingImage) {
      // no new file → keep old image
      await pool.promise().query(
        "UPDATE points_scheme SET Image=? WHERE SchemeID=?",
        [ExistingImage, newId]
      );
      finalImageName = ExistingImage;
    }

    res.json({ success: true, id: newId, image: finalImageName });
  } catch (err) {
    console.error("Add/Update scheme error:", err);

 if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, message: "Duplicate Entry" });
    }
      
    res.status(500).json({ error: "Error saving scheme" });
  }
});

// Delete scheme
app.delete("/api/pointsScheme/:id", async (req, res) => {
  try {
    // Remove image from disk
    const [rows] = await pool.promise().query(
      "SELECT Image FROM points_scheme WHERE SchemeID=?",
      [req.params.id]
    );
    if (rows.length && rows[0].Image) {
      const imgPath = path.join(giftDir, rows[0].Image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await pool.promise().query("CALL DeletePointsScheme(?)", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete scheme error:", err);
    res.status(500).json({ error: "Error deleting scheme" });
  }
});

app.get("/api/redeem-points-scheme", async (req, res) => {
  try {
    const loginID = req.query.fLoginID; // get loginID from query params
    if (!loginID) return res.status(400).json({ error: "fLoginID is required" });

    // Pass loginID to stored procedure
    const [rows] = await pool.promise().query("CALL GetRedeemPointsScheme(?)", [loginID]);

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/dashboard/monthly/:fLoginID", async (req, res) => {
  try {
    const fLoginID = req.params.fLoginID;

    const [rows] = await pool.promise().query("CALL GetMonthlyStats(?)", [fLoginID]);
    const data = rows[0][0]; // first row of first resultset

    res.json({
      totalVisits: data.totalVisits,
      pointsIssued: data.pointsIssued,
      pointsRedeemed: data.pointsRedeemed
    });
  } catch (err) {
    console.error("Monthly Dashboard API error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/birthday/:loginId", async (req, res) => {
  const loginId = req.params.loginId;
  try {
    const [rows] = await pool.promise().query("CALL GetTodaysBirthdays(?)", [loginId]);
    res.json({ success: true, data: rows[0] }); // <-- wrap in success/data
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

app.get("/api/anniversary/:loginId", async (req, res) => {
  const loginId = req.params.loginId;
  try {
    const [rows] = await pool.promise().query("CALL GetTodaysAnniversariesByUser(?)", [loginId]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

app.post("/api/change-password", async (req, res) => {
  const { loginId, oldPassword, newPassword } = req.body;

  if (!loginId || !oldPassword || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const [rows] = await pool
      .promise()
      .query("CALL sp_change_password(?, ?, ?)", [loginId, oldPassword, newPassword]);

    // Stored procedure returns first result set
    const result = rows[0][0]; 
    if (result.success === 1) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/coupon/change-password", async (req, res) => {
  const { CusLoginID, currentPassword, newPassword } = req.body;

  if (!CusLoginID || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {
    const [rows] = await pool
      .promise()
      .query("CALL ChangeUserPassword(?, ?, ?)", [CusLoginID, currentPassword, newPassword]);

    const result = rows[0][0]; // first row of first resultset

    if (result.success === 1) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (err) {
    console.error("Change Password API error:", err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

app.post("/api/register-whatsapp", async (req, res) => {
  const { mobile, qrData } = req.body;

  if (!mobile || !qrData) {
    return res.status(400).json({ message: "Mobile and QR data are required" });
  }

  try {
    // Call stored procedure
    await pool
      .promise()
      .query("CALL sp_register_whatsapp(?, ?)", [mobile, qrData]);

    res.json({ message: "WhatsApp session saved successfully!" });
  } catch (err) {
    console.error("Error saving WhatsApp session:", err);
    res.status(500).json({ message: "Failed to save WhatsApp session" });
  }
});

app.get("/CityCategory/login/:id", async (req, res) => {
  try {
    const [rows] = await pool.promise().query("CALL sp_GetLoginCityCategory(?)", [req.params.id]);
    res.json(rows[0]); // first result set
  } catch (err) {
    console.error("❌ Error in sp_GetLoginCityCategory:", err);
    res.status(500).json({ error: "Failed to fetch user city/category." });
  }
});


// ✅ 2. Get active cities
app.get("/Active/cities", async (req, res) => {
  try {
    const [rows] = await pool.promise().query("CALL sp_GetActiveCities()");
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error in sp_GetActiveCities:", err);
    res.status(500).json({ error: "Failed to fetch cities." });
  }
});


// ✅ 3. Get active categories
app.get("/Active/categories", async (req, res) => {
  try {
    const [rows] = await pool.promise().query("CALL sp_GetActiveCategories()");
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error in sp_GetActiveCategories:", err);
    res.status(500).json({ error: "Failed to fetch categories." });
  }
});


// ✅ 4. Update user’s selected city & category
app.post("/api/updateCityCategory", async (req, res) => {
  const { fUID, fCityID, fCategoryID } = req.body;
  if (!fUID || !fCityID || !fCategoryID)
    return res.status(400).json({ error: "Missing parameters." });

  try {
    await pool.promise().query("CALL sp_UpdateCityCategory(?, ?, ?)", [fUID, fCityID, fCategoryID]);
    res.json({ message: "City and Category updated successfully." });
  } catch (err) {
    console.error("❌ Error in sp_UpdateCityCategory:", err);
    res.status(500).json({ error: "Failed to update city/category." });
  }
});





// Serve images
app.use("/gift", express.static(giftDir));

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);

});











