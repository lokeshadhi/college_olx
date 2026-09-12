import { useState } from "react";
import { FiStar } from "react-icons/fi";
import { FaStar, FaStarHalfAlt } from "react-icons/fa";

/**
 * StarRating component supporting both display and interactive rating modes.
 *
 * @param {Object} props
 * @param {number} props.rating - Numerical rating value (e.g. 4.5, 5, 0)
 * @param {number} [props.maxRating=5] - Maximum stars
 * @param {boolean} [props.interactive=false] - If true, permits user selection
 * @param {Function} [props.onRatingChange] - Callback when star is clicked in interactive mode
 * @param {string} [props.size="md"] - "sm" (14px), "md" (18px), "lg" (24px)
 * @param {boolean} [props.showCount=false] - Whether to render review count
 * @param {number} [props.count=0] - Number of reviews
 * @param {boolean} [props.showValue=false] - Whether to render decimal rating (e.g. "4.8")
 * @param {string} [props.label=""] - Optional label prefix (e.g. "Seller Rating")
 */
const StarRating = ({
  rating = 0,
  maxRating = 5,
  interactive = false,
  onRatingChange,
  size = "md",
  showCount = false,
  count = 0,
  showValue = false,
  label = "",
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  const starSizes = {
    sm: 14,
    md: 18,
    lg: 26,
  };

  const pxSize = starSizes[size] || 18;
  const activeRating = interactive && hoverRating > 0 ? hoverRating : Number(rating) || 0;

  const handleMouseEnter = (starIndex) => {
    if (interactive) {
      setHoverRating(starIndex);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0);
    }
  };

  const handleClick = (starIndex) => {
    if (interactive && onRatingChange) {
      onRatingChange(starIndex);
    }
  };

  return (
    <div
      className={`star-rating-container star-rating-${size}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        userSelect: "none",
      }}
      aria-label={`${rating} out of ${maxRating} stars`}
    >
      {label && (
        <span
          style={{
            fontSize: size === "sm" ? "0.78rem" : "0.85rem",
            fontWeight: 600,
            color: "var(--color-text-muted, #5B6478)",
            marginRight: "2px",
          }}
        >
          {label}:
        </span>
      )}

      <div
        className="stars-wrapper"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: interactive ? "4px" : "2px",
        }}
        onMouseLeave={handleMouseLeave}
      >
        {Array.from({ length: maxRating }, (_, idx) => {
          const starVal = idx + 1;
          const isFilled = activeRating >= starVal;
          const isHalf = !interactive && activeRating >= idx + 0.3 && activeRating < starVal;

          return (
            <span
              key={idx}
              role={interactive ? "button" : "presentation"}
              tabIndex={interactive ? 0 : -1}
              onClick={() => handleClick(starVal)}
              onKeyDown={(e) => {
                if (interactive && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  handleClick(starVal);
                }
              }}
              onMouseEnter={() => handleMouseEnter(starVal)}
              style={{
                cursor: interactive ? "pointer" : "default",
                display: "inline-flex",
                alignItems: "center",
                color: isFilled || isHalf ? "var(--color-gold, #E1A73B)" : "var(--color-border, #E4DFD2)",
                transition: "transform 150ms ease, color 150ms ease",
                transform: interactive && hoverRating === starVal ? "scale(1.2)" : "scale(1)",
              }}
              aria-label={interactive ? `Rate ${starVal} star${starVal > 1 ? "s" : ""}` : undefined}
            >
              {isFilled ? (
                <FaStar size={pxSize} color="#E1A73B" />
              ) : isHalf ? (
                <FaStarHalfAlt size={pxSize} color="#E1A73B" />
              ) : (
                <FiStar size={pxSize} color="#C4C8D4" />
              )}
            </span>
          );
        })}
      </div>

      {showValue && (
        <span
          style={{
            fontWeight: 700,
            fontSize: size === "sm" ? "0.82rem" : size === "lg" ? "1.1rem" : "0.92rem",
            color: "var(--color-ink, #16213E)",
            marginLeft: "2px",
          }}
        >
          {Number(rating) > 0 ? Number(rating).toFixed(1) : "New"}
        </span>
      )}

      {showCount && (
        <span
          style={{
            fontSize: size === "sm" ? "0.78rem" : "0.85rem",
            color: "var(--color-text-muted, #5B6478)",
          }}
        >
          ({count} {count === 1 ? "review" : "reviews"})
        </span>
      )}
    </div>
  );
};

export default StarRating;
