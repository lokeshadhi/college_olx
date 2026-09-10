import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiUploadCloud, FiX } from "react-icons/fi";
import MainLayout from "../layouts/MainLayout.jsx";
import Button from "../components/Button.jsx";
import AiAssistantCard from "../components/AiAssistantCard.jsx";
import { createProduct } from "../services/productService.js";
import { CATEGORIES, CONDITIONS } from "../utils/constants.js";

const INITIAL_FORM = {
  title: "",
  description: "",
  category: "",
  price: "",
  condition: "",
  location: "",
};

const MAX_IMAGES = 6;

const SellProduct = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]); // File objects
  const [previews, setPreviews] = useState([]); // object URLs
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFiles = (fileList) => {
    const files = Array.from(fileList).slice(0, MAX_IMAGES - images.length);
    if (files.length === 0) return;

    setImages((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Callback when user clicks "Use Suggestions in Form" from AI card
  const handleApplyAiSuggestions = ({ title, description, category, condition, price, tags }) => {
    let finalDescription = description;
    if (tags && tags.length > 0) {
      const tagFooter = `\n\nTags: ${tags.map((t) => `#${t}`).join(" ")}`;
      if (!finalDescription.includes("Tags:")) {
        finalDescription += tagFooter;
      }
    }

    setForm((prev) => ({
      ...prev,
      title: title || prev.title,
      description: finalDescription || prev.description,
      category: category || prev.category,
      condition: condition || prev.condition,
      price: price || prev.price,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (images.length === 0) {
      toast.error("Please add at least one product image");
      return;
    }

    setLoading(true);
    try {
      const product = await createProduct(form, images);
      toast.success("Product listed successfully!");
      navigate(`/products/${product._id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="container page-shell">
        <div className="page-head">
          <h1>Sell a Product</h1>
          <p>List an item for other students on your campus to find.</p>
        </div>

        <form className="sell-form-shell" onSubmit={handleSubmit}>
          {/* Step 1: Upload Product Images */}
          <div className="form-group" style={{ marginBottom: "24px" }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              1. Product Photos (up to {MAX_IMAGES})
            </label>
            <label className="image-drop" htmlFor="images">
              <FiUploadCloud size={28} />
              <p style={{ margin: "8px 0 0", fontWeight: 500 }}>
                Click or drop photos of your item
              </p>
              <span className="form-help">JPG, PNG or WEBP — up to 5MB each</span>
            </label>
            <input
              id="images"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />

            {previews.length > 0 && (
              <div className="image-preview-row">
                {previews.map((src, i) => (
                  <div className="image-preview-thumb" key={src}>
                    <img src={src} alt={`Preview ${i + 1}`} />
                    <button type="button" onClick={() => removeImage(i)} aria-label="Remove image">
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: AI Listing Assistant */}
          <AiAssistantCard
            images={images}
            onApplySuggestions={handleApplyAiSuggestions}
            disabled={loading}
          />

          {/* Step 3: Review & Edit Listing Details */}
          <div style={{ marginTop: "12px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "1.05rem", color: "var(--color-ink)", margin: "0 0 6px" }}>
              2. Listing Details (Review & Edit)
            </h3>
            <p style={{ fontSize: "0.84rem", color: "var(--color-text-muted)", margin: 0 }}>
              All fields are fully editable. The listing will only be published when you click Submit Listing below.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              name="title"
              className="form-input"
              placeholder="e.g. Casio FX-991ES Calculator"
              value={form.title}
              onChange={handleChange}
              maxLength={120}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              className="form-textarea"
              placeholder="Describe the item's condition, usage, and any accessories included"
              value={form.description}
              onChange={handleChange}
              rows={4}
              maxLength={2000}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="category">
                Category
              </label>
              <select
                id="category"
                name="category"
                className="form-select"
                value={form.category}
                onChange={handleChange}
                required
              >
                <option value="" disabled>
                  Select category
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="condition">
                Condition
              </label>
              <select
                id="condition"
                name="condition"
                className="form-select"
                value={form.condition}
                onChange={handleChange}
                required
              >
                <option value="" disabled>
                  Select condition
                </option>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="price">
                Price (₹)
              </label>
              <input
                id="price"
                name="price"
                type="number"
                min="0"
                className="form-input"
                placeholder="500"
                value={form.price}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="location">
                Campus Location (Optional)
              </label>
              <input
                id="location"
                name="location"
                className="form-input"
                placeholder="e.g. Boys Hostel Block C, Library"
                value={form.location}
                onChange={handleChange}
              />
            </div>
          </div>

          <Button type="submit" variant="primary" block loading={loading}>
            Submit Listing
          </Button>
        </form>
      </div>
    </MainLayout>
  );
};

export default SellProduct;
