import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { FiX, FiCheckCircle } from "react-icons/fi";
import StarRating from "./StarRating.jsx";
import Button from "../Button.jsx";
import { createReview, updateReview } from "../../services/reviewService.js";
import { resolveImageUrl } from "../../utils/constants.js";

const RATING_LABELS = {
  1: "1 - Poor",
  2: "2 - Fair",
  3: "3 - Good",
  4: "4 - Very Good",
  5: "5 - Excellent",
};

/**
 * ReviewModal allows buyers and sellers to leave or update ratings and reviews.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is visible
 * @param {Function} props.onClose - Modal close handler
 * @param {Object} props.transaction - Transaction data (with product, targetUser, targetRole)
 * @param {Object} [props.existingReview] - If updating an existing review
 * @param {Function} [props.onSuccess] - Callback after successful submission
 */
const ReviewModal = ({
  open,
  onClose,
  transaction,
  existingReview = null,
  onSuccess,
}) => {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [reviewText, setReviewText] = useState(existingReview?.review || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setRating(existingReview?.rating || 0);
      setReviewText(existingReview?.review || "");
      setError("");
    }
  }, [open, existingReview]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const targetUser =
    transaction?.targetUser ||
    (existingReview?.reviewedUser ? existingReview.reviewedUser : {});
  const targetRole =
    transaction?.targetRole ||
    (existingReview?.role ? existingReview.role : "seller");
  const product = transaction?.product || existingReview?.product || {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating || rating < 1 || rating > 5) {
      setError("Please select a star rating between 1 and 5.");
      return;
    }
    if (reviewText.length > 500) {
      setError("Review cannot exceed 500 characters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      let result;
      if (existingReview?._id) {
        result = await updateReview(existingReview._id, {
          rating,
          review: reviewText.trim(),
        });
        toast.success("Review updated successfully!");
      } else {
        const txnId = transaction?._id || transaction?.transactionId;
        result = await createReview({
          transactionId: txnId,
          rating,
          review: reviewText.trim(),
        });
        toast.success("Thank you! Review submitted successfully.");
      }

      onSuccess?.(result.data);
      onClose();
    } catch (err) {
      const errMsg = err.message || "Failed to submit review. Please try again.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(22, 33, 62, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "16px",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-paper-raised, #FFFFFF)",
          borderRadius: "var(--radius-lg, 22px)",
          border: "1px solid var(--color-border, #E4DFD2)",
          boxShadow: "var(--shadow-lg, 0 20px 48px rgba(22, 33, 62, 0.2))",
          maxWidth: "500px",
          width: "100%",
          padding: "28px",
          position: "relative",
          animation: "fadeInUp 0.2s ease-out",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Close modal"
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "transparent",
            border: "none",
            color: "var(--color-text-muted, #5B6478)",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "6px",
          }}
        >
          <FiX size={20} />
        </button>

        <div style={{ marginBottom: "20px" }}>
          <span
            style={{
              fontSize: "0.76rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--color-gold-dark, #B8842A)",
              background: "rgba(225, 167, 59, 0.12)",
              padding: "3px 8px",
              borderRadius: "4px",
              display: "inline-block",
              marginBottom: "8px",
            }}
          >
            {existingReview ? "Edit Review" : "Rate & Review"}
          </span>
          <h2
            style={{
              fontFamily: "var(--font-display, Georgia, serif)",
              fontSize: "1.45rem",
              margin: 0,
              color: "var(--color-ink, #16213E)",
            }}
          >
            {existingReview
              ? "Update your review"
              : `How was your experience with ${targetUser.name || "this student"}?`}
          </h2>
        </div>

        {/* Transaction / Product Summary snippet */}
        {(product.title || targetUser.name) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              background: "var(--color-paper, #F8F6F0)",
              borderRadius: "var(--radius-sm, 8px)",
              marginBottom: "20px",
            }}
          >
            {product.images?.[0] && (
              <img
                src={resolveImageUrl(product.images[0])}
                alt={product.title || "Product"}
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "6px",
                  objectFit: "cover",
                  border: "1px solid var(--color-border, #E4DFD2)",
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.92rem",
                  color: "var(--color-ink, #16213E)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {product.title || "Transaction"}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--color-text-muted, #5B6478)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>Rating {targetRole === "seller" ? "Seller" : "Buyer"}:</span>
                <span style={{ fontWeight: 600, color: "var(--color-ink, #16213E)" }}>
                  {targetUser.name || "Student"}
                </span>
                {targetUser.isEmailVerified && (
                  <FiCheckCircle
                    size={13}
                    style={{ color: "var(--color-primary, #1B4D3E)" }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Star selector */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              margin: "16px 0 20px",
              gap: "8px",
            }}
          >
            <StarRating
              rating={rating}
              size="lg"
              interactive
              onRatingChange={(newVal) => {
                setRating(newVal);
                setError("");
              }}
            />
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                height: "22px",
                color:
                  rating > 0
                    ? "var(--color-ink, #16213E)"
                    : "var(--color-text-muted, #5B6478)",
              }}
            >
              {rating > 0 ? RATING_LABELS[rating] : "Click a star to rate"}
            </div>
          </div>

          {/* Optional review text */}
          <div className="form-group" style={{ marginBottom: "16px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
              }}
            >
              <label
                htmlFor="review-text"
                className="form-label"
                style={{ marginBottom: 0 }}
              >
                Review comments (optional)
              </label>
              <span
                style={{
                  fontSize: "0.78rem",
                  color:
                    reviewText.length > 480
                      ? "var(--color-coral, #D9634B)"
                      : "var(--color-text-muted, #5B6478)",
                }}
              >
                {reviewText.length} / 500
              </span>
            </div>
            <textarea
              id="review-text"
              rows={4}
              maxLength={500}
              className="form-input"
              value={reviewText}
              onChange={(e) => {
                setReviewText(e.target.value);
                if (error) setError("");
              }}
              placeholder={`Share your experience with ${targetUser.name || "the other student"}. Was the item as described? Was the meetup on time?`}
              style={{
                resize: "vertical",
                minHeight: "90px",
                fontFamily: "var(--font-body, sans-serif)",
                fontSize: "0.9rem",
                lineHeight: 1.4,
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "#fef2f2",
                border: "1px solid #f87171",
                color: "#991b1b",
                fontSize: "0.85rem",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={rating < 1 || submitting}
            >
              {existingReview ? "Update Review" : "Submit Review"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;
