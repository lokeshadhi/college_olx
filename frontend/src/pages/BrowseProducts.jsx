import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import MainLayout from "../layouts/MainLayout.jsx";
import ProductCard from "../components/ProductCard.jsx";
import FilterSidebar from "../components/FilterSidebar.jsx";
import Pagination from "../components/Pagination.jsx";
import Loader from "../components/Loader.jsx";
import EmptyState from "../components/EmptyState.jsx";
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
      // Keep the page usable even if a request fails; the empty state covers it.
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
  };

  return (
    <MainLayout>
      <div className="container page-shell">
        <div className="page-head">
          <h1>Browse Products</h1>
          <p>Search and filter listings from students across your campus.</p>
        </div>

        <div className="search-sort-bar">
          <div className="search-box">
            <FiSearch />
            <input
              type="text"
              placeholder="Search products, categories, sellers, departments..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="sort-select"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="browse-layout">
          <FilterSidebar filters={filters} onChange={handleFilterChange} onReset={handleReset} />

          <div>
            <div className="browse-toolbar">
              <span className="browse-count">
                {loading ? "Loading..." : `${pagination.total} product${pagination.total === 1 ? "" : "s"} found`}
              </span>
            </div>

            {loading ? (
              <Loader />
            ) : products.length === 0 ? (
              <EmptyState
                title="No products match your search"
                message="Try adjusting your filters or search terms."
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
