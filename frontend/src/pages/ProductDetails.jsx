import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  FiPhone,
  FiUser,
  FiHome as FiDept,
  FiMapPin,
  FiAlertTriangle,
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
      const res = await updateTransactionStatus(txnId, { status: "ACCEPTED" });
      if (res.success) {
        toast.success("Offer accepted! Meet up on campus to complete the deal.");
        fetchTxnInfo();
      }
    } catch (err) {
      toast.error(err.message || "Failed to accept offer");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteRequest = async (txnId) => {
    setActionLoading(txnId);
    try {
      const res = await updateTransactionStatus(txnId, { status: "COMPLETED" });
      if (res.success) {
        toast.success("Deal completed! You can now rate each other.");
        setProduct((prev) => ({ ...prev, status: "Sold" }));
        fetchTxnInfo();
        setTimeout(() => setReviewModalOpen(true), 400);
      }
    } catch (err) {
      toast.error(err.message || "Failed to complete deal");
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
            </div>

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

            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {/* 1. SELLER SEES INCOMING BIDS & OFFERS */}
              {isOwner && txnInfo?.pendingRequests?.length > 0 && (
                <div
                  style={{
                    background: "var(--color-paper-subtle)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    padding: "18px",
                    textAlign: "left",
                    boxShadow: "var(--shadow-xs)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontWeight: 700,
                        color: "var(--color-ink)",
                        fontSize: "0.95rem",
                      }}
                    >
                      <FiShoppingBag size={18} style={{ color: "var(--color-brand-accent)" }} />
                      <span>
                        Incoming Offers & Bids ({txnInfo.pendingRequests.length})
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
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
                          background: "var(--color-paper-raised)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-sm)",
                          padding: "14px",
                          boxShadow: "var(--shadow-xs)",
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
                            <span style={{ fontWeight: 700, color: "var(--color-ink)" }}>
                              {req.buyer?.name || "Student"}
                            </span>
                            {req.buyer?.isEmailVerified && (
                              <FiCheckCircle
                                size={13}
                                style={{
                                  color: "var(--color-success)",
                                  marginLeft: "5px",
                                  verticalAlign: "middle",
                                }}
                                title="Verified NIT Kurukshetra Student"
                              />
                            )}
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--color-text-muted)",
                                marginTop: "2px",
                              }}
                            >
                              {[req.buyer?.degree, req.buyer?.department, req.buyer?.year].filter(Boolean).join(" · ")}
                            </div>
                          </div>

                          {/* Bid Amount Badge */}
                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "1.2rem",
                                fontWeight: 700,
                                color:
                                  req.amount >= product.price
                                    ? "var(--color-success)"
                                    : "var(--color-brand-accent)",
                              }}
                            >
                              ₹{Number(req.amount).toLocaleString("en-IN")}
                            </div>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--color-text-muted)",
                                fontWeight: 500,
                              }}
                            >
                              {req.amount > product.price
                                ? "Above asking price"
                                : req.amount === product.price
                                ? "Asking price"
                                : "Proposed offer"}
                            </span>
                          </div>
                        </div>

                        {req.meetupLocation && (
                          <div
                            style={{
                              fontSize: "0.82rem",
                              color: "var(--color-text-muted)",
                              margin: "6px 0 4px",
                            }}
                          >
                            📍 Suggested spot: {req.meetupLocation}
                          </div>
                        )}

                        {req.notes && (
                          <div
                            style={{
                              fontSize: "0.82rem",
                              color: "var(--color-ink)",
                              fontStyle: "italic",
                              margin: "4px 0 12px",
                              padding: "6px 10px",
                              background: "var(--color-paper-subtle)",
                              borderRadius: "var(--radius-xs)",
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
                              color: "var(--color-danger)",
                              borderColor: "var(--color-border)",
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
                    background: "var(--color-paper-subtle)",
                    border: "1px solid var(--color-brand-accent)",
                    borderRadius: "var(--radius-md)",
                    padding: "18px",
                    textAlign: "center",
                    boxShadow: "var(--shadow-xs)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      fontWeight: 700,
                      color: "var(--color-brand-accent)",
                      marginBottom: "6px",
                      fontSize: "0.95rem",
                    }}
                  >
                    <FiClock />
                    <span>Your Proposed Offer is Pending</span>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "1.4rem",
                      fontWeight: 700,
                      color: "var(--color-ink)",
                      margin: "4px 0",
                    }}
                  >
                    ₹{Number(txnInfo.transaction.amount).toLocaleString("en-IN")}
                  </div>
                  <p
                    style={{
                      margin: "0 0 14px",
                      fontSize: "0.84rem",
                      color: "var(--color-text-muted)",
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
                    >
                      Update Offer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelRequest(txnInfo.transaction._id)}
                      loading={actionLoading === txnInfo.transaction._id}
                      style={{
                        color: "var(--color-danger)",
                      }}
                    >
                      Withdraw Offer
                    </Button>
                  </div>
                </div>
              )}

              {/* 2.5. MEETUP IN PROGRESS (ACCEPTED) */}
              {txnInfo?.transaction?.status === "ACCEPTED" && (
                <div
                  style={{
                    background: "var(--color-paper-subtle)",
                    border: "1px solid rgba(10, 132, 255, 0.35)",
                    borderRadius: "var(--radius-md)",
                    padding: "18px",
                    textAlign: "center",
                    boxShadow: "0 4px 16px rgba(0, 113, 227, 0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      fontWeight: 600,
                      color: "#0A84FF",
                      marginBottom: "6px",
                      fontSize: "0.95rem",
                    }}
                  >
                    <FiClock />
                    <span>Meetup in Progress</span>
                  </div>
                  <div
                    style={{
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
                      fontSize: "1.5rem",
                      fontWeight: 700,
                      color: "var(--color-ink)",
                      margin: "4px 0",
                    }}
                  >
                    ₹{Number(txnInfo.transaction.amount).toLocaleString("en-IN")}
                  </div>
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: "0.84rem",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {isOwner
                      ? `Agreed offer with ${txnInfo.targetUser?.name || "Buyer"}. Meet on campus to exchange item and payment.`
                      : `Offer accepted! Meet ${txnInfo.targetUser?.name || "Seller"} on campus to complete transaction.`}
                  </p>
                  {txnInfo.transaction.meetupLocation && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "3px 10px",
                        borderRadius: "9999px",
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        fontSize: "0.8rem",
                        color: "var(--color-text-muted)",
                        marginBottom: "14px",
                      }}
                    >
                      <FiMapPin size={12} />
                      <span>{txnInfo.transaction.meetupLocation}</span>
                    </div>
                  )}

                  {isOwner && (
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "6px" }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleCompleteRequest(txnInfo.transaction._id)}
                        loading={actionLoading === txnInfo.transaction._id}
                        disabled={Boolean(actionLoading)}
                        style={{
                          background: "#30D158",
                          border: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontWeight: 500,
                        }}
                      >
                        <FiCheckCircle size={14} />
                        <span>Complete Deal</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeclineRequest(txnInfo.transaction._id)}
                        disabled={Boolean(actionLoading)}
                        style={{
                          color: "var(--color-danger)",
                          borderColor: "rgba(255, 69, 58, 0.35)",
                        }}
                      >
                        Cancel Deal
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* 3. BUY PRODUCT / SUBMIT BID BUTTON */}
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
                    padding: "13px 20px",
                    boxShadow: "var(--shadow-md)",
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
                      ? "var(--color-success-bg)"
                      : "var(--color-paper-subtle)",
                    border: `1px solid ${
                      txnInfo.hasReviewed
                        ? "rgba(21, 128, 61, 0.3)"
                        : "var(--color-border)"
                    }`,
                    borderRadius: "var(--radius-md)",
                    padding: "16px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "0.92rem",
                      color: "var(--color-ink)",
                      marginBottom: "8px",
                    }}
                  >
                    {txnInfo.isBuyer
                      ? "Deal Completed! You purchased this item."
                      : "Deal Completed! You sold this item."}
                  </div>

                  {txnInfo.hasReviewed ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        color: "var(--color-success)",
                        fontSize: "0.88rem",
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
                      }}
                    >
                      <FiStar />{" "}
                      {txnInfo.isBuyer ? "Rate Seller & Experience" : "Rate Buyer & Experience"}
                    </Button>
                  )}
                </div>
              )}

              {/* 5. CHAT WITH SELLER */}
              <Button
                variant="outline"
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
                  ? "Listing Already Sold"
                  : "Chat with Seller (Encrypted)"}
              </Button>

              {/* 6. CALL SELLER */}
              {!isOwner && (
                <a
                  href={`tel:${product.seller?.phone}`}
                  style={{ display: "block" }}
                >
                  <Button variant="ghost" block disabled={isSold}>
                    <FiPhone style={{ marginRight: "0.4rem" }} /> Call Seller ({product.seller?.phone})
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
          <section className="section" style={{ padding: "40px 0 0" }}>
            <div style={{ textAlign: "left", margin: "0 0 20px", width: "100%" }}>
              <h2 style={{ margin: 0, fontSize: "1.45rem", color: "var(--color-ink, #16213E)" }}>Related Products</h2>
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
          <div className="modal-backdrop" onClick={() => !buying && setBuyModalOpen(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
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
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                }}
              >
                <FiX size={20} />
              </button>

              <div style={{ marginBottom: "16px" }}>
                <span className="section-eyebrow">Campus Deal</span>
                <h2 style={{ fontSize: "1.35rem", margin: 0 }}>
                  Make an Offer / Bid
                </h2>
              </div>

              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: "0.86rem",
                  color: "var(--color-text-muted)",
                  lineHeight: 1.5,
                }}
              >
                Submit your proposed offer for <strong>{product.title}</strong> to{" "}
                <strong>{product.seller?.name || "the seller"}</strong>. The seller will review all incoming bids.
              </p>

              {/* Product summary */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  padding: "12px",
                  background: "var(--color-paper-subtle)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
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
                      borderRadius: "6px",
                      objectFit: "cover",
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--color-ink)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {product.title}
                  </div>
                  <div
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: "var(--color-brand-accent)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    ₹{Number(product.price).toLocaleString("en-IN")}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
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
                        color: "var(--color-ink)",
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
                      color: "var(--color-text-muted)",
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
                    variant="outline"
                    onClick={() => setBuyModalOpen(false)}
                    disabled={buying}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={buying}
                  >
                    Submit Offer
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
