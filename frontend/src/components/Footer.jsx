import { Link } from "react-router-dom";
import { CATEGORIES } from "../utils/constants.js";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col footer-brand">
            <h4>CampusX</h4>
            <p>
              A dedicated marketplace for students to buy and sell second-hand books,
              electronics, and hostel essentials — inside your own campus.
            </p>
          </div>
          <div className="footer-col">
            <h4>Explore</h4>
            <Link to="/browse">Browse Products</Link>
            <Link to="/sell">Sell a Product</Link>
            <Link to="/my-products">My Products</Link>
          </div>
          <div className="footer-col">
            <h4>Categories</h4>
            {CATEGORIES.slice(0, 4).map((cat) => (
              <Link key={cat} to={`/browse?category=${encodeURIComponent(cat)}`}>
                {cat}
              </Link>
            ))}
          </div>
          <div className="footer-col">
            <h4>Account</h4>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
            <Link to="/profile">Profile</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; {year} CampusX. Built for students, by students.</span>
          <span>Buy. Sell. Save. Inside Your Campus.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
