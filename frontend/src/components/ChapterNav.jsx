import { Link } from "react-router-dom";
import {
  FiBookOpen,
  FiCpu,
  FiHome,
  FiTool,
  FiGrid,
  FiActivity,
  FiEdit3,
} from "react-icons/fi";
import {
  MdDirectionsBike,
  MdCalculate,
} from "react-icons/md";

const CHAPTER_ITEMS = [
  { label: "Cycles", category: "Cycles", icon: MdDirectionsBike, isNew: true },
  { label: "Electronics", category: "Electronics", icon: FiCpu, isNew: true },
  { label: "Books", category: "Books", icon: FiBookOpen, isNew: false },
  { label: "Hostel Gear", category: "Hostel Essentials", icon: FiHome, isNew: false },
  { label: "Calculators", category: "Calculators", icon: MdCalculate, isNew: false },
  { label: "Lab Equip", category: "Lab Equipment", icon: FiTool, isNew: false },
  { label: "Sports", category: "Sports", icon: FiActivity, isNew: false },
  { label: "Stationery", category: "Stationery", icon: FiEdit3, isNew: false },
  { label: "All Items", category: "", icon: FiGrid, isNew: false },
];

const ChapterNav = ({ activeCategory, onSelectCategory }) => {
  return (
    <nav className="chapter-nav-wrapper" aria-label="Campus Categories">
      <div className="container chapter-nav-container">
        <ul className="chapter-nav-list">
          {CHAPTER_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeCategory !== undefined &&
              (activeCategory === item.category || (!activeCategory && !item.category));

            const content = (
              <>
                <div className="chapter-nav-icon-box">
                  <Icon className="chapter-nav-icon" />
                </div>
                <span className="chapter-nav-label">{item.label}</span>
                {item.isNew && <span className="chapter-nav-new-badge">New</span>}
              </>
            );

            if (onSelectCategory) {
              return (
                <li key={item.label} className="chapter-nav-item">
                  <button
                    type="button"
                    onClick={() => onSelectCategory(item.category)}
                    className={`chapter-nav-link ${isActive ? "active" : ""}`}
                  >
                    {content}
                  </button>
                </li>
              );
            }

            const targetUrl = item.category
              ? `/browse?category=${encodeURIComponent(item.category)}`
              : `/browse`;

            return (
              <li key={item.label} className="chapter-nav-item">
                <Link
                  to={targetUrl}
                  className={`chapter-nav-link ${isActive ? "active" : ""}`}
                >
                  {content}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default ChapterNav;
