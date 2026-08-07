import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiShield, FiSearch, FiUsers, FiTrendingUp, FiTag } from "react-icons/fi";
import MainLayout from "../layouts/MainLayout.jsx";
import SearchBar from "../components/SearchBar.jsx";
import CategoryCard from "../components/CategoryCard.jsx";
import ProductCard from "../components/ProductCard.jsx";
import Loader from "../components/Loader.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Button from "../components/Button.jsx";
import { getProducts } from "../services/productService.js";
import { CATEGORIES } from "../utils/constants.js";

const WHY_CAMPUSX = [
  {
    icon: FiShield,
    title: "Verified Campus Only",
    text: "Every listing comes from a fellow student — no strangers, no spam, no scams.",
  },
  {
    icon: FiSearch,
    title: "Actually Searchable",
    text: "Filter by category, price, and condition instead of scrolling a buried WhatsApp thread.",
  },
  {
    icon: FiTag,
    title: "Clear Product Details",
    text: "Photos, condition, price, and seller info — everything you need before you message.",
  },
];

const STEPS = [
  { title: "Create your account", text: "Sign up with your college email in under a minute." },
  { title: "List or browse", text: "Post what you're selling, or search what you need." },
  { title: "Connect with the seller", text: "Reach out directly using their listed contact." },
  { title: "Meet, pay, done", text: "Mark it sold once the handover is complete." },
];

const TESTIMONIALS = [
  { name: "Ananya R.", role: "Final Year, CSE", quote: "Sold my old lab kit and calculator in two days — way faster than the WhatsApp group ever was." },
  { name: "Rohit V.", role: "3rd Year, Mechanical", quote: "Found a cycle for half the showroom price, listed by a senior who was graduating." },
  { name: "Meera S.", role: "2nd Year, ECE", quote: "Finally a place where I can actually filter by price instead of scrolling forever." },
];

const Landing = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [latest, setLatest] = useState([]);
  const [popular, setPopular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [latestRes, popularRes] = await Promise.all([
          getProducts({ limit: 4, sort: "newest" }),
          getProducts({ limit: 4, sort: "oldest" }),
        ]);
        setLatest(latestRes.data);
        setPopular(popularRes.data);
        setStats({ total: latestRes.pagination?.total || 0 });
      } catch (error) {
        // Landing page should still render even if the API is briefly unavailable.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSearch = (value) => {
    navigate(`/browse${value ? `?search=${encodeURIComponent(value)}` : ""}`);
  };

  return (
    <MainLayout>
      {/* Hero */}
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="hero-eyebrow">The campus-only marketplace</span>
            <h1>
              Buy. Sell. Save. <em>Inside Your Campus.</em>
            </h1>
            <p className="lead">
              Skip the buried WhatsApp threads. CampusX is where students list books,
              electronics, cycles, and hostel essentials — organized, searchable, and
              only ever a message away from a fellow student.
            </p>
            <div className="hero-actions">
              <Button variant="primary" onClick={() => navigate("/sell")}>
                Sell a Product
              </Button>
              <Button variant="outline" onClick={() => navigate("/browse")}>
                Browse Products
              </Button>
            </div>
            <SearchBar value={search} onChange={setSearch} onSubmit={handleSearch} />
          </div>

          <div className="hero-visual">
            <div className="hero-stamp-card">
              <div className="hsc-row">
                <span className="hsc-label">Category</span>
                <span className="hsc-value">Electronics</span>
              </div>
              <div className="hsc-row">
                <span className="hsc-label">Condition</span>
                <span className="hsc-value">Like New</span>
              </div>
              <div className="hsc-row">
                <span className="hsc-label">Price</span>
                <span className="hsc-value">₹3,200</span>
              </div>
              <div className="hsc-row">
                <span className="hsc-label">Seller</span>
                <span className="hsc-value">Final Year, ECE</span>
              </div>
            </div>
            <div className="hero-stamp-badge">CAMPUS VERIFIED</div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="container">
        <div className="stats-strip">
          <div className="stat-item">
            <div className="stat-num">{stats.total || "500+"}</div>
            <div className="stat-label">Active Listings</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">10</div>
            <div className="stat-label">Categories</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">1,200+</div>
            <div className="stat-label">Students Joined</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">Zero</div>
            <div className="stat-label">Listing Fees</div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">Categories</span>
            <h2>Find exactly what you need</h2>
          </div>
          <div className="category-grid">
            {CATEGORIES.map((cat) => (
              <CategoryCard key={cat} name={cat} />
            ))}
          </div>
        </div>
      </section>

      {/* Latest products */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">Fresh listings</span>
            <h2>Latest Products</h2>
          </div>
          {loading ? (
            <Loader />
          ) : latest.length === 0 ? (
            <EmptyState title="No listings yet" message="Be the first to list something on CampusX." />
          ) : (
            <div className="product-grid">
              {latest.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Popular products */}
      {popular.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <span className="section-eyebrow">Worth a look</span>
              <h2>Popular Products</h2>
            </div>
            <div className="product-grid">
              {popular.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Why CampusX */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">Why CampusX</span>
            <h2>Built to fix what WhatsApp groups can't</h2>
          </div>
          <div className="why-grid">
            {WHY_CAMPUSX.map(({ icon: Icon, title, text }) => (
              <div className="why-card" key={title}>
                <div className="why-icon">
                  <Icon />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">How it works</span>
            <h2>From listing to handover in four steps</h2>
          </div>
          <div className="steps-row">
            {STEPS.map((step, i) => (
              <div className="step-item" key={step.title}>
                <div className="step-num">{i + 1}</div>
                <h4>{step.title}</h4>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">From students</span>
            <h2>What CampusX users are saying</h2>
          </div>
          <div className="testimonial-grid">
            {TESTIMONIALS.map((t) => (
              <div className="testimonial-card" key={t.name}>
                <p className="quote">"{t.quote}"</p>
                <div className="testimonial-person">
                  <div className="testimonial-avatar">{t.name.charAt(0)}</div>
                  <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container">
          <div className="cta-banner">
            <FiUsers size={28} />
            <h2>Ready to clear out your hostel room?</h2>
            <p>List your first product in under two minutes — it's free.</p>
            <Button variant="primary" onClick={() => navigate("/sell")}>
              <FiTrendingUp /> Start Selling
            </Button>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default Landing;
