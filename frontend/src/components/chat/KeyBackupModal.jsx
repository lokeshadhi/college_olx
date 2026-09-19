import { useState } from "react";
import { FiLock, FiKey, FiShield, FiX, FiCheckCircle, FiAlertTriangle } from "react-icons/fi";
import toast from "react-hot-toast";
import e2eeService from "../../crypto/e2eeService.js";

const KeyBackupModal = ({
  isOpen,
  onClose,
  mode = "backup",
  user,
  hasBackup = true,
  serverFingerprint,
  onRestoreSuccess,
}) => {
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const fingerprint = serverFingerprint || e2eeService.localCryptoKey?.fingerprint || "Not yet loaded";

  const handleBackup = async (e) => {
    e.preventDefault();
    setError("");

    if (!passphrase || passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters long");
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setError("Passphrases do not match");
      return;
    }

    setLoading(true);
    try {
      await e2eeService.backupPrivateKeyWithPassphrase(passphrase);
      toast.success("Cryptographic key backup saved to server successfully!");
      setPassphrase("");
      setConfirmPassphrase("");
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create key backup");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (e) => {
    e.preventDefault();
    setError("");

    if (!passphrase) {
      setError("Please enter your passphrase");
      return;
    }

    setLoading(true);
    try {
      await e2eeService.restorePrivateKeyWithPassphrase(user._id, passphrase);
      toast.success("Encryption key restored successfully!");
      setPassphrase("");
      if (onRestoreSuccess) onRestoreSuccess();
      onClose();
    } catch (err) {
      setError("Incorrect passphrase or corrupt backup data");
    } finally {
      setLoading(false);
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
          borderRadius: "12px",
          width: "100%",
          maxWidth: "480px",
          padding: "24px",
          color: "var(--color-text, #E8EBF5)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "rgba(79, 110, 247, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6B8AFF",
              }}
            >
              {mode === "restore" ? <FiKey size={20} /> : <FiShield size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
                {mode === "restore" ? "Restore Encryption Key" : "E2EE Key Backup & Security"}
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
            }}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Key Fingerprint Display */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--color-border, #2A324E)",
            borderRadius: "8px",
            padding: "10px 12px",
            marginBottom: "18px",
            fontSize: "0.78rem",
          }}
        >
          <div style={{ color: "var(--color-text-muted, #8D99AE)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
            <FiLock size={12} /> Your Cryptographic Fingerprint:
          </div>
          <code
            style={{
              fontFamily: "monospace",
              color: "#8AE68A",
              wordBreak: "break-all",
              display: "block",
              lineHeight: 1.4,
            }}
          >
            {fingerprint}
          </code>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#FCA5A5",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "0.82rem",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FiAlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        {mode === "restore" ? (
          !hasBackup ? (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <p style={{ fontSize: "0.88rem", color: "var(--color-text-muted, #8D99AE)", lineHeight: 1.5, marginBottom: "14px" }}>
                Your cryptographic identity is already registered on another device, but an encrypted backup has not been created on the server yet.
              </p>
              <div
                style={{
                  background: "rgba(225, 167, 59, 0.1)",
                  border: "1px solid rgba(225, 167, 59, 0.3)",
                  borderRadius: "8px",
                  padding: "12px",
                  fontSize: "0.82rem",
                  color: "#E1A73B",
                  marginBottom: "20px",
                  textAlign: "left",
                  lineHeight: 1.4,
                }}
              >
                <strong>Action Required:</strong> Log in to your original device, click the <strong>"Keys"</strong> button in chat, and set a backup passphrase. Once backed up, you will be able to restore your key here.
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#4F6EF7",
                  border: "none",
                  borderRadius: "6px",
                  color: "#FFF",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                }}
              >
                Understood
              </button>
            </div>
          ) : (
            <form onSubmit={handleRestore}>
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted, #8D99AE)", margin: "0 0 14px 0" }}>
                An encrypted key backup was found on the server. Enter your backup passphrase to restore your private key on this device.
              </p>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "6px", fontWeight: 500 }}>
                  Backup Passphrase
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter passphrase"
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border, #2A324E)",
                    background: "var(--color-bg, #0E1222)",
                    color: "#FFF",
                    fontSize: "0.88rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#4F6EF7",
                    border: "none",
                    borderRadius: "6px",
                    color: "#FFF",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Restoring..." : "Restore Key"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    padding: "10px 18px",
                    background: "transparent",
                    border: "1px solid var(--color-border, #2A324E)",
                    borderRadius: "6px",
                    color: "var(--color-text-muted, #8D99AE)",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={handleBackup}>
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted, #8D99AE)", margin: "0 0 14px 0" }}>
              Encrypt and backup your private key to the server using PBKDF2 (150,000 rounds). You can use this passphrase to recover your chats on a new device.
            </p>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "6px", fontWeight: 500 }}>
                Set Backup Passphrase (min. 8 characters)
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter strong passphrase"
                required
                minLength={8}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border, #2A324E)",
                  background: "var(--color-bg, #0E1222)",
                  color: "#FFF",
                  fontSize: "0.88rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "6px", fontWeight: 500 }}>
                Confirm Backup Passphrase
              </label>
              <input
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Confirm passphrase"
                required
                minLength={8}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border, #2A324E)",
                  background: "var(--color-bg, #0E1222)",
                  color: "#FFF",
                  fontSize: "0.88rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "9px 16px",
                  background: "transparent",
                  border: "1px solid var(--color-border, #2A324E)",
                  borderRadius: "6px",
                  color: "var(--color-text-muted, #8D99AE)",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "9px 18px",
                  background: "#4F6EF7",
                  border: "none",
                  borderRadius: "6px",
                  color: "#FFF",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {loading ? "Encrypting & Uploading..." : "Save Backup"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default KeyBackupModal;
