import express from "express";
import {
  getMyTransactions,
  getTransactionById,
  createTransaction,
} from "../controllers/transactionController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/my-transactions", protect, getMyTransactions);
router.get("/:id", protect, getTransactionById);
router.post("/", protect, createTransaction);

export default router;
