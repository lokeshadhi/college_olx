import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { FiSun, FiMoon, FiMenu, FiX } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth.js";
import { useTheme } from "../hooks/useTheme.js";
import { useSocket } from "../hooks/useSocket.js";
import CampusLogo from "./CampusLogo.jsx";

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadTotal } = useSocket();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate("/");
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo" onClick={closeMenu} aria-label="CampusX Marketplace">
          <CampusLogo height={52} />
        </Link>

        <nav className={`navbar-links ${menuOpen ? "open" : ""}`}>
          <NavLink to="/" onClick={closeMenu} end>
            Home
          </NavLink>
          <NavLink to="/browse" onClick={closeMenu}>
            Browse Products
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/sell" onClick={closeMenu}>
              Sell Product
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink to="/my-products" onClick={closeMenu}>
              My Products
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink to="/my-transactions" onClick={closeMenu}>
              Transactions
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink to="/chat" onClick={closeMenu} style={{ position: "relative" }}>
              Messages
              {unreadTotal > 0 && (
                <span
                  style={{
                    background: "var(--color-coral, #D9634B)",
                    color: "#ffffff",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "999px",
                    marginLeft: "6px",
                  }}
                >
                  {unreadTotal}
                </span>
              )}
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink to="/profile" onClick={closeMenu}>
              Profile
            </NavLink>
          )}
          {!isAuthenticated && (
            <>
              <NavLink to="/login" onClick={closeMenu}>
                Login
              </NavLink>
              <NavLink to="/register" onClick={closeMenu}>
                Register
              </NavLink>
            </>
          )}
          {isAuthenticated && (
            <button className="nav-link" onClick={handleLogout}>
              Logout
            </button>
          )}
        </nav>

        <div className="navbar-actions">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle dark and light theme"
            title="Toggle theme"
          >
            {theme === "light" ? <FiMoon /> : <FiSun />}
          </button>

          {isAuthenticated && (
            <Link to="/profile" className="avatar-chip">
              <span className="avatar-circle">{user.name?.charAt(0)?.toUpperCase()}</span>
              {user.name?.split(" ")[0]}
            </Link>
          )}

          <button
            className="navbar-burger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
