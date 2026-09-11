import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout.jsx";
import Button from "../components/Button.jsx";
import { resetPassword } from "../services/authService.js";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Real-time strength checks
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_~`+\-=/\\\[\]]/.test(password);
  const isStrong = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecial;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!isStrong) {
      toast.error("Please ensure your password satisfies all security requirements");
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(token, password, confirmPassword);
      toast.success(res.message || "Password reset successfully!");
      navigate("/login");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="auth-shell">
        <div className="auth-card">
          <h1>Set a new password</h1>
          <p className="auth-sub">
            Choose a strong password with at least 8 characters including mixed case, numbers, and symbols.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="password">
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Password security criteria checklist */}
            <div
              style={{
                fontSize: "0.8rem",
                background: "var(--color-paper)",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                marginBottom: "16px",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "4px", color: "var(--color-ink)" }}>
                Password Security Checklist:
              </div>
              <div style={{ color: hasMinLength ? "var(--color-sage)" : "var(--color-text-muted)" }}>
                {hasMinLength ? "✓" : "○"} At least 8 characters
              </div>
              <div style={{ color: hasUpperCase && hasLowerCase ? "var(--color-sage)" : "var(--color-text-muted)" }}>
                {hasUpperCase && hasLowerCase ? "✓" : "○"} Upper and lowercase letters
              </div>
              <div style={{ color: hasNumber ? "var(--color-sage)" : "var(--color-text-muted)" }}>
                {hasNumber ? "✓" : "○"} At least one number (0-9)
              </div>
              <div style={{ color: hasSpecial ? "var(--color-sage)" : "var(--color-text-muted)" }}>
                {hasSpecial ? "✓" : "○"} At least one special symbol (!@#$%...)
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" variant="primary" block loading={loading} disabled={!isStrong}>
              Reset Password
            </Button>

            <div className="auth-switch" style={{ marginTop: "16px" }}>
              Remember your password? <Link to="/login">Back to Login</Link>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
};

export default ResetPassword;
