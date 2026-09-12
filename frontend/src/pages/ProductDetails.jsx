import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FiPhone, FiUser, FiHome as FiDept, FiMapPin, FiAlertTriangle, FiShield, FiMessageSquare, FiCheckCircle, FiStar } from "react-icons/fi";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout.jsx";
import Loader from "../components/Loader.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ProductCard from "../components/ProductCard.jsx";
import Button from "../components/Button.jsx";
import StarRating from "../components/reviews/StarRating.jsx";
import ProductReviewsSection from "../components/reviews/ProductReviewsSection.jsx";
import { getProductById } from "../services/productService.js";
import { chatService } from "../services/chatService.js";
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

  useEffect(() => {
    setLoading(true);
    setActiveImage(0);
    getProductById(id)
      .then((res) => {
        setProduct(res.data);
        setRelated(res.related || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

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

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <Button
                variant="primary"
                block
                disabled={isSold || isOwner}
                loading={startingChat}
                onClick={handleStartChat}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
              >
                <FiMessageSquare /> {isOwner ? "Your Listing" : isSold ? "Already Sold" : "Chat with Seller"}
              </Button>

              <a href={`tel:${product.seller?.phone}`} style={{ display: "block" }}>
                <Button variant="secondary" block disabled={isSold}>
                  <FiPhone style={{ marginRight: "0.4rem" }} /> Call Seller ({product.seller?.phone})
                </Button>
              </a>
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
      </div>
    </MainLayout>
  );
};

export default ProductDetails;
