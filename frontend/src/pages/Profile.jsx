import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout.jsx";
import Button from "../components/Button.jsx";
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
  const [stats, setStats] = useState({ postedCount: 0, soldCount: 0 });

  useEffect(() => {
    getMyProducts()
      .then((res) => setStats(res.stats))
      .catch(() => {});
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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

        <div className="profile-layout">
          <div className="profile-card">
            <div className="profile-avatar">{user.name?.charAt(0)?.toUpperCase()}</div>
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
              <div>
                <div className="profile-stat-num">{stats.postedCount}</div>
                <div className="profile-stat-label">Posted</div>
              </div>
              <div>
                <div className="profile-stat-num">{stats.soldCount}</div>
                <div className="profile-stat-label">Sold</div>
              </div>
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{user.email}</div>
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
      </div>
    </MainLayout>
  );
};

export default Profile;
