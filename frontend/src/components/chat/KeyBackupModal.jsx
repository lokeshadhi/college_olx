import { useState } from "react";
import { FiShield, FiX, FiCheckCircle, FiCopy, FiCheck, FiLock, FiDatabase } from "react-icons/fi";
import toast from "react-hot-toast";
import e2eeService from "../../crypto/e2eeService.js";

/**
 * KeyStatusModal (formerly KeyBackupModal)
 * 
 * Displays the user's active End-to-End Encryption (E2EE) security status,
 * cryptographic fingerprint, and automatic login-password-derived backup info.
 * This is an informational view that never requests a separate backup passphrase.
 */
const KeyBackupModal = ({ isOpen, onClose, user }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const fingerprint = e2eeService.localCryptoKey?.fingerprint || "Active (Identity initialized)";

  const handleCopyFingerprint = () => {
    if (fingerprint && fingerprint !== "Active (Identity initialized)") {
      navigator.clipboard.writeText(fingerprint);
      setCopied(true);
      toast.success("Fingerprint copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(10, 14, 26, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-paper, #141829)",
          border: "1px solid var(--color-border, #2A324E)",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "480px",
          padding: "24px",
          color: "var(--color-text, #E8EBF5)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "rgba(59, 130, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#3B82F6",
              }}
            >
              <FiShield size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, letterSpacing: "-0.01em" }}>
                Security & Encryption Status
              </h3>
              <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted, #8D99AE)" }}>
                End-to-End Encryption (RSA-OAEP 2048 + AES-256)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-muted, #8D99AE)",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Security Badge */}
        <div
          style={{
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "10px",
            padding: "12px 14px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <FiCheckCircle size={20} color="#10B981" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#10B981" }}>
              Messages are End-to-End Encrypted
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted, #8D99AE)", marginTop: "2px" }}>
              Only you and the person you are communicating with can read your messages.
            </div>
          </div>
        </div>

        {/* Fingerprint Card */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--color-border, #2A324E)",
            borderRadius: "10px",
            padding: "14px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted, #8D99AE)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Your Key Fingerprint
            </span>
            <button
              onClick={handleCopyFingerprint}
              style={{
                background: "transparent",
                border: "none",
                color: copied ? "#10B981" : "#3B82F6",
                cursor: "pointer",
                fontSize: "0.78rem",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 500,
                padding: 0,
              }}
              title="Copy cryptographic fingerprint"
            >
              {copied ? <FiCheck size={13} /> : <FiCopy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "0.8rem",
              background: "rgba(0, 0, 0, 0.25)",
              padding: "10px 12px",
              borderRadius: "6px",
              color: "#60A5FA",
              wordBreak: "break-all",
              lineHeight: 1.4,
              letterSpacing: "0.04em",
            }}
          >
            {fingerprint}
          </div>
        </div>

        {/* Features / Architecture Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "0.82rem", color: "var(--color-text-muted, #8D99AE)" }}>
            <FiLock size={16} color="#3B82F6" style={{ marginTop: "2px", flexShrink: 0 }} />
            <div>
              <strong style={{ color: "var(--color-text, #E8EBF5)" }}>Automatic Key Recovery: </strong>
              Your private key backup is protected using your college account login password (PBKDF2 with 150,000 iterations + AES-256-GCM). When logging in on a new device, your keys are restored automatically.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "0.82rem", color: "var(--color-text-muted, #8D99AE)" }}>
            <FiDatabase size={16} color="#10B981" style={{ marginTop: "2px", flexShrink: 0 }} />
            <div>
              <strong style={{ color: "var(--color-text, #E8EBF5)" }}>Local Key Storage: </strong>
              Keys are securely stored in your browser's private database (IndexedDB). Plaintext passwords and private keys are never transmitted to or readable by the server.
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            padding: "10px 16px",
            background: "#3B82F6",
            border: "none",
            borderRadius: "8px",
            color: "#FFF",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: "pointer",
            transition: "background 0.15s ease",
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
};

export default KeyBackupModal;
