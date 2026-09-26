import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout.jsx";
import Button from "../components/Button.jsx";
import { useAuth } from "../hooks/useAuth.js";
import e2eeService from "../crypto/e2eeService.js";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoadingText("Signing in...");

    // Capture password in ephemeral closure variable solely for WebCrypto key recovery
    const rawPassword = form.password;

    try {
      const userData = await login(form);

      // Immediately clear the password from react state
      setForm((prev) => ({ ...prev, password: "" }));

      // Automatically restore or initialize cryptographic keys with the login password
      if (userData && rawPassword) {
        setLoadingText("Setting up secure messaging...");
        try {
          await e2eeService.ensureUserKeysWithPassword(userData, rawPassword);
        } catch (keyErr) {
          console.warn("E2EE key recovery warning:", keyErr?.message || keyErr);
        }
      }

      navigate(location.state?.from || "/browse");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setLoadingText("");
    }
  };

  return (
    <MainLayout>
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Welcome back</h1>
          <p className="auth-sub">Log in with your college email to continue.</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                College Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                placeholder="123456@nitkkr.ac.in"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className="form-label" htmlFor="password" style={{ marginBottom: 0 }}>
                  Password
                </label>
                <Link to="/forgot-password" style={{ fontSize: "0.82rem", color: "var(--color-primary, #3b5a45)", textDecoration: "none" }}>
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                  style={{ paddingRight: "42px", width: "100%" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    background: "none",
                    border: "none",
                    color: "var(--color-text-muted)",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.15rem",
                    zIndex: 2,
                  }}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <Button type="submit" variant="primary" block loading={loading} loadingText={loadingText}>
              Log In
            </Button>
          </form>

          <div className="auth-switch">
            Don't have an account? <Link to="/register">Register here</Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Login;
