import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FiEdit2, FiTrash2, FiCheckCircle, FiPackage } from "react-icons/fi";
import MainLayout from "../layouts/MainLayout.jsx";
import Loader from "../components/Loader.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Button from "../components/Button.jsx";
import Modal from "../components/Modal.jsx";
import { getMyProducts, deleteProduct, toggleSold } from "../services/productService.js";
import { resolveImageUrl } from "../utils/constants.js";

const MyProducts = () => {
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({ postedCount: 0, soldCount: 0 });
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMyProducts();
      setProducts(res.data);
      setStats(res.stats);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggleSold = async (id) => {
    try {
      await toggleSold(id);
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProduct(confirmDeleteId);
      toast.success("Product deleted");
      setConfirmDeleteId(null);
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <MainLayout>
      <div className="container page-shell">
        <div className="page-head">
          <h1>My Products</h1>
          <p>
            {stats.postedCount} posted · {stats.soldCount} sold
          </p>
        </div>

        {loading ? (
          <Loader />
        ) : products.length === 0 ? (
          <EmptyState
            icon={FiPackage}
            title="You haven't listed anything yet"
            message="List your first product and reach students on your campus."
            action={
              <Link to="/sell">
                <Button variant="primary">Sell a Product</Button>
              </Link>
            }
          />
        ) : (
          <div className="my-products-list">
            {products.map((p) => (
              <div className="mp-row" key={p._id}>
                <img src={resolveImageUrl(p.images?.[0])} alt={p.title} />
                <div className="mp-info">
                  <h4>{p.title}</h4>
                  <div className="mp-meta">
                    ₹{Number(p.price).toLocaleString("en-IN")} · {p.category} ·{" "}
                    <span className={`badge ${p.status === "Sold" ? "badge-sold" : "badge-available"}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
                <div className="mp-actions">
                  <Link to={`/products/${p._id}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                  <Link to={`/products/${p._id}/edit`}>
                    <Button variant="outline" size="sm">
                      <FiEdit2 /> Edit
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={() => handleToggleSold(p._id)}>
                    <FiCheckCircle /> {p.status === "Sold" ? "Mark Available" : "Mark Sold"}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmDeleteId(p._id)}>
                    <FiTrash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!confirmDeleteId} title="Delete this product?" onClose={() => setConfirmDeleteId(null)}>
        <p style={{ marginBottom: 20 }}>
          This action cannot be undone. The listing will be permanently removed.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="outline" block onClick={() => setConfirmDeleteId(null)}>
            Cancel
          </Button>
          <Button variant="danger" block onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </MainLayout>
  );
};

export default MyProducts;
