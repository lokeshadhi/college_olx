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
        <div className="transactions-tab-bar">
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={`btn btn-sm ${activeTab === "all" ? "btn-primary" : "btn-outline"}`}
          >
            All Deals ({transactions.length})
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("purchases")}
            className={`btn btn-sm ${activeTab === "purchases" ? "btn-primary" : "btn-outline"}`}
          >
            My Bids & Purchases ({purchases.length})
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("sales")}
            className={`btn btn-sm ${activeTab === "sales" ? "btn-primary" : "btn-outline"}`}
          >
            My Sales & Offers ({sales.length})
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
                              : t.status === "PENDING"
                              ? "transaction-badge-pending"
                              : "transaction-badge-cancelled"
                          }`}
                        >
                          {t.status === "PENDING" ? "PENDING APPROVAL" : t.status}
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
                  <div className="transaction-actions-col">
                    <div className="transaction-price-block">
                      <div className="transaction-price">
                        ₹{Number(t.amount || t.product?.price || 0).toLocaleString("en-IN")}
                      </div>
                      <div className="transaction-price-label">
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
                                background: "var(--color-brand-accent)",
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
                                color: "var(--color-danger)",
                                borderColor: "var(--color-danger)",
                                padding: "6px 12px",
                                fontSize: "0.82rem",
                              }}
                            >
                              Decline
                            </Button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                            <span
                              style={{
                                fontSize: "0.82rem",
                                color: "var(--color-apple-orange)",
                                background: "var(--color-warning-bg)",
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
                              background: "var(--color-brand-accent)",
                              border: "none",
                            }}
                          >
                            <FiStar size={15} />
                            <span>{isBuyer ? "Rate Seller" : "Rate Buyer"}</span>
                          </Button>
                        ) : (
                          <div className="transaction-status-pill success">
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
