import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout.jsx";
import Button from "../components/Button.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { DEGREES, YEARS } from "../utils/constants.js";

import { getCollegeEmailValidationError } from "../utils/emailValidator.js";

const INITIAL_FORM = {
  name: "",
  email: "",
  phone: "",
  department: "",
  degree: "",
  year: "",
  password: "",
  confirmPassword: "",
};

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });

    if (name === "email") {
      if (!value.trim()) {
        setEmailError("");
      } else {
        const err = getCollegeEmailValidationError(value);
        setEmailError(err || "");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErr = getCollegeEmailValidationError(form.email);
    if (validationErr) {
      setEmailError(validationErr);
      toast.error(validationErr);
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await register(form);
      const cleanEmail = form.email.trim().toLowerCase();

      if (res?.requiresVerification) {
        toast.success("Verification code sent! Please check your student email.");
        navigate(`/verify-email?email=${encodeURIComponent(cleanEmail)}`);
      } else {
        navigate("/browse");
      }
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
                className={`form-input ${emailError ? "input-error" : ""}`}
                placeholder="123456@nitkkr.ac.in"
                value={form.email}
                onChange={handleChange}
                required
              />
              <span className="form-help" style={{ display: "block", marginTop: "4px", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                Use your NIT Kurukshetra student email.
              </span>
              {emailError && (
                <span
                  style={{
                    display: "block",
                    marginTop: "4px",
                    fontSize: "0.82rem",
                    color: "var(--color-coral, #D9634B)",
                    fontWeight: 500,
                  }}
                >
                  {emailError}
                </span>
              )}
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

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="degree">
                  Degree
                </label>
                <select
                  id="degree"
                  name="degree"
                  className="form-select"
                  value={form.degree}
                  onChange={handleChange}
                  required
                >
                  <option value="" disabled>
                    Select your degree
                  </option>
                  {DEGREES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
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
