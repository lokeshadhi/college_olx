# CampusX — College Campus Marketplace

A full-stack MERN marketplace built specifically for university students to safely buy and sell second-hand textbooks, calculators, cycles, electronics, and hostel essentials within their campus community.

---

## 1. Project Overview

Every year, graduating students leave behind valuable textbooks, calculators, bicycles, and appliances. Historically, this trading happened in unstructured WhatsApp groups: posts were quickly buried, duplicates piled up, search was nonexistent, and buyers had no way to verify if items were still available. 

CampusX provides an organized, verified campus marketplace with real-time messaging, college student verification, order tracking, and peer reviews.

---

## 2. Key Features

- **🎓 Verified Student Authentication** — Strict institutional email verification (`@nitkkr.ac.in`) with cryptographic 6-digit OTP verification and account lockout protection.
- **🛍️ Product CRUD & Filtering** — Create, edit, browse, search, and delete listings with Cloudinary-backed multi-photo uploads.
- **💬 Real-Time Campus Chat** — Instant messaging powered by Socket.IO with typing indicators, photo attachments, and unread counters.
- **🤝 Deal Transactions & Order Tracking** — Structured purchase flow where buyers send bid offers, sellers accept/reject, and deal history is preserved.
- **⭐ Two-Way Peer Ratings & Reviews** — Verified buyers rate sellers and sellers rate buyers upon deal completion, recalculating campus trust scores.
- **🛡️ Multi-Layer Security** — JWT stored in `httpOnly` secure cookies, bcrypt password hashing, rate limiting, and NoSQL/XSS sanitization.
- **🎨 Responsive Theme-Aware UI** — Dark and light themes using CSS design tokens with sharp, optimized contrast branding.
- **🧪 Automated Test Suite** — Comprehensive unit and integration test suites for authentication, transactions, chat, and security.

---

## 3. Technology Stack

- **Frontend:** React 18, Vite, React Router DOM v6, Axios, Context API, react-hot-toast, react-icons (Feather & Heroicons v2).
- **Backend:** Node.js (ES modules), Express.js 4.19, Mongoose 8.5.
- **Real-Time Communication:** Socket.IO 4.8.
- **Database:** MongoDB with Mongoose.
- **Authentication & Security:** JWT (`httpOnly`, `sameSite: lax` cookies), bcryptjs, Helmet, Express Rate Limit, isomorphic-dompurify.
- **File Handling & Cloud Storage:** Multer and Cloudinary.
- **Email Service:** Nodemailer with SMTP transport.

---

## 4. Folder Structure

```
CampusX/
├── backend/
│   ├── config/
│   │   ├── db.js                 # MongoDB connection
│   │   └── cloudinary.js         # Cloudinary SDK setup
│   ├── controllers/
│   │   ├── authController.js     # User registration, login, profile, OTP verification
│   │   ├── productController.js  # Product listing CRUD handlers
│   │   ├── chatController.js     # Conversation and message REST endpoints
│   │   ├── reviewController.js   # Peer review and rating calculations
│   │   └── transactionController.js # Deals, bids, and purchase orders
│   ├── middleware/
│   │   ├── auth.js               # JWT verification & ownership protection
│   │   ├── upload.js             # Multer upload for confirmed listings
│   │   ├── chatUpload.js         # Secure chat photo attachments
│   │   ├── rateLimiter.js        # IP and user rate limiters
│   │   └── securitySanitizer.js  # NoSQL injection and XSS sanitation
│   ├── models/
│   │   ├── User.js               # User and student verification schema
│   │   ├── Product.js            # Product schema with strict constraints
│   │   ├── Conversation.js       # Chat conversation tracking
│   │   ├── Message.js            # Chat message schema
│   │   ├── Transaction.js        # Purchase and deal schema
│   │   └── Review.js             # Two-way rating & review schema
│   ├── routes/
│   │   ├── authRoutes.js         # /api/auth
│   │   ├── productRoutes.js      # /api/products
│   │   ├── chatRoutes.js         # /api/chat
│   │   ├── reviewRoutes.js       # /api/reviews
│   │   └── transactionRoutes.js  # /api/transactions
│   ├── sockets/
│   │   └── chatSocket.js         # Socket.IO real-time events and presence
│   ├── tests/
│   │   ├── studentVerification.test.js
│   │   ├── securityLayer.test.js
│   │   ├── chat.test.js
│   │   └── ratingsAndReviews.test.js
│   ├── server.js                 # Express application bootstrap
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/           # CampusLogo, Navbar, Footer, ProductCard, Chat, Reviews
│   │   ├── pages/                # Home, Browse, Sell, Details, Chat, Profile, Transactions
│   │   ├── services/             # Axios API services (auth, product, chat, review, transaction)
│   │   ├── context/              # Auth and Socket contexts
│   │   └── styles/               # CSS design tokens, themes, layouts
│   ├── tests/
│   │   └── constants.test.js     # Frontend unit tests
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
└── README.md
```

---

## 5. Installation & Setup

### Prerequisites
- Node.js 20+ (Node 22 recommended)
- MongoDB instance (local or MongoDB Atlas)

### Backend Setup

```bash
cd backend

# Copy environment template
cp .env.example .env

# Configure .env with your credentials:
# PORT=5000
# MONGO_URI=mongodb://127.0.0.1:27017/campusx
# JWT_SECRET=your_jwt_secret_key
# CLIENT_URL=http://localhost:5173

npm install
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Copy environment template
cp .env.example .env

# VITE_API_BASE_URL=http://localhost:5000/api

npm install
npm run dev
```

The application will be accessible at `http://localhost:5173`.

---

## 6. Running Automated Tests

### Backend Test Suite

Runs native `node:test` covering student verification, security sanitization, real-time chat sockets, and two-way review workflows:

```bash
cd backend
npm test
```

### Frontend Test Suite

Runs frontend core unit tests:

```bash
cd frontend
npm test
```

### Linting & Build Verification

```bash
cd frontend
npm run lint
npm run build
```

---

## 7. API Overview

### Authentication
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register student with `@nitkkr.ac.in` email |
| `POST` | `/api/auth/verify-email` | Public | Verify 6-digit cryptographic OTP |
| `POST` | `/api/auth/login` | Public | Log in with college email & password |
| `POST` | `/api/auth/logout` | Private | Log out (clears authentication cookie) |
| `GET` | `/api/auth/profile` | Private | Get current student profile |
| `PUT` | `/api/auth/profile` | Private | Update profile details |

### Products
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/products` | Public | List products (search, filter, sort, paginate) |
| `GET` | `/api/products/:id` | Public | Get product details |
| `POST` | `/api/products` | Private | Create a new listing (multipart, photos) |
| `PUT` | `/api/products/:id` | Private (Owner) | Update an existing product |
| `DELETE` | `/api/products/:id` | Private (Owner) | Delete a listing |

### Chat & Deals
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/chat/conversations` | Private | List all conversations |
| `POST` | `/api/chat/conversations/:id/messages` | Private | Send a chat message |
| `POST` | `/api/transactions` | Private | Create a purchase request / bid |
| `PATCH` | `/api/transactions/:id/status` | Private | Accept/reject bid or complete transaction |
| `POST` | `/api/reviews` | Private | Submit peer review for completed transaction |

---

Built for students, by students. 🎓
