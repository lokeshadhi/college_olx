import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  FiPhone,
  FiUser,
  FiHome as FiDept,
  FiMapPin,
  FiAlertTriangle,
  FiShield,
  FiMessageSquare,
  FiCheckCircle,
  FiStar,
  FiShoppingBag,
  FiClock,
  FiX,
} from "react-icons/fi";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout.jsx";
import Loader from "../components/Loader.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ProductCard from "../components/ProductCard.jsx";
import Button from "../components/Button.jsx";
import StarRating from "../components/reviews/StarRating.jsx";
import ProductReviewsSection from "../components/reviews/ProductReviewsSection.jsx";
import ReviewModal from "../components/reviews/ReviewModal.jsx";
import { getProductById } from "../services/productService.js";
import { chatService } from "../services/chatService.js";
import {
  createTransaction,
  getProductTransaction,
  updateTransactionStatus,
} from "../services/transactionService.js";
import { useAuth } from "../hooks/useAuth.js";
import { resolveImageUrl } from "../utils/constants.js";

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingChat, setStartingChat] = useState(false);
  const [txnInfo, setTxnInfo] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [bidAmount, setBidAmount] = useState("");
  const [meetupLocation, setMeetupLocation] = useState("");
  const [notes, setNotes] = useState("");

  const isOwner = Boolean(
    user &&
      product &&
      ((product.owner?._id && product.owner._id.toString() === user._id.toString()) ||
        (product.owner && product.owner.toString() === user._id.toString()))
  );

  const handleStartChat = async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/products/${id}` } });
      return;
    }
    if (isOwner) {
      toast.error("You cannot chat on your own listing");
      return;
    }

    setStartingChat(true);
    try {
      const res = await chatService.createOrGetConversation(product._id);
      if (res.success && res.data?._id) {
        navigate(`/chat/${res.data._id}`);
      }
    } catch (err) {
      toast.error(err.message || "Failed to start conversation");
    } finally {
      setStartingChat(false);
    }
  };

  const fetchTxnInfo = () => {
    if (isAuthenticated && id) {
      getProductTransaction(id)
        .then((res) => {
          if (res.success && res.data) {
            setTxnInfo(res.data);
            if (res.data.transaction?.amount) {
              setBidAmount(res.data.transaction.amount);
            }
          } else {
            setTxnInfo(null);
          }
        })
        .catch(() => setTxnInfo(null));
    }
  };

  useEffect(() => {
    setLoading(true);
    setActiveImage(0);
    getProductById(id)
      .then((res) => {
        setProduct(res.data);
        setRelated(res.related || []);
        if (res.data?.location) {
          setMeetupLocation(res.data.location);
        }
        if (res.data?.price) {
          setBidAmount(res.data.price);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    fetchTxnInfo();
  }, [id, isAuthenticated]);

  const handleBuyNowClick = () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/products/${id}` } });
      return;
    }
    if (isOwner) {
      toast.error("You cannot buy your own listing");
      return;
    }
    if (product.status === "Sold") {
      toast.error("This product is already sold");
      return;
    }
    setBidAmount(txnInfo?.transaction?.amount || product.price);
    setBuyModalOpen(true);
  };

  const handleConfirmPurchase = async (e) => {
    e.preventDefault();
    const parsedAmount = Number(bidAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Please enter a valid bid amount greater than 0");
      return;
    }

    setBuying(true);
    try {
      const res = await createTransaction({
        productId: product._id,
        amount: parsedAmount,
        meetupLocation,
        notes,
        status: "PENDING",
      });

      if (res.success) {
        toast.success(res.message || "Bid offer sent to seller! Waiting for seller approval.");
        setBuyModalOpen(false);
        fetchTxnInfo();
      }
    } catch (err) {
      toast.error(err.message || "Failed to send bid offer");
    } finally {
      setBuying(false);
    }
  };

  const handleApproveRequest = async (txnId) => {
    setActionLoading(txnId);
    try {
      const res = await updateTransactionStatus(txnId, { status: "COMPLETED" });
      if (res.success) {
        toast.success("Offer accepted! Transaction completed.");
        setProduct((prev) => ({ ...prev, status: "Sold" }));
        fetchTxnInfo();
        setTimeout(() => setReviewModalOpen(true), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to accept offer");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineRequest = async (txnId) => {
    setActionLoading(txnId);
    try {
      const res = await updateTransactionStatus(txnId, { status: "CANCELLED" });
      if (res.success) {
        toast.success("Offer declined.");
        fetchTxnInfo();
      }
    } catch (err) {
      toast.error(err.message || "Failed to decline offer");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRequest = async (txnId) => {
    setActionLoading(txnId);
    try {
      const res = await updateTransactionStatus(txnId, { status: "CANCELLED" });
      if (res.success) {
        toast.success("Bid offer withdrawn.");
        fetchTxnInfo();
      }
    } catch (err) {
      toast.error(err.message || "Failed to withdraw bid");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReviewSuccess = (savedReview) => {
    setTxnInfo((prev) => ({
      ...prev,
      hasReviewed: true,
      existingReview: savedReview,
    }));
    toast.success("Thank you for your feedback!");
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container page-shell">
          <Loader />
        </div>
      </MainLayout>
    );
  }

  if (error || !product) {
    return (
      <MainLayout>
        <div className="container page-shell">
          <EmptyState
            title="Product not found"
            message={error || "This listing may have been removed."}
            action={
              <Link to="/browse">
                <Button variant="primary">Back to Browse</Button>
              </Link>
            }
          />
        </div>
      </MainLayout>
    );
  }

  const images = product.images?.length ? product.images : [null];
  const isSold = product.status === "Sold";

  return (
    <MainLayout>
      <div className="container page-shell">
        <div className="details-layout">
          <div>
            <div className="gallery-main">
              <img src={resolveImageUrl(images[activeImage])} alt={product.title} />
            </div>
            {images.length > 1 && (
              <div className="gallery-thumbs">
                {images.map((img, i) => (
                  <img
                    key={i}
                    src={resolveImageUrl(img)}
                    alt={`${product.title} ${i + 1}`}
                    className={i === activeImage ? "active" : ""}
                    onClick={() => setActiveImage(i)}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <span className="details-category">{product.category}</span>
            <h1 className="details-title">{product.title}</h1>
            <div className="details-price">₹{Number(product.price).toLocaleString("en-IN")}</div>

            <div className="details-badges">
              <span className={`badge ${isSold ? "badge-sold" : "badge-available"}`}>{product.status}</span>
              <span className="badge badge-condition">{product.condition}</span>
              {product.securityAssessment?.riskLevel === "LOW" && (
                <span className="badge" style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <FiShield /> Campus Verified
                </span>
              )}
            </div>

            {product.securityAssessment && (product.securityAssessment.riskLevel === "HIGH" || product.securityAssessment.riskLevel === "CRITICAL") && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #f87171",
                  borderRadius: "var(--radius-sm, 8px)",
                  padding: "12px 16px",
                  margin: "16px 0",
                  color: "#991b1b",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                  <FiAlertTriangle /> Security Warning: High Risk Listing
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "0.85rem", lineHeight: 1.4 }}>
                  Our automated security scanner flagged potential risk in this listing
                  {product.securityAssessment.flags?.length ? `: ${product.securityAssessment.flags.join(", ")}` : ""}.
                  Never send advance payments or wire money. Meet on campus in daylight hours.
                </p>
              </div>
            )}

            <p className="details-desc">{product.description}</p>

            <div className="seller-card">
              <h4>Seller Information</h4>
              <div className="seller-row">
                <span>
                  <FiUser /> Name
                </span>
                <span>{product.seller?.name}</span>
              </div>
              <div className="seller-row">
                <span>
                  <FiDept /> Department
                </span>
                <span>{product.seller?.department}</span>
              </div>
              <div className="seller-row">
                <span>
                  <FiPhone /> Phone
                </span>
                <span>{product.seller?.phone}</span>
              </div>
              {product.location && (
                <div className="seller-row">
                  <span>
                    <FiMapPin /> Location
                  </span>
                  <span>{product.location}</span>
                </div>
              )}
              <div className="seller-row">
                <span>
                  <FiStar /> Rating
                </span>
                <span>
                  {product.owner?.sellerRating > 0 ? (
                    <StarRating
                      rating={product.owner.sellerRating}
                      size="sm"
                      showValue
                      showCount
                      count={product.owner.sellerReviewCount || 0}
                    />
                  ) : (
                    <span style={{ fontSize: "0.82rem", color: "var(--color-text-muted, #5B6478)" }}>
                      New Seller (No reviews yet)
                    </span>
                  )}
                </span>
              </div>
              {Boolean(product.owner?.isEmailVerified ?? product.seller?.isEmailVerified) && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "12px",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: "rgba(27, 77, 62, 0.1)",
                    color: "var(--color-primary, #1B4D3E)",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                  }}
                >
                  <FiCheckCircle style={{ color: "var(--color-primary, #1B4D3E)" }} />
                  <span>Verified Student</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* 1. SELLER SEES INCOMING BIDS & OFFERS */}
              {isOwner && txnInfo?.pendingRequests?.length > 0 && (
                <div
                  style={{
                    background: "rgba(27, 77, 62, 0.05)",
                    border: "1px solid rgba(27, 77, 62, 0.25)",
                    borderRadius: "var(--radius-sm, 8px)",
                    padding: "16px",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontWeight: 700,
                        color: "var(--color-primary, #1B4D3E)",
                        fontSize: "0.95rem",
                      }}
                    >
                      <FiShoppingBag size={18} />
                      <span>
                        Incoming Offers & Bids ({txnInfo.pendingRequests.length})
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        color: "var(--color-text-muted, #5B6478)",
                      }}
                    >
                      Highest offer first
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {txnInfo.pendingRequests.map((req) => (
                      <div
                        key={req._id}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid var(--color-border, #E4DFD2)",
                          borderRadius: "8px",
                          padding: "12px 14px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "6px",
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 700, color: "var(--color-ink, #16213E)" }}>
                              {req.buyer?.name || "Student"}
                            </span>
                            {req.buyer?.isEmailVerified && (
                              <FiCheckCircle
                                size={12}
                                style={{
                                  color: "var(--color-primary, #1B4D3E)",
                                  marginLeft: "4px",
                                  verticalAlign: "middle",
                                }}
                              />
                            )}
                            <div
                              style={{
                                fontSize: "0.76rem",
                                color: "var(--color-text-muted, #5B6478)",
                              }}
                            >
                              {req.buyer?.department} · {req.buyer?.year}
                            </div>
                          </div>

                          {/* Bid Amount Badge */}
                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                fontFamily: "var(--font-mono, monospace)",
                                fontSize: "1.15rem",
                                fontWeight: 700,
                                color:
                                  req.amount >= product.price
                                    ? "var(--color-sage, #4F7566)"
                                    : "var(--color-coral, #D9634B)",
                              }}
                            >
                              ₹{Number(req.amount).toLocaleString("en-IN")}
                            </div>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--color-text-muted, #5B6478)",
                              }}
                            >
                              {req.amount > product.price
                                ? "Above asking price"
                                : req.amount === product.price
                                ? "Asking price"
                                : "Below asking price"}
                            </span>
                          </div>
                        </div>

                        {req.meetupLocation && (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--color-text-muted, #5B6478)",
                              marginBottom: "4px",
                            }}
                          >
                            📍 {req.meetupLocation}
                          </div>
                        )}

                        {req.notes && (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--color-ink, #16213E)",
                              fontStyle: "italic",
                              marginBottom: "10px",
                            }}
                          >
                            "{req.notes}"
                          </div>
                        )}

                        {/* Actions for this specific bid */}
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleApproveRequest(req._id)}
                            loading={actionLoading === req._id}
                            disabled={Boolean(actionLoading)}
                            style={{
                              flex: 1,
                              background: "var(--color-primary, #1B4D3E)",
                              padding: "6px 12px",
                              fontSize: "0.82rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "4px",
                            }}
                          >
                            <FiCheckCircle size={14} /> Accept Offer (₹{Number(req.amount).toLocaleString("en-IN")})
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeclineRequest(req._id)}
                            disabled={Boolean(actionLoading)}
                            style={{
                              color: "var(--color-crimson, #A33B3B)",
                              borderColor: "rgba(163, 59, 59, 0.4)",
                              padding: "6px 10px",
                              fontSize: "0.82rem",
                            }}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. BUYER SEES THEIR PENDING BID */}
              {!isOwner && txnInfo?.transaction?.status === "PENDING" && txnInfo?.isBuyer && (
                <div
                  style={{
                    background: "rgba(225, 167, 59, 0.12)",
                    border: "1px solid rgba(225, 167, 59, 0.4)",
                    borderRadius: "var(--radius-sm, 8px)",
                    padding: "16px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      fontWeight: 700,
                      color: "var(--color-gold-dark, #B8842A)",
                      marginBottom: "6px",
                      fontSize: "0.92rem",
                    }}
                  >
                    <FiClock />
                    <span>Your Bid Offer is Pending</span>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "1.3rem",
                      fontWeight: 700,
                      color: "var(--color-ink, #16213E)",
                      margin: "4px 0",
                    }}
                  >
                    ₹{Number(txnInfo.transaction.amount).toLocaleString("en-IN")}
                  </div>
                  <p
                    style={{
                      margin: "0 0 12px",
                      fontSize: "0.84rem",
                      color: "var(--color-text-muted, #5B6478)",
                    }}
                  >
                    Listed Price: ₹{Number(product.price).toLocaleString("en-IN")}. Waiting for seller to review and accept your offer.
                  </p>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setBidAmount(txnInfo.transaction.amount);
                        setBuyModalOpen(true);
                      }}
                      style={{
                        fontSize: "0.82rem",
                        padding: "6px 14px",
                        background: "var(--color-gold, #E1A73B)",
                        border: "none",
                      }}
                    >
                      Update Bid
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelRequest(txnInfo.transaction._id)}
                      loading={actionLoading === txnInfo.transaction._id}
                      style={{
                        fontSize: "0.82rem",
                        padding: "6px 14px",
                        color: "var(--color-crimson, #A33B3B)",
                        borderColor: "rgba(163, 59, 59, 0.4)",
                      }}
                    >
                      Withdraw Bid
                    </Button>
                  </div>
                </div>
              )}

              {/* 3. BUY PRODUCT / SUBMIT BID BUTTON (when product is available, user is not owner, and no pending/completed txn) */}
              {!isSold && !isOwner && (!txnInfo?.transaction || txnInfo.transaction.status === "CANCELLED") && (
                <Button
                  variant="primary"
                  block
                  onClick={handleBuyNowClick}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    fontSize: "1rem",
                    padding: "12px",
                    background:
                      "var(--gradient-cta, linear-gradient(135deg, #E1A73B 0%, #D9634B 100%))",
                    boxShadow: "0 4px 14px rgba(225, 167, 59, 0.35)",
                    border: "none",
                  }}
                >
                  <FiShoppingBag size={18} /> Make Offer / Buy (₹{Number(product.price).toLocaleString("en-IN")})
                </Button>
              )}

              {/* 4. COMPLETED TRANSACTION & TWO-WAY REVIEWS */}
              {txnInfo?.transaction?.status === "COMPLETED" && (
                <div
                  style={{
                    background: txnInfo.hasReviewed
                      ? "rgba(79, 117, 102, 0.1)"
                      : "rgba(225, 167, 59, 0.12)",
                    border: `1px solid ${
                      txnInfo.hasReviewed
                        ? "rgba(79, 117, 102, 0.3)"
                        : "rgba(225, 167, 59, 0.4)"
                    }`,
                    borderRadius: "var(--radius-sm, 8px)",
                    padding: "12px 16px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      color: "var(--color-ink, #16213E)",
                      marginBottom: "6px",
                    }}
                  >
                    {txnInfo.isBuyer
                      ? "You purchased this item!"
                      : "You sold this item!"}
                  </div>

                  {txnInfo.hasReviewed ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        color: "var(--color-sage, #4F7566)",
                        fontSize: "0.86rem",
                        fontWeight: 600,
                      }}
                    >
                      <FiCheckCircle />
                      <span>
                        Review Submitted ({txnInfo.existingReview?.rating} ★)
                      </span>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      block
                      onClick={() => setReviewModalOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        background: "var(--color-gold, #E1A73B)",
                        border: "none",
                      }}
                    >
                      <FiStar />{" "}
                      {txnInfo.isBuyer ? "Rate Seller" : "Rate Buyer"}
                    </Button>
                  )}
                </div>
              )}

              {/* 3. CHAT WITH SELLER */}
              <Button
                variant="secondary"
                block
                disabled={isSold || isOwner}
                loading={startingChat}
                onClick={handleStartChat}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <FiMessageSquare />{" "}
                {isOwner
                  ? "Your Listing"
                  : isSold
                  ? "Already Sold"
                  : "Chat with Seller"}
              </Button>

              {/* 4. CALL SELLER */}
              {!isOwner && (
                <a
                  href={`tel:${product.seller?.phone}`}
                  style={{ display: "block" }}
                >
                  <Button variant="secondary" block disabled={isSold}>
                    <FiPhone style={{ marginRight: "0.4rem" }} /> Call Seller (
                    {product.seller?.phone})
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Product & Seller Reviews Section */}
        <ProductReviewsSection
          productId={product._id}
          seller={product.owner || product.seller}
        />

        {related.length > 0 && (
          <section className="section">
            <div className="section-head" style={{ textAlign: "left", margin: "0 0 24px" }}>
              <h2>Related Products</h2>
            </div>
            <div className="product-grid">
              {related.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* Buy Confirmation Modal */}
        {buyModalOpen && (
          <div
            className="modal-backdrop"
            onClick={() => !buying && setBuyModalOpen(false)}
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
                maxWidth: "480px",
                width: "100%",
                padding: "26px",
                position: "relative",
              }}
            >
              <button
                type="button"
                onClick={() => !buying && setBuyModalOpen(false)}
                aria-label="Close modal"
                style={{
                  position: "absolute",
                  top: "18px",
                  right: "18px",
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text-muted, #5B6478)",
                  cursor: "pointer",
                }}
              >
                <FiX size={20} />
              </button>

              <div style={{ marginBottom: "16px" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
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
                  Campus Deal
                </span>
                <h2
                  style={{
                    fontFamily: "var(--font-display, Georgia, serif)",
                    fontSize: "1.35rem",
                    margin: 0,
                    color: "var(--color-ink, #16213E)",
                  }}
                >
                  Make a Bid / Purchase Offer
                </h2>
              </div>

              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: "0.86rem",
                  color: "var(--color-text-muted, #5B6478)",
                  lineHeight: 1.5,
                }}
              >
                Submit your proposed offer for <strong>{product.title}</strong> to <strong>{product.seller?.name || "the seller"}</strong>.
                The seller can review all incoming bids and accept the best one.
              </p>

              {/* Product summary */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  padding: "12px",
                  background: "var(--color-paper, #F8F6F0)",
                  borderRadius: "var(--radius-sm, 8px)",
                  marginBottom: "18px",
                }}
              >
                {product.images?.[0] && (
                  <img
                    src={resolveImageUrl(product.images[0])}
                    alt={product.title}
                    style={{
                      width: "54px",
                      height: "54px",
                      borderRadius: "8px",
                      objectFit: "cover",
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--color-ink, #16213E)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {product.title}
                  </div>
                  <div
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      color: "var(--color-coral, #D9634B)",
                    }}
                  >
                    ₹{Number(product.price).toLocaleString("en-IN")}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted, #5B6478)" }}>
                    Seller: {product.seller?.name} · {product.seller?.department}
                  </div>
                </div>
              </div>

              <form onSubmit={handleConfirmPurchase}>
                {/* Bid Offer Amount Input */}
                <div className="form-group" style={{ marginBottom: "14px" }}>
                  <label className="form-label" htmlFor="bid-amount" style={{ fontWeight: 600 }}>
                    Your Offer / Bid Amount (₹)
                  </label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontWeight: 700,
                        color: "var(--color-ink, #16213E)",
                      }}
                    >
                      ₹
                    </span>
                    <input
                      id="bid-amount"
                      type="number"
                      min="1"
                      step="1"
                      required
                      className="form-input"
                      style={{ paddingLeft: "28px", fontWeight: 700, fontSize: "1.1rem" }}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={`Listing price is ₹${product.price}`}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--color-text-muted, #5B6478)",
                      marginTop: "4px",
                    }}
                  >
                    Asking price: ₹{Number(product.price).toLocaleString("en-IN")}. You can offer the asking price or propose a custom bid.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "14px" }}>
                  <label className="form-label" htmlFor="meetup-location">
                    Suggested Campus Meetup Spot
                  </label>
                  <input
                    id="meetup-location"
                    className="form-input"
                    value={meetupLocation}
                    onChange={(e) => setMeetupLocation(e.target.value)}
                    placeholder="e.g. Central Library, SAC, Hostel 7"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "20px" }}>
                  <label className="form-label" htmlFor="purchase-notes">
                    Note for Seller (optional)
                  </label>
                  <input
                    id="purchase-notes"
                    className="form-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Free after 4 PM, let's meet then!"
                  />
                </div>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setBuyModalOpen(false)}
                    disabled={buying}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={buying}
                    style={{
                      background:
                        "var(--gradient-cta, linear-gradient(135deg, #E1A73B 0%, #D9634B 100%))",
                    }}
                  >
                    Submit Bid Offer
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Review Modal */}
        {reviewModalOpen && (
          <ReviewModal
            open={reviewModalOpen}
            onClose={() => setReviewModalOpen(false)}
            transaction={
              txnInfo?.transaction || {
                product,
                targetUser: txnInfo?.targetUser || product.owner || product.seller,
                targetRole: txnInfo?.targetRole || (isOwner ? "buyer" : "seller"),
              }
            }
            onSuccess={handleReviewSuccess}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default ProductDetails;
