import { Link } from "react-router-dom";
import {
  FiBook,
  FiCpu,
  FiWind,
  FiHome,
  FiCoffee,
  FiTool,
  FiHash,
  FiActivity,
  FiEdit3,
  FiGrid,
} from "react-icons/fi";

const ICONS = {
  Books: FiBook,
  Electronics: FiCpu,
  Cycles: FiWind,
  Furniture: FiHome,
  "Hostel Essentials": FiCoffee,
  "Lab Equipment": FiTool,
  Calculators: FiHash,
  Sports: FiActivity,
  Stationery: FiEdit3,
  Others: FiGrid,
};

const CategoryCard = ({ name }) => {
  const Icon = ICONS[name] || FiGrid;

  return (
    <Link to={`/browse?category=${encodeURIComponent(name)}`} className="category-card">
      <div className="cat-icon">
        <Icon />
      </div>
      <div className="cat-name">{name}</div>
    </Link>
  );
};

export default CategoryCard;
