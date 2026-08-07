import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FiUploadCloud, FiX } from "react-icons/fi";
import MainLayout from "../layouts/MainLayout.jsx";
import Button from "../components/Button.jsx";
import Loader from "../components/Loader.jsx";
import { getProductById, updateProduct } from "../services/productService.js";
import { CATEGORIES, CONDITIONS, resolveImageUrl } from "../utils/constants.js";

const MAX_IMAGES = 6;

const EditProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProductById(id)
      .then((res) => {
        const p = res.data;
        setForm({
          title: p.title,
          description: p.description,
          category: p.category,
          price: p.price,
          condition: p.condition,
          location: p.location || "",
        });
        setExistingImages(p.images || []);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleFiles = (fileList) => {
    const room = MAX_IMAGES - existingImages.length - newImages.length;
    const files = Array.from(fileList).slice(0, Math.max(room, 0));
    if (files.length === 0) return;

    setNewImages((prev) => [...prev, ...files]);
    setNewPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removeNewImage = (index) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
    setNewPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProduct(id, form, newImages);
      toast.success("Product updated successfully");
      navigate(`/products/${updated._id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <MainLayout>
        <div className="container page-shell">
          <Loader />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container page-shell">
        <div className="page-head">
          <h1>Edit Product</h1>
          <p>Update your listing's details, or add more photos.</p>
        </div>

        <form className="sell-form-shell" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              name="title"
              className="form-input"
              value={form.title}
              onChange={handleChange}
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
              value={form.description}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="category">
                Category
              </label>
              <select id="category" name="category" className="form-select" value={form.category} onChange={handleChange} required>
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
              <select id="condition" name="condition" className="form-select" value={form.condition} onChange={handleChange} required>
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
                value={form.price}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="location">
                Location
              </label>
              <input
                id="location"
                name="location"
                className="form-input"
                value={form.location}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Current Images</label>
            <div className="image-preview-row">
              {existingImages.map((img) => (
                <div className="image-preview-thumb" key={img}>
                  <img src={resolveImageUrl(img)} alt="Product" />
                </div>
              ))}
            </div>
            <span className="form-help">To remove an old photo, delete the listing and re-list it.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Add More Images</label>
            <label className="image-drop" htmlFor="images">
              <FiUploadCloud size={26} />
              <p style={{ margin: "8px 0 0" }}>Click to upload additional photos</p>
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
            {newPreviews.length > 0 && (
              <div className="image-preview-row">
                {newPreviews.map((src, i) => (
                  <div className="image-preview-thumb" key={src}>
                    <img src={src} alt={`New ${i + 1}`} />
                    <button type="button" onClick={() => removeNewImage(i)} aria-label="Remove image">
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" variant="primary" block loading={saving}>
            Save Changes
          </Button>
        </form>
      </div>
    </MainLayout>
  );
};

export default EditProduct;
