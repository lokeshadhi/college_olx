import { FiSearch } from "react-icons/fi";

// Controlled search input used on both the landing hero and the browse page.
// Submits on Enter or the search icon click.
const SearchBar = ({ value, onChange, onSubmit, placeholder = "Search products, categories, sellers...", variant = "hero" }) => {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") onSubmit?.(value);
  };

  return (
    <div className={variant === "hero" ? "hero-search" : "search-box"}>
      <FiSearch />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Search products"
      />
      {variant === "hero" && (
        <button className="btn btn-primary btn-sm" onClick={() => onSubmit?.(value)}>
          Search
        </button>
      )}
    </div>
  );
};

export default SearchBar;
