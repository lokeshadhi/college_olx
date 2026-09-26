import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";

// @desc    Get current user's transactions (as buyer or seller)
// @route   GET /api/transactions/my-transactions
// @access  Private
export const getMyTransactions = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { status, role } = req.query;

    let query = {
      $or: [{ buyer: currentUserId }, { seller: currentUserId }],
    };

    if (role === "buyer") {
      query = { buyer: currentUserId };
    } else if (role === "seller") {
      query = { seller: currentUserId };
    }

    if (status) {
      query.status = status;
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .populate("product", "title images price category condition owner status")
      .populate("buyer", "name email department year isEmailVerified profileImage")
      .populate("seller", "name email department year isEmailVerified profileImage");

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

// @desc    Create a completed or pending transaction (Buy request)
// @route   POST /api/transactions
// @access  Private
export const createTransaction = async (req, res, next) => {
  try {
    const { productId, amount, meetupLocation, notes } = req.body;
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
        message: "You cannot purchase your own product.",
      });
    }

    // A sold product cannot be purchased again
    if (product.status === "Sold") {
      return res.status(400).json({
        success: false,
        message: "This product is already sold and unavailable for purchase.",
      });
    }

    const numericAmount = amount !== undefined ? Number(amount) : Number(product.price);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Bid amount must be a positive number.",
      });
    }
    const transactionAmount = numericAmount;

    // If buyer already has an active pending bid for this product, update their bid offer
    const existingPending = await Transaction.findOne({
      product: productId,
      buyer: currentUserId,
      status: "PENDING",
    });
    if (existingPending) {
      existingPending.amount = transactionAmount;
      if (meetupLocation) existingPending.meetupLocation = meetupLocation;
      if (notes !== undefined) existingPending.notes = notes;
      await existingPending.save();
      await existingPending.populate("product", "title images price");
      await existingPending.populate("buyer", "name email department isEmailVerified");
      await existingPending.populate("seller", "name email department isEmailVerified");

      return res.status(200).json({
        success: true,
        message: "Your bid offer has been updated successfully.",
        data: existingPending,
      });
    }

    // Check if a completed transaction already exists for this product
    const existingTxn = await Transaction.findOne({
      product: productId,
      status: "COMPLETED",
    });
    if (existingTxn) {
      return res.status(400).json({
        success: false,
        message: "A completed transaction already exists for this product.",
      });
    }

    // Check if an accepted transaction already exists for this product
    const existingAccepted = await Transaction.findOne({
      product: productId,
      status: "ACCEPTED",
    });
    if (existingAccepted) {
      return res.status(400).json({
        success: false,
        message: "An offer for this product has already been accepted and is pending campus meetup.",
      });
    }

    // Every purchase request strictly begins as PENDING and requires seller approval
    const transaction = new Transaction({
      buyer: currentUserId,
      seller: product.owner,
      product: product._id,
      amount: transactionAmount,
      status: "PENDING",
      meetupLocation: meetupLocation || product.location || "",
      notes: notes || "",
    });

    await transaction.save();

    await transaction.populate("product", "title images price");
    await transaction.populate("buyer", "name email department isEmailVerified");
    await transaction.populate("seller", "name email department isEmailVerified");

    res.status(201).json({
      success: true,
      message: "Purchase request submitted! Waiting for seller approval.",
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's transaction for a specific product (if any)
// @route   GET /api/transactions/product/:productId
// @access  Private
export const getProductTransaction = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format.",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const isOwner =
      (product.owner?._id || product.owner).toString() === currentUserId.toString();

    // 1. If current user is SELLER / OWNER:
    if (isOwner) {
      // Check if there is a completed deal
      const completedTxn = await Transaction.findOne({
        product: productId,
        status: "COMPLETED",
      })
        .populate("product", "title images price category condition owner status")
        .populate("buyer", "name email department year isEmailVerified profileImage")
        .populate("seller", "name email department year isEmailVerified profileImage");

      if (completedTxn) {
        const existingReview = await Review.findOne({
          transaction: completedTxn._id,
          reviewer: currentUserId,
        });

        return res.status(200).json({
          success: true,
          data: {
            transaction: completedTxn,
            targetUser: completedTxn.buyer,
            targetRole: "buyer",
            isBuyer: false,
            isSeller: true,
            hasReviewed: Boolean(existingReview),
            existingReview,
            pendingRequests: [],
          },
        });
      }

      // Check if there is an active deal accepted in meetup progress
      const acceptedTxn = await Transaction.findOne({
        product: productId,
        status: "ACCEPTED",
      })
        .populate("product", "title images price category condition owner status")
        .populate("buyer", "name email department year isEmailVerified profileImage")
        .populate("seller", "name email department year isEmailVerified profileImage");

      if (acceptedTxn) {
        return res.status(200).json({
          success: true,
          data: {
            transaction: acceptedTxn,
            targetUser: acceptedTxn.buyer,
            targetRole: "buyer",
            isBuyer: false,
            isSeller: true,
            hasReviewed: false,
            existingReview: null,
            pendingRequests: [],
          },
        });
      }

      // If not completed or accepted, check for pending purchase requests / bids from buyers
      const pendingTxns = await Transaction.find({
        product: productId,
        status: "PENDING",
      })
        .sort({ amount: -1, createdAt: -1 })
        .populate("product", "title images price category condition owner status")
        .populate("buyer", "name email department year isEmailVerified profileImage")
        .populate("seller", "name email department year isEmailVerified profileImage");

      if (pendingTxns.length > 0) {
        const primaryTxn = pendingTxns[0];
        return res.status(200).json({
          success: true,
          data: {
            transaction: primaryTxn,
            pendingRequests: pendingTxns,
            targetUser: primaryTxn.buyer,
            targetRole: "buyer",
            isBuyer: false,
            isSeller: true,
            hasReviewed: false,
            existingReview: null,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    // 2. If current user is a BUYER:
    // Check if buyer has a completed transaction first
    const completedTxn = await Transaction.findOne({
      product: productId,
      buyer: currentUserId,
      status: "COMPLETED",
    })
      .populate("product", "title images price category condition owner status")
      .populate("buyer", "name email department year isEmailVerified profileImage")
      .populate("seller", "name email department year isEmailVerified profileImage");

    if (completedTxn) {
      const existingReview = await Review.findOne({
        transaction: completedTxn._id,
        reviewer: currentUserId,
      });

      return res.status(200).json({
        success: true,
        data: {
          transaction: completedTxn,
          targetUser: completedTxn.seller,
          targetRole: "seller",
          isBuyer: true,
          isSeller: false,
          hasReviewed: Boolean(existingReview),
          existingReview,
        },
      });
    }

    // Check if buyer has an active accepted transaction in meetup progress
    const acceptedTxn = await Transaction.findOne({
      product: productId,
      buyer: currentUserId,
      status: "ACCEPTED",
    })
      .populate("product", "title images price category condition owner status")
      .populate("buyer", "name email department year isEmailVerified profileImage")
      .populate("seller", "name email department year isEmailVerified profileImage");

    if (acceptedTxn) {
      return res.status(200).json({
        success: true,
        data: {
          transaction: acceptedTxn,
          targetUser: acceptedTxn.seller,
          targetRole: "seller",
          isBuyer: true,
          isSeller: false,
          hasReviewed: false,
          existingReview: null,
        },
      });
    }

    // Check if buyer has an active pending request
    const pendingTxn = await Transaction.findOne({
      product: productId,
      buyer: currentUserId,
      status: "PENDING",
    })
      .populate("product", "title images price category condition owner status")
      .populate("buyer", "name email department year isEmailVerified profileImage")
      .populate("seller", "name email department year isEmailVerified profileImage");

    if (pendingTxn) {
      return res.status(200).json({
        success: true,
        data: {
          transaction: pendingTxn,
          targetUser: pendingTxn.seller,
          targetRole: "seller",
          isBuyer: true,
          isSeller: false,
          hasReviewed: false,
          existingReview: null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update transaction status (e.g. PENDING -> COMPLETED or CANCELLED)
// @route   PATCH /api/transactions/:id/status
// @access  Private
export const updateTransactionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, meetupLocation, notes, confirmCompletion } = req.body;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction ID format.",
      });
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found.",
      });
    }

    const isBuyer =
      (transaction.buyer._id || transaction.buyer).toString() ===
      currentUserId.toString();
    const isSeller =
      (transaction.seller._id || transaction.seller).toString() ===
      currentUserId.toString();

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this transaction.",
      });
    }

    const validStatuses = [
      "PENDING",
      "ACCEPTED",
      "PAYMENT_PENDING",
      "PAID",
      "MEETUP_SCHEDULED",
      "COMPLETED",
      "CANCELLED",
    ];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Mutual confirmation logic
    if (confirmCompletion) {
      if (isBuyer) transaction.buyerConfirmed = true;
      if (isSeller) transaction.sellerConfirmed = true;

      if (transaction.buyerConfirmed && transaction.sellerConfirmed) {
        transaction.status = "COMPLETED";
      } else {
        transaction.status = "ACCEPTED";
      }
    } else if (status) {
      // Strict Security Rule: Only the SELLER can approve and complete a transaction
      if (["COMPLETED", "ACCEPTED"].includes(status)) {
        if (!isSeller) {
          return res.status(403).json({
            success: false,
            message: "Only the seller can approve and complete this purchase request.",
          });
        }
      }

      transaction.status = status;

      if (status === "ACCEPTED") {
        transaction.buyerConfirmed = false;
        transaction.sellerConfirmed = false;
      }

      if (status === "COMPLETED") {
        transaction.buyerConfirmed = true;
        transaction.sellerConfirmed = true;
      }
    }

    if (meetupLocation) transaction.meetupLocation = meetupLocation;
    if (notes) transaction.notes = notes;

    if (transaction.status === "COMPLETED") {
      transaction.completedAt = new Date();
      // Mark associated product as Sold
      const product = await Product.findById(transaction.product);
      if (product) {
        product.status = "Sold";
        await product.save({ validateBeforeSave: false });
      }

      // Auto-cancel any other pending or accepted requests for the same product
      await Transaction.updateMany(
        {
          product: transaction.product,
          _id: { $ne: transaction._id },
          status: "PENDING",
        },
        {
          status: "CANCELLED",
          notes: "Product sold to another buyer",
        }
      );
      await Transaction.updateMany(
        {
          product: transaction.product,
          _id: { $ne: transaction._id },
          status: "ACCEPTED",
        },
        {
          status: "CANCELLED",
          notes: "Product sold to another buyer",
        }
      );
    }

    if (status === "CANCELLED") {
      // If cancelled, check if there's any other completed transaction; if none, ensure product is Available
      const completedExists = await Transaction.findOne({
        product: transaction.product,
        status: "COMPLETED",
      });
      if (!completedExists) {
        const product = await Product.findById(transaction.product);
        if (product && product.status !== "Available") {
          product.status = "Available";
          await product.save({ validateBeforeSave: false });
        }
      }
    }

    await transaction.save();

    await transaction.populate("product", "title images price");
    await transaction.populate("buyer", "name email department isEmailVerified");
    await transaction.populate("seller", "name email department isEmailVerified");

    res.status(200).json({
      success: true,
      message: `Transaction status updated to ${transaction.status}.`,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

