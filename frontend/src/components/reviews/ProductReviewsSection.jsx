import { useState, useEffect } from "react";
import StarRating from "./StarRating.jsx";
import ReviewCard from "./ReviewCard.jsx";
import Loader from "../Loader.jsx";
import EmptyState from "../EmptyState.jsx";
import { getProductReviews, getUserReviews } from "../../services/reviewService.js";
import { useAuth } from "../../hooks/useAuth.js";

/**
 * ProductReviewsSection renders reviews for the current product, and falls back
 * to the seller's recent reviews if no product-specific reviews exist.
 *
 * @param {Object} props
 * @param {string} props.productId - ID of current product
 * @param {Object} props.seller - Populated owner/seller object
 */
const ProductReviewsSection = ({ productId, seller = {} }) => {
  const { user: currentUser } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  const sellerId = seller?._id || seller?.id;

  useEffect(() => {
    let isMounted = true;
    const loadReviews = async () => {
      setLoading(true);
      try {
        // Try product reviews first
        const res = await getProductReviews(productId, { limit: 5 });
        if (isMounted) {
          if (res.success && res.data?.length > 0) {
            setReviews(res.data);
            setIsFallback(false);
          } else if (sellerId) {
            // Fallback to seller reviews to show trust and reputation
            const sellerRes = await getUserReviews(sellerId, { role: "seller", limit: 4 });
            if (sellerRes.success && sellerRes.data?.length > 0) {
              setReviews(sellerRes.data);
              setIsFallback(true);
            } else {
              setReviews([]);
            }
          }
        }
      } catch {
        if (isMounted) setReviews([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadReviews();
    return () => {
      isMounted = false;
    };
  }, [productId, sellerId]);

  return (
    <section className="section product-reviews-section" style={{ marginTop: "40px" }}>
      <div
        className="section-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          textAlign: "left",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1.4rem" }}>
            {isFallback ? `Seller Reputation & Reviews (${seller.name || "Seller"})` : "Product Reviews"}
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "0.85rem",
              color: "var(--color-text-muted, #5B6478)",
            }}
          >
            {isFallback
              ? "Verified feedback from students who completed transactions with this seller."
              : "Reviews from verified students for this item."}
          </p>
        </div>

        {seller.sellerRating > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <StarRating
              rating={seller.sellerRating}
              size="md"
              showValue
              showCount
              count={seller.sellerReviewCount || 0}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: "30px 0" }}>
          <Loader />
        </div>
      ) : reviews.length === 0 ? (
        <div
          style={{
            background: "var(--color-paper-raised, #FFFFFF)",
            border: "1px dashed var(--color-border, #E4DFD2)",
            borderRadius: "var(--radius-md, 14px)",
            padding: "28px",
            textAlign: "center",
          }}
        >
          <div style={{ color: "var(--color-text-muted, #5B6478)", fontSize: "0.95rem" }}>
            No reviews yet for this seller. Be the first to buy and leave a review once completed!
          </div>
        </div>
      ) : (
        <div className="reviews-grid" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {reviews.map((rev) => (
            <ReviewCard key={rev._id} review={rev} currentUser={currentUser} />
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductReviewsSection;
