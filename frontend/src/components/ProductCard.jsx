import { Link } from "react-router-dom";
import { resolveImageUrl } from "../utils/constants.js";

const timeAgo = (dateString) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

const ProductCard = ({ product }) => {
  const isSold = product.status === "Sold";

  return (
    <div className="product-card">
      <Link to={`/products/${product._id}`} className="product-card-media">
        <img src={resolveImageUrl(product.images?.[0])} alt={product.title} loading="lazy" />
        <div className={`stamp ${isSold ? "stamp-sold" : ""}`}>
          {isSold ? "SOLD" : product.condition}
        </div>
      </Link>
      <div className="product-card-body">
        <span className="product-card-cat">{product.category}</span>
        <Link to={`/products/${product._id}`} className="product-card-title">
          {product.title}
        </Link>
        <span className="product-card-price">₹{Number(product.price).toLocaleString("en-IN")}</span>
        <div className="product-card-meta">
          <span>{product.seller?.name}</span>
          <span>{timeAgo(product.createdAt)}</span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
