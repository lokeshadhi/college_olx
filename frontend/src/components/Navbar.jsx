import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  FiSun,
  FiMoon,
  FiMenu,
  FiX,
  FiMessageSquare,
  FiPlus,
  FiUser,
  FiPackage,
  FiRepeat,
  FiLogOut,
  FiChevronDown,
  FiSearch,
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth.js";
import { useTheme } from "../hooks/useTheme.js";
import { useSocket } from "../hooks/useSocket.js";
import CampusLogo from "./CampusLogo.jsx";

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadTotal } = useSocket();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    setDropdownOpen(false);
    setDrawerOpen(false);
    await logout();
    navigate("/");
  };

  const closeAll = () => {
    setDrawerOpen(false);
    setDropdownOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [dropdownOpen]);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (drawerOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [drawerOpen]);

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <div className="navbar-left">
          <Link to="/" className="navbar-logo" onClick={closeAll} aria-label="CampusX Home">
            <CampusLogo height={50} />
          </Link>

          <nav className="navbar-links">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/browse">
              <FiSearch size={15} /> Browse
            </NavLink>
          </nav>
        </div>

        <div className="navbar-actions">
          {isAuthenticated && (
            <Link to="/sell" className="btn-sell-nav" onClick={closeAll}>
              <FiPlus size={16} />
              <span>Sell Item</span>
            </Link>
          )}

          {isAuthenticated && (
            <Link
              to="/chat"
              className="nav-messages-btn"
              onClick={closeAll}
              title="Messages"
              aria-label="Messages"
            >
              <FiMessageSquare />
              {unreadTotal > 0 && (
                <span className="nav-badge-pill">{unreadTotal > 9 ? "9+" : unreadTotal}</span>
              )}
            </Link>
          )}

          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle dark and light theme"
            title="Toggle theme"
          >
            {theme === "light" ? <FiMoon /> : <FiSun />}
          </button>

          {isAuthenticated ? (
            <div className="nav-user-container" ref={dropdownRef}>
              <button
                className="avatar-chip"
                onClick={() => {
                  if (typeof window !== "undefined" && window.innerWidth <= 768) {
                    setDrawerOpen((prev) => !prev);
                  } else {
                    setDropdownOpen((prev) => !prev);
                  }
                }}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <span className="avatar-circle">
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} />
                  ) : (
                    user.name?.charAt(0)?.toUpperCase()
                  )}
                </span>
                <span className="avatar-name">{user.name?.split(" ")[0]}</span>
                <FiChevronDown
                  size={14}
                  className="avatar-chevron"
                  style={{
                    transform: dropdownOpen ? "rotate(180deg)" : "none",
                    transition: "transform 150ms ease",
                  }}
                />
              </button>

              {dropdownOpen && (
                <div className="nav-dropdown">
                  <div className="nav-dropdown-header">
                    <div className="nav-dropdown-name">{user.name}</div>
                    <div className="nav-dropdown-email">{user.email}</div>
                  </div>

                  <Link to="/profile" onClick={closeAll}>
                    <FiUser size={15} /> My Profile & Reputation
                  </Link>
                  <Link to="/my-products" onClick={closeAll}>
                    <FiPackage size={15} /> My Listings
                  </Link>
                  <Link to="/my-transactions" onClick={closeAll}>
                    <FiRepeat size={15} /> Transactions & Bids
                  </Link>

                  <div className="nav-dropdown-divider" />

                  <button className="nav-dropdown-logout" onClick={handleLogout}>
                    <FiLogOut size={15} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="navbar-links">
              <NavLink to="/login" className="btn btn-outline btn-sm">
                Log In
              </NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm">
                Sign Up
              </NavLink>
            </div>
          )}

          <button
            className="navbar-burger"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-label="Toggle Navigation Menu"
          >
            {drawerOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {/* Apple-style Sub-nav Announcement Ribbon */}
      <div className="apple-announcement-ribbon">
        <div className="container announcement-inner">
          <span>
            NIT Kurukshetra Student Network: Verified campus access, 0% platform fees, and safe in-person meetups.
          </span>
          <Link to="/browse" className="announcement-link" onClick={closeAll}>
            Explore listings
          </Link>
        </div>
      </div>

      {/* Mobile Drawer portaled directly to document.body to avoid backdrop-filter/sticky clipping */}
      {drawerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="mobile-overlay" onClick={closeAll} />
            <aside className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
              <div className="mobile-drawer-header">
                <CampusLogo height={38} />
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    className="theme-toggle"
                    onClick={toggleTheme}
                    aria-label="Toggle dark and light theme"
                    title="Toggle theme"
                    style={{ width: "34px", height: "34px" }}
                  >
                    {theme === "light" ? <FiMoon size={16} /> : <FiSun size={16} />}
                  </button>
                  <button
                    onClick={closeAll}
                    className="mobile-drawer-close-btn"
                    aria-label="Close menu"
                  >
                    <FiX size={22} />
                  </button>
                </div>
              </div>

              {isAuthenticated && user && (
                <div className="mobile-drawer-user">
                  <span className="avatar-circle">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt={user.name} />
                    ) : (
                      user.name?.charAt(0)?.toUpperCase()
                    )}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="mobile-drawer-name">{user.name}</div>
                    <div className="mobile-drawer-email">{user.email}</div>
                  </div>
                </div>
              )}

              <nav className="mobile-nav-links">
                <NavLink to="/" onClick={closeAll} end>
                  Home
                </NavLink>
                <NavLink to="/browse" onClick={closeAll}>
                  <FiSearch size={16} /> Browse Marketplace
                </NavLink>

                {isAuthenticated ? (
                  <>
                    <NavLink to="/sell" onClick={closeAll} style={{ color: "var(--color-brand-accent)", fontWeight: 700 }}>
                      <FiPlus size={16} /> Post Listing
                    </NavLink>
                    <NavLink to="/chat" onClick={closeAll}>
                      <FiMessageSquare size={16} />
                      Messages
                      {unreadTotal > 0 && (
                        <span className="nav-badge-pill" style={{ position: "static", marginLeft: "auto" }}>
                          {unreadTotal > 9 ? "9+" : unreadTotal}
                        </span>
                      )}
                    </NavLink>
                    <NavLink to="/my-products" onClick={closeAll}>
                      <FiPackage size={16} /> My Listings
                    </NavLink>
                    <NavLink to="/my-transactions" onClick={closeAll}>
                      <FiRepeat size={16} /> Transactions & Bids
                    </NavLink>
                    <NavLink to="/profile" onClick={closeAll}>
                      <FiUser size={16} /> Student Profile & Reputation
                    </NavLink>
                    <div className="nav-dropdown-divider" style={{ margin: "12px 0" }} />
                    <button onClick={handleLogout} style={{ color: "var(--color-danger)", width: "100%", textAlign: "left" }}>
                      <FiLogOut size={16} /> Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <div className="nav-dropdown-divider" style={{ margin: "12px 0" }} />
                    <NavLink to="/login" onClick={closeAll}>
                      Log In
                    </NavLink>
                    <NavLink to="/register" onClick={closeAll} style={{ color: "var(--color-brand-accent)", fontWeight: 700 }}>
                      Sign Up with College Email
                    </NavLink>
                  </>
                )}
              </nav>
            </aside>
          </>,
          document.body
        )}
    </header>
  );
};

export default Navbar;
