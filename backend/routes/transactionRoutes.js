import express from "express";
import {
  getMyTransactions,
  getProductTransaction,
  getTransactionById,
  createTransaction,
  updateTransactionStatus,
} from "../controllers/transactionController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/", protect, getMyTransactions);
router.get("/my-transactions", protect, getMyTransactions);
router.get("/product/:productId", protect, getProductTransaction);
router.get("/:id", protect, getTransactionById);
router.post("/", protect, createTransaction);
router.patch("/:id/status", protect, updateTransactionStatus);

export default router;
