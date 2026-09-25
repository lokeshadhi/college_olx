import Product from "../models/Product.js";
import Transaction from "../models/Transaction.js";
import { escapeRegex } from "../middleware/securitySanitizer.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs/promises";


// @desc    Get all products with search, filters, sorting and pagination
// @route   GET /api/products
// @access  Public
const uploadToCloudinary = async (file, folder = "campusx/products") => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: "image",
    });

    // Delete temporary file from Render/local disk
    await fs.unlink(file.path).catch(() => {});

    return result.secure_url;
  } catch (error) {
  console.error("CLOUDINARY UPLOAD ERROR:", error);
  console.error("CLOUDINARY HTTP CODE:", error?.http_code);
  console.error("CLOUDINARY ERROR MESSAGE:", error?.error?.message);
  console.error("CLOUDINARY ERROR DETAILS:", JSON.stringify(error?.error));

  await fs.unlink(file.path).catch(() => {});
  throw error;
}
};
export const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      condition,
      status,
      sort,
      page = 1,
      limit = 12,
    } = req.query;

    const query = {};

    if (search && typeof search === "string" && search.trim()) {
      const safeSearch = escapeRegex(search.trim());
      query.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { category: { $regex: safeSearch, $options: "i" } },
        { "seller.name": { $regex: safeSearch, $options: "i" } },
        { "seller.department": { $regex: safeSearch, $options: "i" } },
      ];
    }

    if (category) query.category = category;
    if (condition) query.condition = condition;

    // Default to only showing Available items unless the caller explicitly asks otherwise.
    query.status = status || "Available";

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let sortOption = { createdAt: -1 }; // Newest first by default
    if (sort === "oldest") sortOption = { createdAt: 1 };
    if (sort === "price_low") sortOption = { price: 1 };
    if (sort === "price_high") sortOption = { price: -1 };

    const pageNum = Math.max(Number(page), 1);
    const limitNum = Math.max(Number(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(query).sort(sortOption).skip(skip).limit(limitNum),
      Product.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single product by id, with related products from the same category
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "owner",
      "name email phone department degree year isEmailVerified profileImage sellerRating sellerReviewCount rating reviewCount createdAt"
    );
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      status: "Available",
    })
      .limit(4)
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: product, related: relatedProducts });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new product listing
// @route   POST /api/products
// @access  Private
export const createProduct = async (req, res, next) => {
  try {
    const { title, description, category, price, condition, location } = req.body;

    const images = await Promise.all(
  (req.files || []).map((file) =>
    uploadToCloudinary(file, "campusx/products")
  )
);

    const product = await Product.create({
      title,
      description,
      category,
      price,
      condition,
      location,
      images,
      owner: req.user._id,
      seller: {
        name: req.user.name,
        phone: req.user.phone,
        department: req.user.department,
        isEmailVerified: Boolean(req.user.isEmailVerified),
      },
    });

    res.status(201).json({ success: true, message: "Product listed successfully", data: product });
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);
    console.error("CREATE PRODUCT ERROR MESSAGE:", error?.message);
    console.error("CREATE PRODUCT ERROR STACK:", error?.stack);
    next(error);
  }
};

// @desc    Update a product owned by the logged-in student
// @route   PUT /api/products/:id
// @access  Private (owner only)
export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const editableFields = ["title", "description", "category", "price", "condition", "location", "status"];
    editableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

  if (req.files && req.files.length > 0) {
  const newImages = await Promise.all(
    req.files.map((file) =>
      uploadToCloudinary(file, "campusx/products")
    )
  );

  product.images = [...product.images, ...newImages];
}

    const updatedProduct = await product.save();

    res.status(200).json({ success: true, message: "Product updated successfully", data: updatedProduct });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a product owned by the logged-in student
// @route   DELETE /api/products/:id
// @access  Private (owner only)
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    await product.deleteOne();

    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle / set a product's sold status
// @route   PATCH /api/products/:id/sold
// @access  Private (owner only)
export const markProductSold = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    product.status = product.status === "Available" ? "Sold" : "Available";
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product marked as ${product.status}`,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all products belonging to the logged-in student, plus stats for their profile
// @route   GET /api/products/user/me
// @access  Private
export const getMyProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ owner: req.user._id }).sort({ createdAt: -1 });
    const postedCount = products.length;
    const soldCount = products.filter((p) => p.status === "Sold").length;
    const boughtCount = await Transaction.countDocuments({
      buyer: req.user._id,
      status: "COMPLETED",
    });

    res.status(200).json({
      success: true,
      data: products,
      stats: { postedCount, soldCount, boughtCount },
    });
  } catch (error) {
    next(error);
  }
};

// Helper used by the isOwner authorization middleware to resolve a product's owner id.
export const getProductOwnerId = async (req) => {
  const product = await Product.findById(req.params.id);
  return product?.owner;
};
