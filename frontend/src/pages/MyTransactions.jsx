import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiPackage,
  FiShoppingBag,
  FiStar,
  FiCheckCircle,
  FiClock,
  FiMapPin,
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
      const res = await updateTransactionStatus(txnId, { status: "ACCEPTED" });
      if (res.success) {
        toast.success("Offer accepted! Meet up on campus to complete the deal.");
        await loadData();
      }
    } catch (err) {
      toast.error(err.message || "Failed to accept offer");
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmCompletion = async (txnId) => {
    if (!txnId) return;
    setActionLoading(txnId);
    try {
      const res = await updateTransactionStatus(txnId, { confirmCompletion: true });
      if (res.success) {
        if (res.data?.status === "COMPLETED") {
          toast.success("Deal finalized! Both parties have confirmed. You can now rate each other.");
        } else {
          toast.success("Confirmation recorded! Waiting for the other party to confirm.");
        }
        await loadData();
      }
    } catch (err) {
      toast.error(err.message || "Failed to confirm deal");
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
        <div className="transactions-tab-bar">
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={`transactions-segment-btn ${activeTab === "all" ? "active" : ""}`}
          >
            <span>All Deals</span>
            <span className="transactions-segment-count">{transactions.length}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("purchases")}
            className={`transactions-segment-btn ${activeTab === "purchases" ? "active" : ""}`}
          >
            <span>My Bids & Purchases</span>
            <span className="transactions-segment-count">{purchases.length}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("sales")}
            className={`transactions-segment-btn ${activeTab === "sales" ? "active" : ""}`}
          >
            <span>My Sales & Offers</span>
            <span className="transactions-segment-count">{sales.length}</span>
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
          <div className="transactions-list">
            {displayedList.map((t) => {
              const isBuyer = getUserId(t.buyer) === currentUserIdStr;
              const counterpart = isBuyer ? t.seller : t.buyer;
              const isCompleted = t.status === "COMPLETED";
              const isAccepted = t.status === "ACCEPTED";
              const isPending = t.status === "PENDING";
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
                  className="transaction-card"
                >
                  <div className="transaction-main">
                    {/* Product Image */}
                    <div className="transaction-thumb">
                      {t.product?.images?.[0] ? (
                        <img
                          src={resolveImageUrl(t.product.images[0])}
                          alt={t.product?.title || "Product"}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          <FiPackage size={24} />
                        </div>
                      )}
                    </div>

                    {/* Deal Details */}
                    <div className="transaction-info">
                      <div className="transaction-badges">
                        <span
                          className={`transaction-badge ${
                            isBuyer ? "transaction-badge-purchase" : "transaction-badge-sale"
                          }`}
                        >
                          {isBuyer ? "Purchase" : "Sale"}
                        </span>
                        <span
                          className={`transaction-badge ${
                            t.status === "COMPLETED"
                              ? "transaction-badge-completed"
                              : t.status === "ACCEPTED"
                              ? "transaction-badge-accepted"
                              : t.status === "PENDING"
                              ? "transaction-badge-pending"
                              : "transaction-badge-cancelled"
                          }`}
                        >
                          {t.status === "PENDING"
                            ? "Pending Approval"
                            : t.status === "ACCEPTED"
                            ? "Meetup in Progress"
                            : t.status === "COMPLETED"
                            ? "Completed"
                            : "Cancelled"}
                        </span>
                      </div>

                      <h3 className="transaction-title">
                        {t.product?._id ? (
                          <Link to={`/products/${t.product._id}`}>
                            {t.product.title}
                          </Link>
                        ) : (
                          t.product?.title || "Marketplace Product"
                        )}
                      </h3>

                      <div className="transaction-meta">
                        <span>
                          {isBuyer ? "Seller: " : "Buyer: "}
                          <strong>{counterpart?.name || "Student"}</strong>
                          {counterpart?.isEmailVerified && (
                            <FiCheckCircle
                              size={12}
                              style={{
                                color: "var(--color-primary)",
                                marginLeft: "4px",
                                verticalAlign: "middle",
                              }}
                            />
                          )}
                        </span>
                        <span className="transaction-meta-dot">•</span>
                        <span>{formattedDate}</span>
                        {t.meetupLocation && (
                          <>
                            <span className="transaction-meta-dot">•</span>
                            <span className="transaction-location-pill">
                              <FiMapPin size={11} />
                              <span>{t.meetupLocation}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Price Column */}
                  <div className="transaction-actions-col">
                    {/* 1. Review Status or Rate Button for Completed Deals (Rendered at TOP of price) */}
                    {isCompleted && (
                      <div>
                        {isPendingReview ? (
                          <button
                            type="button"
                            className="transaction-rate-btn"
                            onClick={() => handleOpenReview(t, isBuyer)}
                          >
                            <FiStar size={14} />
                            <span>{isBuyer ? "Rate Seller" : "Rate Buyer"}</span>
                          </button>
                        ) : (
                          <div className="transaction-status-pill success">
                            <FiCheckCircle size={14} />
                            <span>Review Submitted</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. Meetup in Progress State (ACCEPTED) - Mutual Agreement */}
                    {isAccepted && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                        {(() => {
                          const myConfirmed = isBuyer ? Boolean(t.buyerConfirmed) : Boolean(t.sellerConfirmed);
                          const counterpartConfirmed = isBuyer ? Boolean(t.sellerConfirmed) : Boolean(t.buyerConfirmed);

                          if (!myConfirmed) {
                            return (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                                {counterpartConfirmed && (
                                  <div style={{ fontSize: "0.76rem", color: "#FFD60A", fontWeight: 500 }}>
                                    {counterpart?.name || "Other party"} has confirmed! Click below to finalize.
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                  <button
                                    type="button"
                                    className="transaction-confirm-btn"
                                    onClick={() => handleConfirmCompletion(t._id)}
                                    disabled={actionLoading === t._id}
                                  >
                                    <FiCheckCircle size={14} />
                                    <span>
                                      {actionLoading === t._id
                                        ? "Confirming..."
                                        : isBuyer
                                        ? "Confirm Receipt"
                                        : "Confirm Handover"}
                                    </span>
                                  </button>
                                  {!isBuyer && (
                                    <button
                                      type="button"
                                      className="transaction-decline-btn"
                                      onClick={() => handleDecline(t._id)}
                                      disabled={actionLoading === t._id}
                                    >
                                      Cancel Deal
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <span className="transaction-status-pill accepted">
                              <FiClock size={12} /> You confirmed • Awaiting {isBuyer ? "seller handover" : "buyer receipt"}
                            </span>
                          );
                        })()}
                      </div>
                    )}

                    {/* 3. Pending Bid Requests (PENDING) */}
                    {isPending && (
                      <div>
                        {!isBuyer ? (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <button
                              type="button"
                              className="transaction-accept-btn"
                              onClick={() => handleApprove(t._id)}
                              disabled={actionLoading === t._id}
                            >
                              <FiCheckCircle size={14} />
                              <span>{actionLoading === t._id ? "Accepting..." : "Accept Offer"}</span>
                            </button>
                            <button
                              type="button"
                              className="transaction-decline-btn"
                              onClick={() => handleDecline(t._id)}
                              disabled={actionLoading === t._id}
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                            <span
                              style={{
                                fontSize: "0.8rem",
                                color: "#FF9F0A",
                                background: "rgba(255, 159, 10, 0.12)",
                                border: "1px solid rgba(255, 159, 10, 0.22)",
                                padding: "4px 10px",
                                borderRadius: "9999px",
                                fontWeight: 500,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                              }}
                            >
                              <FiClock size={12} /> Awaiting Seller Approval
                            </span>
                            <Button
                              variant="outline"
                              onClick={() => handleCancel(t._id)}
                              disabled={actionLoading === t._id}
                              style={{
                                color: "var(--color-text-muted)",
                                borderColor: "var(--color-border)",
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

                    {/* 4. Price Block (Positioned BELOW the action button / status pill) */}
                    <div className="transaction-price-block">
                      <div className="transaction-price">
                        ₹{Number(t.amount || t.product?.price || 0).toLocaleString("en-IN")}
                      </div>
                      <div className="transaction-price-label">
                        {t.status === "PENDING"
                          ? isBuyer
                            ? "Your Bid Offer"
                            : "Buyer's Bid Offer"
                          : t.status === "ACCEPTED"
                          ? "Agreed Price"
                          : "Final Amount"}
                      </div>
                    </div>
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
