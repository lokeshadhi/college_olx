import { Link } from "react-router-dom";
import { FiShield } from "react-icons/fi";
import { CATEGORIES } from "../utils/constants.js";
import CampusLogo from "./CampusLogo.jsx";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col footer-brand">
            <div className="footer-logo">
              <CampusLogo height={48} />
            </div>
            <p>
              The verified peer-to-peer campus marketplace for NIT Kurukshetra students.
              Buy and sell textbooks, electronics, bicycles, and hostel room essentials directly with fellow students.
            </p>
            <div className="footer-campus-badge">
              <FiShield size={16} />
              <span>NIT Kurukshetra Student Network Only</span>
            </div>
          </div>

          <div className="footer-col">
            <h4>Marketplace</h4>
            <Link to="/browse">Browse All Listings</Link>
            <Link to="/sell">Sell an Item</Link>
            <Link to="/my-products">My Listings</Link>
            <Link to="/my-transactions">Transactions & Bids</Link>
          </div>

          <div className="footer-col">
            <h4>Categories</h4>
            {CATEGORIES.slice(0, 5).map((cat) => (
              <Link key={cat} to={`/browse?category=${encodeURIComponent(cat)}`}>
                {cat}
              </Link>
            ))}
          </div>

          <div className="footer-col">
            <h4>Safety & Campus</h4>
            <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", display: "block", marginBottom: "8px" }}>
              Recommended Meetup Points:
            </span>
            <div style={{ fontSize: "0.82rem", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
              • Central Library Forecourt<br />
              • Student Activity Centre (SAC)<br />
              • Hostel Security Checkpoints
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; {currentYear} CampusX. Exclusively for NIT Kurukshetra Students.</span>
          <span>Zero Commission • Verified Hand-to-Hand Deals</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
