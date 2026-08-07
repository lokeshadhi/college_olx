import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FiPhone, FiUser, FiHome as FiDept, FiMapPin } from "react-icons/fi";
import MainLayout from "../layouts/MainLayout.jsx";
import Loader from "../components/Loader.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ProductCard from "../components/ProductCard.jsx";
import Button from "../components/Button.jsx";
import { getProductById } from "../services/productService.js";
import { resolveImageUrl } from "../utils/constants.js";

const ProductDetails = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
            </div>

            <a href={`tel:${product.seller?.phone}`} style={{ display: "block" }}>
              <Button variant="primary" block disabled={isSold}>
                {isSold ? "Already Sold" : "Contact Seller"}
              </Button>
            </a>
          </div>
        </div>

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
