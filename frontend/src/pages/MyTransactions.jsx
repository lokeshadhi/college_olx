import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiPackage,
  FiShoppingBag,
  FiStar,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";
import MainLayout from "../layouts/MainLayout.jsx";
import Loader from "../components/Loader.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Button from "../components/Button.jsx";
import ReviewModal from "../components/reviews/ReviewModal.jsx";
import PendingReviewsBanner from "../components/reviews/PendingReviewsBanner.jsx";
import {
  getMyTransactions,
  updateTransactionStatus,
} from "../services/transactionService.js";
import { getPendingReviews } from "../services/reviewService.js";
import { useAuth } from "../hooks/useAuth.js";
import { resolveImageUrl } from "../utils/constants.js";

const MyTransactions = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(
    ["all", "purchases", "sales"].includes(tabParam) ? tabParam : "all"
  );
  const [pendingTxnIds, setPendingTxnIds] = useState(new Set());
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (tabParam && ["all", "purchases", "sales"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === "all" ? {} : { tab });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, pendingRes] = await Promise.all([
        getMyTransactions(),
        getPendingReviews().catch(() => ({ data: [] })),
      ]);

      if (txRes?.success) {
        setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
      }

      if (pendingRes?.success && Array.isArray(pendingRes.data)) {
        const ids = new Set(
          pendingRes.data
            .map((p) => p.transactionId?.toString())
            .filter(Boolean)
        );
        setPendingTxnIds(ids);
      }
    } catch (err) {
      toast.error(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Robust, null-safe ID extraction preventing undefined/null .toString() runtime crashes
  const getUserId = (u) => {
    if (!u) return "";
    if (typeof u === "string") return u;
    return (u._id || u.id || "").toString();
  };

  const currentUserIdStr = (user?._id || user?.id || "").toString();

  const purchases = transactions.filter(
    (t) => getUserId(t.buyer) === currentUserIdStr
  );

  const sales = transactions.filter(
    (t) => getUserId(t.seller) === currentUserIdStr
  );

  const displayedList =
    activeTab === "purchases"
      ? purchases
      : activeTab === "sales"
      ? sales
      : transactions;

  const handleOpenReview = (t, isBuyer) => {
    const targetUser = isBuyer ? t.seller : t.buyer;
    const targetRole = isBuyer ? "seller" : "buyer";

    setSelectedTxn({
      _id: t._id,
      transactionId: t._id,
      product: t.product || {},
      targetUser: targetUser || {},
      targetRole,
    });
    setReviewModalOpen(true);
  };

  const handleReviewSuccess = () => {
    loadData();
  };

  const handleApprove = async (txnId) => {
    if (!txnId) return;
    setActionLoading(txnId);
    try {
      const res = await updateTransactionStatus(txnId, { status: "COMPLETED" });
      if (res.success) {
        toast.success("Purchase request approved! Transaction completed.");
        await loadData();
      }
    } catch (err) {
      toast.error(err.message || "Failed to approve request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (txnId) => {
    if (!txnId) return;
    setActionLoading(txnId);
    try {
      const res = await updateTransactionStatus(txnId, { status: "CANCELLED" });
      if (res.success) {
        toast.success("Purchase request declined.");
        await loadData();
      }
    } catch (err) {
      toast.error(err.message || "Failed to decline request");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (txnId) => {
    if (!txnId) return;
    setActionLoading(txnId);
    try {
      const res = await updateTransactionStatus(txnId, { status: "CANCELLED" });
      if (res.success) {
        toast.success("Purchase request cancelled.");
        await loadData();
      }
    } catch (err) {
      toast.error(err.message || "Failed to cancel request");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <MainLayout>
      <div className="container page-shell">
        <div className="page-head">
          <h1>My Purchases & Transactions</h1>
          <p>Track your college purchases, completed sales, and ratings.</p>
        </div>

        {/* Pending Reviews notification */}
        <PendingReviewsBanner onReviewSubmitted={loadData} />

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "24px",
            borderBottom: "1px solid var(--color-border, #E4DFD2)",
            paddingBottom: "10px",
          }}
        >
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            style={{
              background:
                activeTab === "all" ? "var(--color-ink, #16213E)" : "transparent",
              color:
                activeTab === "all" ? "#FFF" : "var(--color-text-muted, #5B6478)",
              border: "none",
              borderRadius: "999px",
              padding: "7px 18px",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            All Deals ({transactions.length})
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("purchases")}
            style={{
              background:
                activeTab === "purchases"
                  ? "var(--color-ink, #16213E)"
                  : "transparent",
              color:
                activeTab === "purchases"
                  ? "#FFF"
                  : "var(--color-text-muted, #5B6478)",
              border: "none",
              borderRadius: "999px",
              padding: "7px 18px",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            Purchases ({purchases.length})
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("sales")}
            style={{
              background:
                activeTab === "sales"
                  ? "var(--color-ink, #16213E)"
                  : "transparent",
              color:
                activeTab === "sales"
                  ? "#FFF"
                  : "var(--color-text-muted, #5B6478)",
              border: "none",
              borderRadius: "999px",
              padding: "7px 18px",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            Sales ({sales.length})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: "60px 0" }}>
            <Loader />
          </div>
        ) : displayedList.length === 0 ? (
          <EmptyState
            icon={FiShoppingBag}
            title={
              activeTab === "purchases"
                ? "No purchases yet"
                : activeTab === "sales"
                ? "No sales yet"
                : "No transactions found"
            }
            message={
              activeTab === "purchases"
                ? "Explore items listed by other NIT Kurukshetra students and make your first purchase!"
                : "List your unused books, calculators, and gadgets to start selling."
            }
            action={
              <Link to="/browse">
                <Button variant="primary">Browse Marketplace</Button>
              </Link>
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {displayedList.map((t) => {
              const isBuyer = getUserId(t.buyer) === currentUserIdStr;
              const counterpart = isBuyer ? t.seller : t.buyer;
              const isCompleted = t.status === "COMPLETED";
              const isPendingReview = t._id ? pendingTxnIds.has(t._id.toString()) : false;
              const formattedDate = t.createdAt
                ? new Date(t.createdAt).toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "";

              return (
                <div
                  key={t._id?.toString() || Math.random()}
                  style={{
                    background: "var(--color-paper-raised, #FFFFFF)",
                    border: "1px solid var(--color-border, #E4DFD2)",
                    borderRadius: "var(--radius-md, 14px)",
                    padding: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "18px",
                    flexWrap: "wrap",
                    boxShadow: "var(--shadow-sm, 0 2px 8px rgba(22, 33, 62, 0.04))",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      flex: 1,
                      minWidth: "260px",
                    }}
                  >
                    {/* Product Image */}
                    <div
                      style={{
                        width: "68px",
                        height: "68px",
                        borderRadius: "10px",
                        overflow: "hidden",
                        background: "var(--color-paper, #F8F6F0)",
                        flexShrink: 0,
                        border: "1px solid var(--color-border, #E4DFD2)",
                      }}
                    >
                      {t.product?.images?.[0] ? (
                        <img
                          src={resolveImageUrl(t.product.images[0])}
                          alt={t.product?.title || "Product"}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--color-text-muted, #5B6478)",
                          }}
                        >
                          <FiPackage size={24} />
                        </div>
                      )}
                    </div>

                    {/* Deal Details */}
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: isBuyer
                              ? "rgba(79, 117, 102, 0.12)"
                              : "rgba(225, 167, 59, 0.12)",
                            color: isBuyer
                              ? "var(--color-sage, #4F7566)"
                              : "var(--color-gold-dark, #B8842A)",
                          }}
                        >
                          {isBuyer ? "Purchase" : "Sale"}
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background:
                              t.status === "COMPLETED"
                                ? "rgba(79, 117, 102, 0.15)"
                                : t.status === "PENDING"
                                ? "rgba(225, 167, 59, 0.15)"
                                : "rgba(163, 59, 59, 0.12)",
                            color:
                              t.status === "COMPLETED"
                                ? "var(--color-sage, #4F7566)"
                                : t.status === "PENDING"
                                ? "var(--color-gold-dark, #B8842A)"
                                : "var(--color-crimson, #A33B3B)",
                          }}
                        >
                          {t.status === "PENDING" ? "PENDING APPROVAL" : t.status}
                        </span>
                      </div>

                      <h3
                        style={{
                          margin: "0 0 4px",
                          fontSize: "1.05rem",
                          color: "var(--color-ink, #16213E)",
                        }}
                      >
                        {t.product?._id ? (
                          <Link
                            to={`/products/${t.product._id}`}
                            style={{
                              color: "inherit",
                              textDecoration: "none",
                            }}
                          >
                            {t.product.title}
                          </Link>
                        ) : (
                          t.product?.title || "Marketplace Product"
                        )}
                      </h3>

                      <div
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--color-text-muted, #5B6478)",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span>
                          {isBuyer ? "Seller: " : "Buyer: "}
                          <strong style={{ color: "var(--color-ink, #16213E)" }}>
                            {counterpart?.name || "Student"}
                          </strong>
                          {counterpart?.isEmailVerified && (
                            <FiCheckCircle
                              size={12}
                              style={{
                                color: "var(--color-primary, #1B4D3E)",
                                marginLeft: "4px",
                                verticalAlign: "middle",
                              }}
                            />
                          )}
                        </span>
                        <span>•</span>
                        <span>{formattedDate}</span>
                        {t.meetupLocation && (
                          <>
                            <span>•</span>
                            <span>📍 {t.meetupLocation}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price and Actions */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontFamily: "var(--font-mono, monospace)",
                          fontSize: "1.2rem",
                          fontWeight: 700,
                          color: "var(--color-ink, #16213E)",
                        }}
                      >
                        ₹{Number(t.amount || t.product?.price || 0).toLocaleString("en-IN")}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted, #5B6478)" }}>
                        {t.status === "PENDING"
                          ? isBuyer
                            ? "Your Bid Offer"
                            : "Buyer's Bid Offer"
                          : "Final Amount"}
                      </div>
                    </div>

                    {/* Pending Request Actions (Approve/Decline for Seller, Cancel for Buyer) */}
                    {t.status === "PENDING" && (
                      <div>
                        {!isBuyer ? (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <Button
                              variant="primary"
                              onClick={() => handleApprove(t._id)}
                              loading={actionLoading === t._id}
                              style={{
                                background: "var(--color-primary, #1B4D3E)",
                                padding: "6px 14px",
                                fontSize: "0.82rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                border: "none",
                              }}
                            >
                              <FiCheckCircle size={14} />
                              <span>Accept Offer</span>
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleDecline(t._id)}
                              disabled={actionLoading === t._id}
                              style={{
                                color: "var(--color-crimson, #A33B3B)",
                                borderColor: "rgba(163, 59, 59, 0.4)",
                                padding: "6px 12px",
                                fontSize: "0.82rem",
                              }}
                            >
                              Decline
                            </Button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span
                              style={{
                                fontSize: "0.82rem",
                                color: "var(--color-gold-dark, #B8842A)",
                                background: "rgba(225, 167, 59, 0.12)",
                                padding: "4px 10px",
                                borderRadius: "999px",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <FiClock size={12} /> Awaiting Seller Approval
                            </span>
                            <Button
                              variant="outline"
                              onClick={() => handleCancel(t._id)}
                              disabled={actionLoading === t._id}
                              style={{
                                color: "var(--color-text-muted, #5B6478)",
                                borderColor: "var(--color-border, #E4DFD2)",
                                padding: "4px 10px",
                                fontSize: "0.78rem",
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Review Button or Review Status for Completed Deals */}
                    {isCompleted && (
                      <div>
                        {isPendingReview ? (
                          <Button
                            variant="primary"
                            onClick={() => handleOpenReview(t, isBuyer)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "8px 14px",
                              fontSize: "0.85rem",
                              background: "var(--color-gold, #E1A73B)",
                              border: "none",
                            }}
                          >
                            <FiStar size={15} />
                            <span>{isBuyer ? "Rate Seller" : "Rate Buyer"}</span>
                          </Button>
                        ) : (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "6px 12px",
                              borderRadius: "999px",
                              background: "rgba(79, 117, 102, 0.12)",
                              color: "var(--color-sage, #4F7566)",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                            }}
                          >
                            <FiCheckCircle size={14} />
                            <span>Review Submitted</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Review Modal */}
        {reviewModalOpen && selectedTxn && (
          <ReviewModal
            open={reviewModalOpen}
            onClose={() => setReviewModalOpen(false)}
            transaction={selectedTxn}
            onSuccess={handleReviewSuccess}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default MyTransactions;
