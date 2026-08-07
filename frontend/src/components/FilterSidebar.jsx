import { CATEGORIES, CONDITIONS } from "../utils/constants.js";

// Controlled filter panel for the Browse page: category, price range, and
// condition. `filters` and `onChange` are lifted to the parent so the query
// string / API call stays in sync with what's shown.
const FilterSidebar = ({ filters, onChange, onReset }) => {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <aside className="filter-sidebar">
      <h3>Filters</h3>

      <div className="filter-group">
        <label className="filter-title">Category</label>
        <div className="filter-chip-list">
          <button
            className={`filter-chip ${!filters.category ? "active" : ""}`}
            onClick={() => update("category", "")}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`filter-chip ${filters.category === cat ? "active" : ""}`}
              onClick={() => update("category", cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <label className="filter-title">Price Range (₹)</label>
        <div className="filter-price-row">
          <input
            type="number"
            min="0"
            placeholder="Min"
            value={filters.minPrice}
            onChange={(e) => update("minPrice", e.target.value)}
          />
          <input
            type="number"
            min="0"
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(e) => update("maxPrice", e.target.value)}
          />
        </div>
      </div>

      <div className="filter-group">
        <label className="filter-title">Condition</label>
        <div className="filter-chip-list">
          <button
            className={`filter-chip ${!filters.condition ? "active" : ""}`}
            onClick={() => update("condition", "")}
          >
            Any
          </button>
          {CONDITIONS.map((c) => (
            <button
              key={c}
              className={`filter-chip ${filters.condition === c ? "active" : ""}`}
              onClick={() => update("condition", c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-ghost btn-sm" onClick={onReset}>
        Clear all filters
      </button>
    </aside>
  );
};

export default FilterSidebar;
