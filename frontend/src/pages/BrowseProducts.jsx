import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiSearch, FiFilter, FiX } from "react-icons/fi";
import MainLayout from "../layouts/MainLayout.jsx";
import ProductCard from "../components/ProductCard.jsx";
import FilterSidebar from "../components/FilterSidebar.jsx";
import Pagination from "../components/Pagination.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ChapterNav from "../components/ChapterNav.jsx";
import { getProducts } from "../services/productService.js";
import { SORT_OPTIONS } from "../utils/constants.js";

const DEFAULT_FILTERS = { category: "", minPrice: "", maxPrice: "", condition: "" };

const BrowseProducts = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [filters, setFilters] = useState({
    category: searchParams.get("category") || "",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    condition: searchParams.get("condition") || "",
  });
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        search: search || undefined,
        category: filters.category || undefined,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        condition: filters.condition || undefined,
        sort,
        page,
        limit: 12,
      };
      const res = await getProducts(params);
      setProducts(res.data);
      setPagination(res.pagination);
    } catch (error) {
      // Keep page usable even if request fails
    } finally {
      setLoading(false);
    }
  }, [search, filters, sort, page]);

  useEffect(() => {
    fetchProducts();
    const params = {};
    if (search) params.search = search;
    if (filters.category) params.category = filters.category;
    if (filters.minPrice) params.minPrice = filters.minPrice;
    if (filters.maxPrice) params.maxPrice = filters.maxPrice;
    if (filters.condition) params.condition = filters.condition;
    if (sort !== "newest") params.sort = sort;
    if (page !== 1) params.page = page;
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters, sort, page]);

  const handleFilterChange = (next) => {
    setFilters(next);
    setPage(1);
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setSearch("");
    setPage(1);
    setMobileFiltersOpen(false);
  };

  const activeFilterCount =
    (filters.category ? 1 : 0) +
    (filters.condition ? 1 : 0) +
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0);

  return (
    <MainLayout>
      <ChapterNav
        activeCategory={filters.category}
        onSelectCategory={(cat) => {
          setFilters((prev) => ({ ...prev, category: cat }));
          setPage(1);
        }}
      />
      <div className="container page-shell">
        <div className="page-head">
          <h1>Browse Campus Listings</h1>
          <p>Search textbooks, electronics, cycles, and student essentials listed by NIT Kurukshetra peers.</p>
        </div>

        <div className="search-sort-bar">
          <div className="search-box">
            <FiSearch size={18} style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              placeholder="Search products, categories, sellers, departments..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}
                aria-label="Clear search"
              >
                <FiX size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-outline"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            aria-label="Toggle filters"
          >
            <FiFilter size={16} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  background: "var(--color-brand-accent)",
                  color: "#FFFFFF",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: "999px",
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          <select
            className="sort-select"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            aria-label="Sort products"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="browse-layout">
          {/* Desktop Filter Sidebar / Mobile Drawer */}
          <div className={mobileFiltersOpen ? "filter-sidebar-open" : "filter-sidebar-desktop"}>
            <FilterSidebar
              filters={filters}
              onChange={handleFilterChange}
              onReset={handleReset}
            />
          </div>

          <div>
            <div className="browse-toolbar">
              <span className="browse-count">
                {loading
                  ? "Searching campus listings..."
                  : `${pagination.total} listing${pagination.total === 1 ? "" : "s"} found`}
              </span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleReset}
                  style={{ color: "var(--color-danger)" }}
                >
                  Clear all filters ({activeFilterCount})
                </button>
              )}
            </div>

            {loading ? (
              <div className="product-grid">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div key={idx} className="product-card" style={{ padding: "0" }}>
                    <div className="skeleton" style={{ aspectRatio: "4/3", width: "100%" }} />
                    <div style={{ padding: "14px 16px" }}>
                      <div className="skeleton" style={{ height: "12px", width: "40%", marginBottom: "8px" }} />
                      <div className="skeleton" style={{ height: "16px", width: "85%", marginBottom: "12px" }} />
                      <div className="skeleton" style={{ height: "22px", width: "35%", marginBottom: "12px" }} />
                      <div className="skeleton" style={{ height: "14px", width: "60%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <EmptyState
                title="No listings match your search"
                message="Try clearing your filters, adjusting price limits, or searching different terms."
                action={
                  <button className="btn btn-outline btn-sm" onClick={handleReset}>
                    Clear Filters
                  </button>
                }
              />
            ) : (
              <>
                <div className="product-grid">
                  {products.map((p) => (
                    <ProductCard key={p._id} product={p} />
                  ))}
                </div>
                <Pagination page={pagination.page} pages={pagination.pages} onChange={setPage} />
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default BrowseProducts;
