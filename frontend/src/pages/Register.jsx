import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout.jsx";
import Button from "../components/Button.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { YEARS } from "../utils/constants.js";

const INITIAL_FORM = {
  name: "",
  email: "",
  phone: "",
  department: "",
  year: "",
  password: "",
  confirmPassword: "",
};

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await register(form);
      navigate("/browse");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="auth-shell">
        <div className="auth-card" style={{ maxWidth: 520 }}>
          <h1>Create your account</h1>
          <p className="auth-sub">Join CampusX with your college email — it only takes a minute.</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                className="form-input"
                placeholder="Aditi Sharma"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                College Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                placeholder="you@college.edu"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="phone">
                  Phone Number
                </label>
                <input
                  id="phone"
                  name="phone"
                  className="form-input"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="department">
                  Department
                </label>
                <input
                  id="department"
                  name="department"
                  className="form-input"
                  placeholder="Computer Science"
                  value={form.department}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="year">
                Year
              </label>
              <select
                id="year"
                name="year"
                className="form-select"
                value={form.year}
                onChange={handleChange}
                required
              >
                <option value="" disabled>
                  Select your year
                </option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="form-input"
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  minLength={6}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  className="form-input"
                  placeholder="Re-enter password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  minLength={6}
                  required
                />
              </div>
            </div>

            <Button type="submit" variant="primary" block loading={loading}>
              Create Account
            </Button>
          </form>

          <div className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Register;
