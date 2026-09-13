import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import http from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import { initChatSocket } from "./sockets/chatSocket.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { securitySanitizer } from "./middleware/securitySanitizer.js";

dotenv.config();

// Assert critical production environment variables
if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "your_jwt_secret_key") {
    console.error("FATAL ERROR: JWT_SECRET must be configured with a strong secret in production.");
    process.exit(1);
  }
  if (!process.env.MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI must be configured in production.");
    process.exit(1);
  }
}

const isTestMode =
  process.env.NODE_ENV === "test" ||
  process.execArgv.includes("--test") ||
  process.argv.some((a) => a.includes("test"));

if (!isTestMode) {
  connectDB();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust reverse proxy (e.g. Render, Nginx) for accurate client IP tracking in rate limiting
app.set("trust proxy", 1);

// Security Headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin image loading
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "http://localhost:*", "ws:", "wss:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      },
    },
    xContentTypeOptions: true,
    xFrameOptions: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Secure CORS configuration: Explicit origins with credentials support
const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://college-olx-duzo.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, tests) or matching origins
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Global rate limiting across API endpoints
app.use("/api", globalLimiter);

// Body & cookie parsing with strict payload limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// NoSQL Injection and XSS Sanitization
app.use(securitySanitizer);

// Serve uploaded product images statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "CampusX API is running" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/transactions", transactionRoutes);

// 404 + error handling (must be last)
app.use(notFound);
app.use(errorHandler);

// Create HTTP server wrapping Express app
const httpServer = http.createServer(app);

// Initialize Socket.IO with production CORS configuration matching Express
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Provide io instance on Express app for REST controllers
app.set("io", io);

// Initialize chat socket handlers
initChatSocket(io);

const PORT = process.env.PORT || 5000;

if (!isTestMode) {
  httpServer.listen(PORT, () => {
    console.log(`CampusX API & Real-time Chat server running on port ${PORT}`);
  });
}

export { app, httpServer, io };
export default app;

