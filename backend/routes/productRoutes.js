import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  markProductSold,
  getMyProducts,
  getProductOwnerId,
} from "../controllers/productController.js";
import { protect, isOwner } from "../middleware/auth.js";
import { productRules, handleValidation } from "../middleware/validate.js";
import { secureProductUpload } from "../middleware/upload.js";

const router = express.Router();

// NOTE: /user/me must be declared before /:id so Express doesn't treat "user" as an id param.
router.get("/user/me", protect, getMyProducts);

router.get("/", getProducts);
router.get("/:id", getProductById);

router.post("/", protect, secureProductUpload, productRules, handleValidation, createProduct);

router.put(
  "/:id",
  protect,
  isOwner(getProductOwnerId),
  secureProductUpload,
  updateProduct
);

router.delete("/:id", protect, isOwner(getProductOwnerId), deleteProduct);

router.patch("/:id/sold", protect, isOwner(getProductOwnerId), markProductSold);

export default router;
