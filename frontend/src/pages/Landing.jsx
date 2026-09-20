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

import ChapterNav from "../components/ChapterNav.jsx";

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
      {/* Apple Page Title & Search */}
      <section className="apple-header-section">
        <div className="container">
          <h1 className="apple-title-main">CampusX</h1>
          <p className="apple-subtitle-main">
            The verified peer marketplace built for NIT Kurukshetra students.
          </p>

          <div className="apple-search-container">
            <SearchBar
              value={search}
              onChange={setSearch}
              onSubmit={handleSearch}
              placeholder="Search cycles, calculators, books, hostel gear..."
            />
          </div>
        </div>
      </section>

      {/* Apple Horizontal Chapter Nav (As seen in Apple iPhone line page) */}
      <ChapterNav />

      {/* Apple Bento Showcase Hero Card ("iPhone Duo" Style) */}
      <div className="container">
        <div className="apple-showcase-card">
          <div className="apple-showcase-inner">
            <div>
              <span
                style={{
                  color: "var(--color-brand-accent)",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Campus Life Made Simple
              </span>
              <h2 className="apple-showcase-title">Campus Essentials.</h2>
              <p className="apple-showcase-subtitle">
                Hello, semester. Buy cycles, textbooks, calculators, and lab gear directly from peers graduating or moving hostels.
              </p>
              <div className="apple-showcase-ctas">
                <Button variant="primary" onClick={() => navigate("/browse")}>
                  Explore Store
                </Button>
                <button
                  type="button"
                  className="link-apple"
                  onClick={() => navigate("/sell")}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  Sell an item
                </button>
              </div>
            </div>

            <div>
              <div className="hero-product-preview-card">
                <div className="hpp-badge">
                  <FiShield /> Verified NITKKR Listing
                </div>
                <div className="hpp-item-title">Casio FX-991CW Scientific Calculator</div>
                <div className="hpp-item-dept">Listed by 3rd Year • Mechanical Engg</div>

                <div className="hpp-details-grid">
                  <div className="hpp-row">
                    <span className="label">Condition</span>
                    <span className="value">Like New (1 Sem used)</span>
                  </div>
                  <div className="hpp-row">
                    <span className="label">Meetup Point</span>
                    <span className="value">Central Library / SAC</span>
                  </div>
                  <div className="hpp-row">
                    <span className="label">Encrypted Chat</span>
                    <span className="value" style={{ color: "var(--color-success)" }}>
                      Active
                    </span>
                  </div>
                </div>

                <div className="hpp-price-banner">
                  <div>
                    <span style={{ fontSize: "0.74rem", color: "var(--color-text-muted)" }}>Asking Price</span>
                    <div className="hpp-price-val">₹950</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate("/browse")}
                  >
                    View Deal
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="container">
        <div className="stats-strip">
          <div className="stat-item">
            <div className="stat-num">{stats.total || "500+"}</div>
            <div className="stat-label">Active Campus Listings</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">10</div>
            <div className="stat-label">Student Categories</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">100%</div>
            <div className="stat-label">Student-Verified Profiles</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">₹0</div>
            <div className="stat-label">Commission or Platform Fees</div>
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

      {/* Apple 2x2 Bento Feature Grid ("Get to know CampusX") */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="section-eyebrow">Exclusively for NIT Kurukshetra</span>
            <h2>Get to know CampusX.</h2>
          </div>

          <div className="apple-bento-grid">
            <div className="apple-bento-card">
              <div>
                <span className="bento-tag">100% Student Verified</span>
                <h3>Only @nitkkr.ac.in emails.</h3>
                <p>
                  No external dealers, brokers, or spam accounts. Every buyer and seller is an authenticated peer student on campus.
                </p>
              </div>
            </div>

            <div className="apple-bento-card">
              <div>
                <span className="bento-tag">End-to-End Encrypted</span>
                <h3>Private, hardware-grade chat.</h3>
                <p>
                  Built directly with Web Crypto API RSA-OAEP and AES-GCM cryptography. Your negotiations and private contacts remain exclusively between you and the seller.
                </p>
              </div>
            </div>

            <div className="apple-bento-card">
              <div>
                <span className="bento-tag">In-Person Campus Meetups</span>
                <h3>Safe handovers inside campus.</h3>
                <p>
                  Inspect bicycles, textbooks, and electronics in daylight at Central Library, Student Activity Centre (SAC), or hostel gates before paying.
                </p>
              </div>
            </div>

            <div className="apple-bento-card">
              <div>
                <span className="bento-tag">Zero Platform Fees</span>
                <h3>Fair peer-to-peer student pricing.</h3>
                <p>
                  Keep 100% of what you make. No commission cuts, no listing fees, and instant in-person UPI settlements.
                </p>
              </div>
            </div>
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
