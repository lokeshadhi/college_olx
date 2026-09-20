import { useState, useEffect } from "react";
import { FiAward, FiChevronRight } from "react-icons/fi";
import { getPendingReviews } from "../../services/reviewService.js";
import ReviewModal from "./ReviewModal.jsx";
import Button from "../Button.jsx";
import { useAuth } from "../../hooks/useAuth.js";

/**
 * PendingReviewsBanner prompts users when they have completed transactions
 * that haven't received their review yet.
 *
 * @param {Object} props
 * @param {Function} [props.onReviewSubmitted] - Optional callback after review is saved
 */
const PendingReviewsBanner = ({ onReviewSubmitted }) => {
  const { isAuthenticated } = useAuth();
  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchPending = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await getPendingReviews();
      if (res.success && Array.isArray(res.data)) {
        setPendingList(res.data);
      }
    } catch {
      // Non-critical, ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, [isAuthenticated]);

  if (!isAuthenticated || loading || pendingList.length === 0) {
    return null;
  }

  const currentItem = pendingList[0];

  const handleOpenModal = (txn) => {
    setSelectedTxn(txn);
    setModalOpen(true);
  };

  const handleSuccess = () => {
    fetchPending();
    onReviewSubmitted?.();
  };

  return (
    <>
      <div
        className="pending-reviews-banner"
        style={{
          background: "linear-gradient(135deg, rgba(225, 167, 59, 0.12) 0%, rgba(217, 99, 75, 0.08) 100%)",
          border: "1px solid rgba(225, 167, 59, 0.35)",
          borderRadius: "var(--radius-md, 14px)",
          padding: "16px 20px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "var(--color-gold, #E1A73B)",
              color: "#FFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(225, 167, 59, 0.3)",
            }}
          >
            <FiAward size={22} />
          </div>

          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.98rem",
                color: "var(--color-ink, #16213E)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>
                {pendingList.length === 1
                  ? "You have 1 completed deal waiting for review!"
                  : `You have ${pendingList.length} completed deals waiting for review!`}
              </span>
            </div>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "0.85rem",
                color: "var(--color-text-muted, #5B6478)",
                lineHeight: 1.4,
              }}
            >
              Rate your experience with <strong>{currentItem.targetUser?.name || "the other student"}</strong> for{" "}
              <em>{currentItem.product?.title || "your recent transaction"}</em> to help build trust on CampusX.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() => handleOpenModal(currentItem)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            padding: "8px 16px",
            fontSize: "0.88rem",
          }}
        >
          <span>Leave Review</span>
          <FiChevronRight size={16} />
        </Button>
      </div>

      {modalOpen && (
        <ReviewModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          transaction={selectedTxn}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
};

export default PendingReviewsBanner;
