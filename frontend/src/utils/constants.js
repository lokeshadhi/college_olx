export const CATEGORIES = [
  "Books",
  "Electronics",
  "Cycles",
  "Furniture",
  "Hostel Essentials",
  "Lab Equipment",
  "Calculators",
  "Sports",
  "Stationery",
  "Others",
];

export const CONDITIONS = ["New", "Like New", "Good", "Fair", "Old"];

export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Final Year"];

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
];

// Resolves a product image path returned by the API (e.g. "/uploads/x.jpg")
// into a full URL the <img> tag can load, using the API's origin.
export const resolveImageUrl = (path) => {
  if (!path) return "https://placehold.co/600x450?text=CampusX";
  if (path.startsWith("http")) return path;
  const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
  const origin = base.replace(/\/api\/?$/, "");
  return `${origin}${path}`;
};
