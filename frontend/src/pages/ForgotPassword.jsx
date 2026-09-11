import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout.jsx";
import Button from "../components/Button.jsx";
import { forgotPassword } from "../services/authService.js";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [debugToken, setDebugToken] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      setSubmitted(true);
      toast.success("Password reset request submitted");
      if (res.debugToken) {
        setDebugToken(res.debugToken);
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
        <div className="auth-card">
          <h1>Reset your password</h1>
          <p className="auth-sub">
            Enter your college email address and we'll send you instructions to reset your password.
          </p>

          {submitted ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div
                style={{
                  background: "rgba(79, 117, 102, 0.12)",
                  border: "1px solid var(--color-sage)",
                  borderRadius: "var(--radius-sm)",
                  padding: "16px",
                  color: "var(--color-ink)",
                  marginBottom: "20px",
                }}
              >
                <p style={{ margin: 0, fontWeight: 500 }}>
                  If an account exists for <strong>{email}</strong>, instructions to reset your password have been generated.
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                  Reset links expire in 15 minutes for your security.
                </p>
              </div>

              {debugToken && (
                <div style={{ marginBottom: "20px" }}>
                  <Link
                    to={`/reset-password/${debugToken}`}
                    className="btn btn-primary btn-sm"
                    style={{ display: "inline-block" }}
                  >
                    Proceed to Reset Password
                  </Link>
                </div>
              )}

              <Link to="/login" className="btn btn-outline" style={{ display: "inline-block" }}>
                Back to Login
              </Link>
            </div>
          ) : (
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
                  placeholder="you@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" variant="primary" block loading={loading}>
                Send Reset Link
              </Button>

              <div className="auth-switch" style={{ marginTop: "16px" }}>
                Remember your password? <Link to="/login">Back to Login</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ForgotPassword;
