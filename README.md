

## 1. Project Overview

Every year, final-year students graduate and leave behind a pile of used but perfectly good items. Today that trade happens in chaotic WhatsApp groups: messages get buried, there's no search, no categories, no authentication, and no way to tell if something's already sold. CampusX replaces that with a dedicated, organized, and secure campus marketplace.

## 2. Problem Statement

- Messages in WhatsApp groups quickly get buried and are impossible to search.
- No categories, filters, or sorting exist.
- No authentication — anyone can post, no accountability.
- No structured product details (condition, price, images).
- Duplicate posts and stale listings pile up with no way to mark something sold.
- Buyers have no organized way to reach sellers.

## 3. Features

- **Authentication** — JWT-based register/login/logout with hashed passwords and protected routes.
- **Product CRUD** — Create, edit, delete, and mark listings as sold.
- **Search** — By product name, category, seller name, or department.
- **Filters** — Category, min/max price, condition, availability.
- **Sorting** — Newest, oldest, price low→high, price high→low.
- **Pagination** — On the product listing grid.
- **Image Uploads** — Multiple images per product via Multer, with live preview.
- **Profile Management** — Edit personal details, see products posted/sold.
- **Related Products** — Shown on each product detail page.
- **Responsive, theme-aware UI** — Light/dark mode, mobile/tablet/desktop layouts.
- **Toast Notifications, Loaders, Empty States, 404 Page** — Full UX coverage.

## 4. Technology Stack

**Frontend:** React 18, React Router DOM, Axios, Context API, Vite, react-hot-toast, react-icons
**Backend:** Node.js, Express.js
**Database:** MongoDB with Mongoose
**Auth:** JWT (httpOnly cookies) + bcrypt password hashing
**Other:** dotenv, cors, multer, express-validator, cookie-parser, helmet, morgan, nodemon

## 5. Folder Structure

```
CampusX/
├── backend/
│   ├── config/          # Database connection
│   ├── controllers/     # Route handler logic (auth, products)
│   ├── middleware/      # auth, upload, validate, errorHandler
│   ├── models/          # Mongoose schemas (User, Product)
│   ├── routes/          # Express routers
│   ├── uploads/          # Uploaded product images (served statically)
│   ├── utils/            # generateToken helper
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/  # Navbar, Footer, ProductCard, FilterSidebar, etc.
│   │   ├── pages/        # Landing, Login, Register, Browse, Details, Sell, Edit, MyProducts, Profile, 404
│   │   ├── layouts/       # MainLayout
│   │   ├── hooks/         # useAuth, useTheme
│   │   ├── context/       # AuthContext, ThemeContext
│   │   ├── services/      # api.js, authService.js, productService.js
│   │   ├── utils/         # constants.js
│   │   ├── styles/        # theme.css, global.css, navbar.css, productcard.css, landing.css, app.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
└── README.md
```

## 6. Installation Guide

### Prerequisites
- Node.js 18+
- A MongoDB instance (local, or a free MongoDB Atlas cluster)

### Backend Setup

```bash
cd backend
cp .env.example .env    # then fill in MONGO_URI and JWT_SECRET
npm install
npm run dev
```

The API starts on `http://localhost:5000` (or the `PORT` you set).

### Frontend Setup

```bash
cd frontend
cp .env.example .env    # defaults already point at localhost:5000
npm install
npm run dev
```

The app starts on `http://localhost:5173`.

## 7. Environment Variables

**backend/.env**
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/campusx
JWT_SECRET=replace_this_with_a_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

**frontend/.env**
```
VITE_API_BASE_URL=http://localhost:5000/api
```

## 8. API Documentation

### Authentication
| Method | Endpoint             | Access  | Description                  |
|--------|-----------------------|---------|-------------------------------|
| POST   | /api/auth/register     | Public  | Register a new student        |
| POST   | /api/auth/login        | Public  | Log in with email + password  |
| POST   | /api/auth/logout       | Private | Log out (clears auth cookie)  |
| GET    | /api/auth/profile      | Private | Get logged-in user's profile  |
| PUT    | /api/auth/profile      | Private | Update profile details        |

### Products
| Method | Endpoint                   | Access            | Description                                   |
|--------|------------------------------|-------------------|------------------------------------------------|
| GET    | /api/products                 | Public            | List products (search, filter, sort, paginate) |
| GET    | /api/products/:id             | Public            | Get one product + related products              |
| POST   | /api/products                 | Private           | Create a listing (multipart, up to 6 images)    |
| PUT    | /api/products/:id             | Private (owner)   | Update a listing                                 |
| DELETE | /api/products/:id             | Private (owner)   | Delete a listing                                 |
| PATCH  | /api/products/:id/sold        | Private (owner)   | Toggle Available/Sold status                     |
| GET    | /api/products/user/me         | Private           | Get the logged-in user's own listings + stats    |

**Query params for `GET /api/products`:** `search`, `category`, `minPrice`, `maxPrice`, `condition`, `status`, `sort` (`newest`|`oldest`|`price_low`|`price_high`), `page`, `limit`.

## 9. Security

- Passwords hashed with bcrypt before storage.
- JWTs stored in httpOnly, sameSite cookies (not accessible to client-side JS).
- Helmet for secure HTTP headers, CORS locked to the configured `CLIENT_URL`.
- express-validator on all auth and product-mutation routes.
- Ownership middleware ensures only a listing's creator can edit/delete/mark it sold.

## 10. Future Improvements

- In-app chat between buyer and seller instead of a phone-only contact button.
- Email verification on registration using the college domain.
- Wishlist / saved products.
- Admin moderation dashboard for reported listings.
- Image optimization/CDN storage (e.g. Cloudinary) instead of local disk storage.
- Push notifications when a saved search matches a new listing.

---

Built for students, by students. 🎓
