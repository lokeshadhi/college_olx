import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiMail, FiShield, FiClock, FiRefreshCw, FiArrowLeft } from "react-icons/fi";
import MainLayout from "../layouts/MainLayout.jsx";
import Button from "../components/Button.jsx";
import {
  forgotPassword,
  verifyPasswordResetOTP,
  resendPasswordResetOTP,
} from "../services/authService.js";
import {
  normalizeEmail,
  isValidCollegeEmail,
  getCollegeEmailValidationError,
} from "../utils/emailValidator.js";

const COOLDOWN_SECONDS = 30;

const ForgotPassword = () => {
  const navigate = useNavigate();

  // Step 1 = Enter Email, Step 2 = Enter 6-digit OTP
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 6 individual OTP digits
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);

  // Resend cooldown timer
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus first OTP input when transitioning to Step 2
  useEffect(() => {
    if (step === 2 && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  // STEP 1: Handle Email Submission
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const cleanEmail = normalizeEmail(email);
    const validationError = getCollegeEmailValidationError(cleanEmail);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(cleanEmail);
      toast.success("Password reset code sent to your email");
      setStep(2);
      setCooldown(COOLDOWN_SECONDS);
      setDigits(["", "", "", "", "", ""]);
    } catch (error) {
      setErrorMessage(error.message || "Failed to send reset code. Please try again.");
      toast.error(error.message || "Failed to send reset code");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Handle OTP Digit Changes
  const handleDigitChange = (index, value) => {
    setErrorMessage("");
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

  // STEP 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    const cleanEmail = normalizeEmail(email);
    if (!isValidCollegeEmail(cleanEmail)) {
      setErrorMessage("Please enter a valid NIT Kurukshetra student email.");
      return;
    }

    if (fullOtp.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyPasswordResetOTP({
        email: cleanEmail,
        otp: fullOtp,
      });

      toast.success("Code verified! Set your new password.");
      navigate("/reset-password", {
        state: {
          resetToken: res.resetToken,
          email: cleanEmail,
        },
      });
    } catch (error) {
      const msg = error.message || "Invalid or expired code. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Resend OTP
  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setErrorMessage("");

    const cleanEmail = normalizeEmail(email);
    if (!isValidCollegeEmail(cleanEmail)) {
      setErrorMessage("Please provide a valid NIT Kurukshetra student email.");
      return;
    }

    setResending(true);
    try {
      await resendPasswordResetOTP(cleanEmail);
      toast.success("A fresh 6-digit code has been sent to your email");
      setCooldown(COOLDOWN_SECONDS);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (error) {
      const msg = error.message || "Failed to resend code. Please wait and try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <MainLayout>
      <div className="auth-shell">
        <div className="auth-card" style={{ maxWidth: "480px" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(27, 77, 62, 0.08)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-forest)",
                fontSize: "26px",
                marginBottom: "12px",
              }}
            >
              <FiShield />
            </div>

            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, color: "var(--color-ink)" }}>
              {step === 1 ? "Reset your password" : "Enter Verification Code"}
            </h1>

            <p className="auth-sub" style={{ marginTop: "8px", fontSize: "0.92rem" }}>
              {step === 1
                ? "Enter your NIT Kurukshetra student email and we'll send you a 6-digit code to reset your password."
                : `We sent a 6-digit reset code to ${email}`}
            </p>
          </div>

          {errorMessage && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "var(--radius-sm)",
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                color: "#991B1B",
                fontSize: "0.86rem",
                lineHeight: 1.5,
                marginBottom: "20px",
              }}
            >
              {errorMessage}
            </div>
          )}

          {step === 1 ? (
            /* STEP 1: EMAIL INPUT FORM */
            <form onSubmit={handleEmailSubmit}>
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label className="form-label" htmlFor="email" style={{ fontWeight: 600 }}>
                  NIT Kurukshetra Student Email
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-input"
                    placeholder="123456@nitkkr.ac.in"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage("");
                    }}
                    required
                    style={{ paddingLeft: "40px" }}
                  />
                  <FiMail
                    style={{
                      position: "absolute",
                      left: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--color-text-muted)",
                      fontSize: "18px",
                    }}
                  />
                </div>
                <small style={{ display: "block", marginTop: "6px", color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
                  Example: <code>123456@nitkkr.ac.in</code> (numbers only before @nitkkr.ac.in)
                </small>
              </div>

              <Button type="submit" variant="primary" block loading={loading}>
                Send Verification Code
              </Button>

              <div className="auth-switch" style={{ marginTop: "20px", textAlign: "center" }}>
                Remember your password? <Link to="/login" style={{ fontWeight: 600 }}>Back to Login</Link>
              </div>
            </form>
          ) : (
            /* STEP 2: 6-DIGIT OTP VERIFICATION */
            <form onSubmit={handleVerifyOTP}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "var(--color-paper)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: "24px",
                  fontSize: "0.88rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                  <FiMail style={{ color: "var(--color-forest)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: "var(--color-ink)", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setErrorMessage("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-forest)",
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  Change
                </button>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    marginBottom: "12px",
                    textAlign: "center",
                    color: "var(--color-ink)",
                    fontSize: "0.92rem",
                  }}
                >
                  Enter 6-Digit Code
                </label>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      style={{
                        width: "48px",
                        height: "56px",
                        textAlign: "center",
                        fontSize: "24px",
                        fontWeight: 700,
                        fontFamily: "var(--font-mono, monospace)",
                        border: digit ? "2px solid var(--color-brand-accent)" : "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm, 8px)",
                        background: "var(--color-paper-subtle)",
                        color: "var(--color-ink)",
                        outline: "none",
                        boxShadow: digit ? "0 0 0 3px var(--color-brand-accent-subtle)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  fontSize: "0.84rem",
                  color: "var(--color-text-muted)",
                  marginBottom: "20px",
                }}
              >
                <FiClock />
                <span>Code expires in <strong>10 minutes</strong></span>
              </div>

              <Button
                type="submit"
                variant="primary"
                block
                loading={loading}
                disabled={fullOtp.length !== 6}
              >
                Verify & Proceed
              </Button>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "20px",
                  fontSize: "0.88rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setErrorMessage("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-text-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "0.85rem",
                  }}
                >
                  <FiArrowLeft /> Back
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending}
                  style={{
                    background: "none",
                    border: "none",
                    color: cooldown > 0 ? "var(--color-text-muted)" : "var(--color-forest)",
                    fontWeight: cooldown > 0 ? 400 : 600,
                    cursor: cooldown > 0 ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: 0,
                    fontSize: "0.85rem",
                  }}
                >
                  <FiRefreshCw className={resending ? "spin" : ""} />
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ForgotPassword;
