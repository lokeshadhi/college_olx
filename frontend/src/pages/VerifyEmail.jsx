import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FiMail, FiShield, FiClock, FiRefreshCw, FiCheckCircle } from "react-icons/fi";
import MainLayout from "../layouts/MainLayout.jsx";
import Button from "../components/Button.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { isValidCollegeEmail, normalizeEmail } from "../utils/emailValidator.js";

const COOLDOWN_SECONDS = 30;

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification, user } = useAuth();

  const initialEmail = searchParams.get("email") || user?.email || "";
  const [email, setEmail] = useState(initialEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(!initialEmail);

  // 6 individual OTP digits
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [errorMessage, setErrorMessage] = useState("");

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus first input on load
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleDigitChange = (index, value) => {
    setErrorMessage("");

    // Filter to numbers only
    const cleanValue = value.replace(/\D/g, "");

    // Handling paste of multi-digit string (e.g. 6 digits)
    if (cleanValue.length > 1) {
      const pasted = cleanValue.slice(0, 6).split("");
      const newDigits = [...digits];
      pasted.forEach((ch, idx) => {
        if (index + idx < 6) {
          newDigits[index + idx] = ch;
        }
      });
      setDigits(newDigits);

      const nextFocus = Math.min(index + pasted.length, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleanValue;
    setDigits(newDigits);

    // Auto-advance to next input
    if (cleanValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const fullOtp = digits.join("");

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !isValidCollegeEmail(cleanEmail)) {
      setErrorMessage("Please enter a valid NIT Kurukshetra email address (example: 123456@nitkkr.ac.in).");
      return;
    }

    if (fullOtp.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      await verifyEmail({ email: cleanEmail, otp: fullOtp });
      navigate("/browse");
    } catch (err) {
      setErrorMessage(err.message || "Verification failed. Please check the code and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setErrorMessage("");

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !isValidCollegeEmail(cleanEmail)) {
      setErrorMessage("Please provide a valid NIT Kurukshetra student email to resend.");
      return;
    }

    setResending(true);
    try {
      await resendVerification(cleanEmail);
      setCooldown(COOLDOWN_SECONDS);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setErrorMessage(err.message || "Failed to resend code. Please wait a moment.");
    } finally {
      setResending(false);
    }
  };

  return (
    <MainLayout>
      <div className="auth-shell">
        <div className="auth-card" style={{ maxWidth: 500, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(27, 77, 62, 0.1)",
              color: "var(--color-primary, #1B4D3E)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              margin: "0 auto 16px",
            }}
          >
            <FiShield />
          </div>

          <h1 style={{ fontSize: "1.65rem", marginBottom: "8px" }}>Verify Your Student Email</h1>
          <p className="auth-sub" style={{ marginBottom: "20px" }}>
            We sent a 6-digit verification code to:
          </p>

          <div
            style={{
              background: "var(--color-surface, #FAF7F2)",
              border: "1px solid var(--color-border, #E5E7EB)",
              borderRadius: "8px",
              padding: "10px 16px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "var(--color-ink, #1F2937)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden", textOverflow: "ellipsis" }}>
              <FiMail style={{ color: "var(--color-primary, #1B4D3E)", flexShrink: 0 }} />
              {isEditingEmail ? (
                <input
                  type="email"
                  className="form-input"
                  style={{ padding: "4px 8px", fontSize: "0.9rem" }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="123456@nitkkr.ac.in"
                />
              ) : (
                <span style={{ fontFamily: "monospace" }}>{email || "your email"}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsEditingEmail(!isEditingEmail)}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-primary, #1B4D3E)",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              {isEditingEmail ? "Done" : "Change"}
            </button>
          </div>

          {errorMessage && (
            <div
              style={{
                background: "rgba(217, 99, 75, 0.1)",
                color: "var(--color-coral, #D9634B)",
                border: "1px solid rgba(217, 99, 75, 0.25)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "0.88rem",
                marginBottom: "20px",
                textAlign: "left",
              }}
            >
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleVerify}>
            {/* 6-digit OTP code inputs */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "10px",
                margin: "24px 0 20px",
              }}
            >
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  style={{
                    width: "48px",
                    height: "56px",
                    textAlign: "center",
                    fontSize: "1.6rem",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    borderRadius: "8px",
                    border: digit
                      ? "2px solid var(--color-primary, #1B4D3E)"
                      : "1px solid var(--color-border, #E5E7EB)",
                    background: "var(--color-card, #ffffff)",
                    color: "var(--color-ink, #1F2937)",
                    outline: "none",
                    boxShadow: digit ? "0 0 0 3px rgba(27, 77, 62, 0.12)" : "none",
                    transition: "all 0.15s ease",
                  }}
                />
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "0.82rem",
                color: "var(--color-text-muted, #6B7280)",
                marginBottom: "24px",
              }}
            >
              <FiClock />
              <span>This verification code expires in 10 minutes.</span>
            </div>

            <Button
              type="submit"
              variant="primary"
              block
              loading={loading}
              disabled={fullOtp.length !== 6}
              style={{ padding: "12px", fontSize: "1rem" }}
            >
              Verify Email
            </Button>
          </form>

          <div
            style={{
              marginTop: "24px",
              paddingTop: "20px",
              borderTop: "1px solid var(--color-border, #E5E7EB)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              style={{
                background: "none",
                border: "none",
                color:
                  cooldown > 0
                    ? "var(--color-text-muted, #9CA3AF)"
                    : "var(--color-primary, #1B4D3E)",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: cooldown > 0 ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <FiRefreshCw className={resending ? "spin-icon" : ""} />
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
            </button>

            <div style={{ marginTop: "8px", fontSize: "0.85rem" }}>
              Already verified? <Link to="/login">Log in here</Link>
            </div>

            <div
              style={{
                marginTop: "12px",
                padding: "10px 14px",
                borderRadius: "6px",
                background: "rgba(217, 119, 6, 0.08)",
                border: "1px dashed rgba(217, 119, 6, 0.35)",
                fontSize: "0.78rem",
                color: "var(--color-ink, #4B5563)",
                lineHeight: 1.5,
              }}
            >
              💡 <strong>Haven't received an email?</strong> If SMTP is not yet set up in your <code>backend/.env</code>, check the <strong>terminal where your backend is running</strong> to see your 6-digit OTP code!
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default VerifyEmail;
