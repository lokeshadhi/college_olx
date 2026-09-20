import { Link } from "react-router-dom";
import { FiCheckCircle, FiClock } from "react-icons/fi";
import { resolveImageUrl } from "../utils/constants.js";

const timeAgo = (dateString) => {
  if (!dateString) return "";
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

const ProductCard = ({ product }) => {
  if (!product) return null;
  const isSold = product.status === "Sold";
  const isVerified = Boolean(
    product.owner?.isEmailVerified ?? product.seller?.isEmailVerified
  );

  return (
    <div className="product-card">
      <Link to={`/products/${product._id}`} className="product-card-media">
        <img
          src={resolveImageUrl(product.images?.[0])}
          alt={product.title}
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "https://placehold.co/600x450?text=CampusX";
          }}
        />

        <div className="product-card-badges">
          <span className="card-pill-condition">{product.condition}</span>
          {isSold && <span className="card-pill-sold">SOLD</span>}
        </div>
      </Link>

      <div className="product-card-body">
        <span className="product-card-cat">{product.category}</span>
        <Link to={`/products/${product._id}`} className="product-card-title" title={product.title}>
          {product.title}
        </Link>

        <div className="product-card-price-row">
          <span className="product-card-price">
            ₹{Number(product.price).toLocaleString("en-IN")}
          </span>
        </div>

        <div className="product-card-meta">
          <div className="product-seller-info" title={product.seller?.name || "Student"}>
            <span>{product.seller?.name || "Student"}</span>
            {isVerified && (
              <FiCheckCircle
                size={13}
                className="seller-verified-icon"
                title="Verified NIT Kurukshetra Student"
              />
            )}
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
            <FiClock size={12} />
            {timeAgo(product.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
