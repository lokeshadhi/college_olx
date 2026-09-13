import { useState } from "react";
import { FiAlertTriangle, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import Button from "../Button.jsx";
import { chatService } from "../../services/chatService.js";

const REPORT_CATEGORIES = [
  { value: "scam", label: "Suspected Scam or Payment Fraud" },
  { value: "harassment", label: "Harassment, Abuse, or Intimidation" },
  { value: "spam", label: "Spam or Unsolicited Commercial Messages" },
  { value: "inappropriate_content", label: "Inappropriate or Offensive Content" },
  { value: "other", label: "Other Campus Safety Policy Violation" },
];

const ReportModal = ({
  isOpen,
  onClose,
  reportedUser,
  conversationId,
  messageId,
}) => {
  const [reason, setReason] = useState("scam");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const targetUserId = (
    reportedUser?._id ||
    reportedUser?.id ||
    (typeof reportedUser === "string" ? reportedUser : "")
  ).toString();

  const targetUserName = reportedUser?.name || "Student";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetUserId) {
      toast.error("Cannot identify student to report. Please select a conversation first.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await chatService.reportTarget({
        reportedUserId: targetUserId,
        conversationId: conversationId || undefined,
        messageId: messageId || undefined,
        reason,
        description: description.trim(),
      });

      if (res?.success) {
        toast.success(res.message || "Report submitted successfully. Our team will review it.");
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(18, 23, 42, 0.75)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-paper-raised, #1B2138)",
          border: "1px solid var(--color-border, #2B3253)",
          borderRadius: "var(--radius-lg, 16px)",
          maxWidth: "480px",
          width: "100%",
          padding: "24px",
          boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
          position: "relative",
          color: "var(--color-text, #EDEAE0)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            color: "var(--color-text-muted, #9CA3B8)",
            cursor: "pointer",
            fontSize: "1.2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px",
          }}
          title="Close"
        >
          <FiX />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "rgba(217, 99, 75, 0.16)",
              color: "var(--color-coral, #D9634B)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.3rem",
              flexShrink: 0,
            }}
          >
            <FiAlertTriangle />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.2rem", color: "var(--color-text, #EDEAE0)", fontWeight: 700 }}>
              Report Student
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--color-text-muted, #9CA3B8)" }}>
              Reporting {targetUserName}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="report-reason"
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-text, #EDEAE0)",
                marginBottom: "8px",
              }}
            >
              Reason for report <span style={{ color: "var(--color-coral, #D9634B)" }}>*</span>
            </label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1.5px solid var(--color-border, #2B3253)",
                background: "var(--color-paper, #12172A)",
                color: "var(--color-text, #EDEAE0)",
                fontSize: "0.92rem",
                fontWeight: 500,
                cursor: "pointer",
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              {REPORT_CATEGORIES.map((cat) => (
                <option
                  key={cat.value}
                  value={cat.value}
                  style={{
                    backgroundColor: "var(--color-paper-raised, #1B2138)",
                    color: "var(--color-text, #EDEAE0)",
                    padding: "8px",
                  }}
                >
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              htmlFor="report-description"
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-text, #EDEAE0)",
                marginBottom: "8px",
              }}
            >
              Additional Details (Optional)
            </label>
            <textarea
              id="report-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context or specifics that will help our moderators evaluate this report..."
              maxLength={1000}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1.5px solid var(--color-border, #2B3253)",
                background: "var(--color-paper, #12172A)",
                color: "var(--color-text, #EDEAE0)",
                fontSize: "0.9rem",
                resize: "vertical",
                boxSizing: "border-box",
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--color-text-muted, #9CA3B8)", marginTop: "4px" }}>
              {description.length} / 1000
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: "8px 18px", fontSize: "0.88rem" }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              style={{
                padding: "8px 18px",
                fontSize: "0.88rem",
                backgroundColor: "var(--color-coral, #D9634B)",
                borderColor: "var(--color-coral, #D9634B)",
                color: "#FFFFFF",
                fontWeight: 600,
              }}
            >
              Submit Report
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportModal;
