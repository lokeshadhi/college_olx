import { useState } from "react";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiEdit2, FiTrash2, FiShoppingBag } from "react-icons/fi";
import StarRating from "./StarRating.jsx";
import { resolveImageUrl } from "../../utils/constants.js";

/**
 * ReviewCard displays an individual rating and review.
 *
 * @param {Object} props
 * @param {Object} props.review - The review document
 * @param {Object} [props.currentUser] - The currently logged-in user (to enable edit/delete)
 * @param {Function} [props.onEdit] - Callback to edit review
 * @param {Function} [props.onDelete] - Callback to delete review
 */
const ReviewCard = ({ review, currentUser, onEdit, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!review) return null;

  const reviewer = review.reviewer || {};
  const isAuthor =
    currentUser &&
    reviewer._id &&
    (currentUser._id?.toString() === reviewer._id.toString() ||
      currentUser.id?.toString() === reviewer._id.toString());

  const formattedDate = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this review?")) {
      setIsDeleting(true);
      try {
        await onDelete?.(review._id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div
      className="review-card"
      style={{
        background: "var(--color-paper-raised, #FFFFFF)",
        border: "1px solid var(--color-border, #E4DFD2)",
        borderRadius: "var(--radius-md, 14px)",
        padding: "16px 20px",
        marginBottom: "14px",
        boxShadow: "var(--shadow-sm, 0 2px 8px rgba(22, 33, 62, 0.04))",
        transition: "box-shadow var(--transition, 180ms ease)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "10px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Avatar */}
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              overflow: "hidden",
              background: "var(--color-ink-soft, #2C3A5E)",
              color: "#FFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "1rem",
              flexShrink: 0,
            }}
          >
            {reviewer.profileImage ? (
              <img
                src={resolveImageUrl(reviewer.profileImage)}
                alt={reviewer.name || "Student"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              (reviewer.name || "S").charAt(0).toUpperCase()
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "var(--color-ink, #16213E)",
                }}
              >
                {reviewer.name || "Campus Student"}
              </span>

              {reviewer.isEmailVerified && (
                <span
                  title="Verified Student"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    color: "var(--color-primary, #1B4D3E)",
                    fontSize: "0.9rem",
                  }}
                >
                  <FiCheckCircle />
                </span>
              )}
            </div>

            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--color-text-muted, #5B6478)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "2px",
              }}
            >
              <span>{reviewer.department || "NIT Kurukshetra"}</span>
              <span>•</span>
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Role badge & Edit/Delete Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "0.74rem",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: "6px",
              letterSpacing: "0.04em",
              background:
                review.role === "seller"
                  ? "rgba(225, 167, 59, 0.15)"
                  : "rgba(79, 117, 102, 0.15)",
              color:
                review.role === "seller"
                  ? "var(--color-gold-dark, #B8842A)"
                  : "var(--color-sage, #4F7566)",
              border: `1px solid ${
                review.role === "seller" ? "#E1A73B40" : "#4F756640"
              }`,
            }}
          >
            {review.role === "seller" ? "Seller Review" : "Buyer Review"}
          </span>

          {isAuthor && (
            <div style={{ display: "flex", gap: "4px", marginLeft: "4px" }}>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(review)}
                  title="Edit Review"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-text-muted, #5B6478)",
                    cursor: "pointer",
                    padding: "4px 6px",
                    borderRadius: "4px",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <FiEdit2 size={14} />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  title="Delete Review"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-coral, #D9634B)",
                    cursor: isDeleting ? "not-allowed" : "pointer",
                    padding: "4px 6px",
                    borderRadius: "4px",
                    display: "inline-flex",
                    alignItems: "center",
                    opacity: isDeleting ? 0.5 : 1,
                  }}
                >
                  <FiTrash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Star Rating display */}
      <div style={{ margin: "6px 0 10px" }}>
        <StarRating rating={review.rating} size="sm" showValue />
      </div>

      {/* Review Text */}
      {review.review && (
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "0.92rem",
            lineHeight: 1.5,
            color: "var(--color-text, #1D2333)",
            whiteSpace: "pre-line",
          }}
        >
          {review.review}
        </p>
      )}

      {/* Associated Product if populated */}
      {review.product && typeof review.product === "object" && review.product.title && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.8rem",
            color: "var(--color-text-muted, #5B6478)",
            padding: "4px 8px",
            background: "var(--color-paper, #F8F6F0)",
            borderRadius: "6px",
            marginTop: "4px",
          }}
        >
          <FiShoppingBag size={13} />
          <span>Product:</span>
          {review.product._id ? (
            <Link
              to={`/products/${review.product._id}`}
              style={{
                fontWeight: 600,
                color: "var(--color-ink, #16213E)",
                textDecoration: "underline",
              }}
            >
              {review.product.title}
            </Link>
          ) : (
            <span style={{ fontWeight: 600 }}>{review.product.title}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewCard;
