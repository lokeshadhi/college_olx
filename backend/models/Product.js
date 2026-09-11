import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "Books",
        "Electronics",
        "Cycles",
        "Furniture",
        "Hostel Essentials",
        "Lab Equipment",
        "Calculators",
        "Sports",
        "Stationery",
        "Others",
      ],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    condition: {
      type: String,
      required: [true, "Condition is required"],
      enum: ["New", "Like New", "Good", "Fair", "Old"],
    },
    images: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    // Denormalized seller info so listings render without an extra populate,
    // kept in sync with the owning user at creation time.
    seller: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      department: { type: String, required: true },
      isEmailVerified: { type: Boolean, default: false },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["Available", "Sold"],
      default: "Available",
    },
    // AI-powered secondary security analysis results
    securityAssessment: {
      riskScore: {
        type: Number,
        default: 0,
      },
      riskLevel: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNAVAILABLE"],
        default: "LOW",
      },
      flags: {
        type: [String],
        default: [],
      },
      reason: {
        type: String,
        default: "No significant suspicious patterns detected.",
      },
      analyzedAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  { timestamps: true }
);

// Support text search across the fields students are most likely to search by.
productSchema.index({
  title: "text",
  description: "text",
  "seller.name": "text",
  "seller.department": "text",
});

const Product = mongoose.model("Product", productSchema);

export default Product;
