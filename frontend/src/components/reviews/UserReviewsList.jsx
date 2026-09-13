import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import StarRating from "./StarRating.jsx";
import ReviewCard from "./ReviewCard.jsx";
import ReviewModal from "./ReviewModal.jsx";
import Loader from "../Loader.jsx";
import EmptyState from "../EmptyState.jsx";
import Pagination from "../Pagination.jsx";
import { getUserReviews, deleteReview } from "../../services/reviewService.js";
import { useAuth } from "../../hooks/useAuth.js";

/**
 * UserReviewsList renders the reviews received by a user with role filters,
 * rating breakdown, and pagination.
 *
 * @param {Object} props
 * @param {string} props.userId - ID of the user whose reviews to fetch
 * @param {Object} [props.userStats] - { sellerRating, sellerReviewCount, buyerRating, buyerReviewCount, rating, reviewCount }
 * @param {boolean} [props.showBreakdown=true] - Whether to show the top rating breakdown card
 */
const UserReviewsList = ({ userId, userStats = {}, showBreakdown = true }) => {
  const { user: currentUser } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState(""); // "" = all, "seller", "buyer"
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [stats, setStats] = useState({
    rating: userStats.rating || 0,
    reviewCount: userStats.reviewCount || 0,
    sellerRating: userStats.sellerRating || 0,
    sellerReviewCount: userStats.sellerReviewCount || 0,
    buyerRating: userStats.buyerRating || 0,
    buyerReviewCount: userStats.buyerReviewCount || 0,
  });

  const [editingReview, setEditingReview] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchReviews = useCallback(
    async (page = 1) => {
      if (!userId) return;
      setLoading(true);
      try {
        const params = { page, limit: 6 };
        if (roleFilter) params.role = roleFilter;

        const res = await getUserReviews(userId, params);
        if (res.success) {
          setReviews(res.data || []);
          if (res.pagination) {
            setPagination(res.pagination);
          }
          if (res.stats) {
            setStats(res.stats);
          }
        }
      } catch (err) {
        toast.error(err.message || "Failed to load reviews");
      } finally {
        setLoading(false);
      }
    },
    [userId, roleFilter]
  );

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews]);

  const handleEdit = (rev) => {
    setEditingReview(rev);
    setModalOpen(true);
  };

  const handleDelete = async (reviewId) => {
    try {
      await deleteReview(reviewId);
      toast.success("Review deleted successfully");
      fetchReviews(pagination.page);
    } catch (err) {
      toast.error(err.message || "Failed to delete review");
    }
  };

  const handleModalSuccess = () => {
    setEditingReview(null);
    fetchReviews(pagination.page);
  };

  return (
    <div className="user-reviews-list-container">
      {/* Reputation Summary Card */}
      {showBreakdown && (
        <div
          style={{
            background: "var(--color-paper-raised, #FFFFFF)",
            border: "1px solid var(--color-border, #E4DFD2)",
            borderRadius: "var(--radius-md, 14px)",
            padding: "20px 24px",
            marginBottom: "20px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "20px",
            alignItems: "center",
          }}
        >
          {/* Overall Rating */}
          <div style={{ textAlign: "center", borderRight: "1px solid var(--color-border, #E4DFD2)" }}>
            <div
              style={{
                fontFamily: "var(--font-display, Georgia, serif)",
                fontSize: "2.4rem",
                fontWeight: 700,
                color: "var(--color-ink, #16213E)",
                lineHeight: 1,
                marginBottom: "6px",
              }}
            >
              {stats.rating > 0 ? stats.rating.toFixed(1) : "—"}
            </div>
            <StarRating rating={stats.rating} size="sm" />
            <div
              style={{
                fontSize: "0.82rem",
                color: "var(--color-text-muted, #5B6478)",
                marginTop: "4px",
              }}
            >
              Overall Rating ({stats.reviewCount} {stats.reviewCount === 1 ? "review" : "reviews"})
            </div>
          </div>

          {/* Seller Rating */}
          <div style={{ textAlign: "center", borderRight: "1px solid var(--color-border, #E4DFD2)" }}>
            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                color: "var(--color-gold-dark, #B8842A)",
                marginBottom: "4px",
              }}
            >
              {stats.sellerRating > 0 ? `★ ${stats.sellerRating.toFixed(1)}` : "—"}
            </div>
            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--color-ink, #16213E)" }}>
              Seller Reputation
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted, #5B6478)" }}>
              {stats.sellerReviewCount} {stats.sellerReviewCount === 1 ? "review" : "reviews"}
            </div>
          </div>

          {/* Buyer Rating */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                color: "var(--color-sage, #4F7566)",
                marginBottom: "4px",
              }}
            >
              {stats.buyerRating > 0 ? `★ ${stats.buyerRating.toFixed(1)}` : "—"}
            </div>
            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--color-ink, #16213E)" }}>
              Buyer Reputation
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted, #5B6478)" }}>
              {stats.buyerReviewCount} {stats.buyerReviewCount === 1 ? "review" : "reviews"}
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "18px",
          borderBottom: "1px solid var(--color-border, #E4DFD2)",
          paddingBottom: "8px",
        }}
      >
        <button
          type="button"
          onClick={() => setRoleFilter("")}
          style={{
            background: roleFilter === "" ? "var(--color-ink, #16213E)" : "transparent",
            color: roleFilter === "" ? "var(--color-paper, #F8F6F0)" : "var(--color-text-muted, #5B6478)",
            border: "none",
            borderRadius: "999px",
            padding: "6px 14px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 150ms ease",
          }}
        >
          All Reviews ({stats.reviewCount})
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter("seller")}
          style={{
            background: roleFilter === "seller" ? "var(--color-ink, #16213E)" : "transparent",
            color: roleFilter === "seller" ? "var(--color-paper, #F8F6F0)" : "var(--color-text-muted, #5B6478)",
            border: "none",
            borderRadius: "999px",
            padding: "6px 14px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 150ms ease",
          }}
        >
          As Seller ({stats.sellerReviewCount})
        </button>

        <button
          type="button"
          onClick={() => setRoleFilter("buyer")}
          style={{
            background: roleFilter === "buyer" ? "var(--color-ink, #16213E)" : "transparent",
            color: roleFilter === "buyer" ? "var(--color-paper, #F8F6F0)" : "var(--color-text-muted, #5B6478)",
            border: "none",
            borderRadius: "999px",
            padding: "6px 14px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 150ms ease",
          }}
        >
          As Buyer ({stats.buyerReviewCount})
        </button>
      </div>

      {/* Reviews Content */}
      {loading ? (
        <div style={{ padding: "40px 0" }}>
          <Loader />
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          message={
            roleFilter
              ? `This user has not received any ${roleFilter} reviews yet.`
              : "No reviews have been written for this user yet. Reviews appear once transactions are completed."
          }
        />
      ) : (
        <div>
          {reviews.map((rev) => (
            <ReviewCard
              key={rev._id}
              review={rev}
              currentUser={currentUser}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}

          {pagination.pages > 1 && (
            <div style={{ marginTop: "24px" }}>
              <Pagination
                page={pagination.page}
                pages={pagination.pages}
                onPageChange={(p) => fetchReviews(p)}
              />
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <ReviewModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingReview(null);
          }}
          existingReview={editingReview}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};

export default UserReviewsList;
