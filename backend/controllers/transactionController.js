import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import Product from "../models/Product.js";

// @desc    Get current user's transactions (as buyer or seller)
// @route   GET /api/transactions/my-transactions
// @access  Private
export const getMyTransactions = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    const transactions = await Transaction.find({
      $or: [{ buyer: currentUserId }, { seller: currentUserId }],
    })
      .sort({ createdAt: -1 })
      .populate("product", "title images price category condition")
      .populate("buyer", "name email department year isEmailVerified")
      .populate("seller", "name email department year isEmailVerified");

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single transaction by ID
// @route   GET /api/transactions/:id
// @access  Private
export const getTransactionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID format.",
      });
    }

    const transaction = await Transaction.findById(id)
      .populate("product", "title images price category condition owner")
      .populate("buyer", "name email department year isEmailVerified")
      .populate("seller", "name email department year isEmailVerified");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    const isBuyer = transaction.buyer._id.toString() === currentUserId.toString();
    const isSeller = transaction.seller._id.toString() === currentUserId.toString();

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this transaction.",
      });
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a completed or pending transaction
// @route   POST /api/transactions
// @access  Private
export const createTransaction = async (req, res, next) => {
  try {
    const { productId, amount, status = "COMPLETED", meetupLocation, notes } = req.body;
    const currentUserId = req.user._id;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "A valid product ID is required.",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    // A seller cannot buy their own product
    if (product.owner.toString() === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot create a transaction on your own product.",
      });
    }

    const transactionAmount = amount !== undefined ? Number(amount) : product.price;

    const transaction = new Transaction({
      buyer: currentUserId,
      seller: product.owner,
      product: product._id,
      amount: transactionAmount,
      status: status || "COMPLETED",
      completedAt: status === "COMPLETED" ? new Date() : undefined,
      meetupLocation: meetupLocation || product.location || "",
      notes: notes || "",
    });

    await transaction.save();

    if (status === "COMPLETED") {
      product.status = "Sold";
      await product.save({ validateBeforeSave: false });
    }

    await transaction.populate("product", "title images price");
    await transaction.populate("buyer", "name email department isEmailVerified");
    await transaction.populate("seller", "name email department isEmailVerified");

    res.status(201).json({
      success: true,
      message: "Transaction created successfully.",
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};
