import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiAlertCircle, FiStar } from "react-icons/fi";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout.jsx";
import Button from "../components/Button.jsx";
import StarRating from "../components/reviews/StarRating.jsx";
import PendingReviewsBanner from "../components/reviews/PendingReviewsBanner.jsx";
import UserReviewsList from "../components/reviews/UserReviewsList.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { getMyProducts } from "../services/productService.js";
import { YEARS } from "../utils/constants.js";

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    department: user?.department || "",
    year: user?.year || "",
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [stats, setStats] = useState({ postedCount: 0, soldCount: 0, boughtCount: 0 });

  useEffect(() => {
    getMyProducts()
      .then((res) => setStats(res.stats || { postedCount: 0, soldCount: 0, boughtCount: 0 }))
      .catch(() => {});
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleProfileImageChange = async (e) => {
  const file = e.target.files?.[0];

  if (!file) return;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    toast.error("Only JPG, PNG, and WebP images are allowed");
    e.target.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    toast.error("Image must be smaller than 5 MB");
    e.target.value = "";
    return;
  }

  const formData = new FormData();
  formData.append("profileImage", file);

  setUploadingImage(true);

  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    const response = await fetch(
      `${API_BASE_URL}/auth/profile-image`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to upload profile image");
    }

    toast.success("Profile picture updated successfully");

    // Refresh the page so the updated user profile is loaded
    window.location.reload();
  } catch (error) {
    toast.error(error.message || "Failed to upload profile image");
  } finally {
    setUploadingImage(false);
    e.target.value = "";
  }
};
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(form);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <MainLayout>
      <div className="container page-shell">
        <div className="page-head">
          <h1>My Profile</h1>
          <p>Manage your account details and see your CampusX activity.</p>
        </div>

        {/* Pending Reviews notification if any deals await user feedback */}
        <PendingReviewsBanner />

        <div className="profile-layout">
          <div className="profile-card">
            <div
  className="profile-avatar"
  onClick={() => fileInputRef.current?.click()}
  style={{ cursor: "pointer", position: "relative", overflow: "hidden" }}
>
  {user.profileImage ? (
    <img
      src={user.profileImage}
      alt="Profile"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  ) : (
    user.name?.charAt(0)?.toUpperCase()
  )}
</div>
<input
  ref={fileInputRef}
  type="file"
  accept="image/jpeg,image/png,image/webp"
  onChange={handleProfileImageChange}
  style={{ display: "none" }}
/>
            <div className="profile-name">{user.name}</div>
            <div className="profile-dept">
              {user.department} · {user.year}
            </div>
            {user.isEmailVerified ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  marginTop: "8px",
                  padding: "4px 12px",
                  borderRadius: "999px",
                  background: "rgba(27, 77, 62, 0.1)",
                  color: "var(--color-primary, #1B4D3E)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                }}
              >
                <FiCheckCircle />
                <span>Verified Student</span>
              </div>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                  marginTop: "8px",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: "rgba(217, 99, 75, 0.1)",
                    color: "var(--color-coral, #D9634B)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  <FiAlertCircle /> Unverified Student
                </span>
                <Link
                  to={`/verify-email?email=${encodeURIComponent(user.email || "")}`}
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--color-primary, #1B4D3E)",
                    fontWeight: 600,
                    textDecoration: "underline",
                  }}
                >
                  Verify Student Email
                </Link>
              </div>
            )}
            <div className="profile-stats">
              <Link
                to="/my-products"
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
                title="View your posted listings"
              >
                <div className="profile-stat-num">{stats.postedCount || 0}</div>
                <div className="profile-stat-label">Listings</div>
              </Link>
              <Link
                to="/my-transactions?tab=sales"
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
                title="View your completed sales"
              >
                <div className="profile-stat-num">{stats.soldCount || 0}</div>
                <div className="profile-stat-label">Sold</div>
              </Link>
              <Link
                to="/my-transactions?tab=purchases"
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
                title="View your approved buys"
              >
                <div className="profile-stat-num">{stats.boughtCount || 0}</div>
                <div className="profile-stat-label">Buys</div>
              </Link>
            </div>

            {/* Campus Reputation Breakdown */}
            <div
              style={{
                width: "100%",
                marginTop: "16px",
                paddingTop: "16px",
                borderTop: "1px solid var(--color-border, #E4DFD2)",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--color-text-muted, #5B6478)",
                  marginBottom: "8px",
                }}
              >
                Campus Reputation
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.85rem",
                  marginBottom: "6px",
                }}
              >
                <span style={{ color: "var(--color-text, #1D2333)", fontWeight: 500 }}>Seller Rating</span>
                <span>
                  {user.sellerRating > 0 ? (
                    <StarRating
                      rating={user.sellerRating}
                      size="sm"
                      showValue
                      showCount
                      count={user.sellerReviewCount || 0}
                    />
                  ) : (
                    <span style={{ color: "var(--color-text-muted, #5B6478)", fontSize: "0.8rem" }}>
                      No reviews
                    </span>
                  )}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.85rem",
                }}
              >
                <span style={{ color: "var(--color-text, #1D2333)", fontWeight: 500 }}>Buyer Rating</span>
                <span>
                  {user.buyerRating > 0 ? (
                    <StarRating
                      rating={user.buyerRating}
                      size="sm"
                      showValue
                      showCount
                      count={user.buyerReviewCount || 0}
                    />
                  ) : (
                    <span style={{ color: "var(--color-text-muted, #5B6478)", fontSize: "0.8rem" }}>
                      No reviews
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div style={{ width: "100%", marginTop: "16px" }}>
              <Link to="/my-transactions" style={{ textDecoration: "none", display: "block" }}>
                <Button
                  variant="outline"
                  style={{
                    width: "100%",
                    padding: "7px 12px",
                    fontSize: "0.82rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  View All Transactions
                </Button>
              </Link>
            </div>

            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "14px" }}>
              {user.email}
            </div>
          </div>

          <div className="profile-details-card">
            <h3 style={{ marginBottom: 20 }}>Edit Profile</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="name">
                    Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    className="form-input"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="phone">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    className="form-input"
                    value={form.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="department">
                    Department
                  </label>
                  <input
                    id="department"
                    name="department"
                    className="form-input"
                    value={form.department}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="year">
                    Year
                  </label>
                  <select id="year" name="year" className="form-select" value={form.year} onChange={handleChange} required>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">College Email</label>
                <input className="form-input" value={user.email} disabled />
                <span className="form-help">Your college email cannot be changed.</span>
              </div>

              <Button type="submit" variant="primary" loading={saving}>
                Save Changes
              </Button>
            </form>
          </div>
        </div>

        {/* Reviews Received by User */}
        <div style={{ marginTop: "48px" }}>
          <div className="section-head" style={{ textAlign: "left", marginBottom: "20px" }}>
            <h2 style={{ margin: 0, fontSize: "1.45rem" }}>Reviews & Campus Reputation</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.88rem", color: "var(--color-text-muted, #5B6478)" }}>
              Feedback left by other NIT Kurukshetra students from your completed transactions.
            </p>
          </div>
          <UserReviewsList userId={user._id || user.id} userStats={user} />
        </div>
      </div>
    </MainLayout>
  );
};

export default Profile;
