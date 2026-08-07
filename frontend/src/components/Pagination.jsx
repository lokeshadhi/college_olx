// Renders numbered page buttons plus prev/next. Keeps things simple by
// showing every page — fine for a campus-scale marketplace's result counts.
const Pagination = ({ page, pages, onChange }) => {
  if (pages <= 1) return null;

  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1);

  return (
    <div className="pagination">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        ‹
      </button>
      {pageNumbers.map((num) => (
        <button
          key={num}
          className={num === page ? "active" : ""}
          onClick={() => onChange(num)}
        >
          {num}
        </button>
      ))}
      <button onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page">
        ›
      </button>
    </div>
  );
};

export default Pagination;
