# CampusX — College Campus Marketplace

A full-stack MERN marketplace built specifically for university students to safely buy and sell second-hand textbooks, calculators, cycles, electronics, and hostel essentials within their campus community.

---

## 1. Project Overview

Every year, graduating students leave behind valuable textbooks, calculators, bicycles, and appliances. Historically, this trading happened in unstructured WhatsApp groups: posts were quickly buried, duplicates piled up, search was nonexistent, and buyers had no way to verify if items were still available. 

CampusX provides an organized, authenticated campus marketplace featuring an intelligent **AI Listing Assistant powered by Google Gemini Vision**.

---

## 2. Key Features

- **✨ AI Listing Assistant** — Upload 1–5 photos of any item; Google Gemini Vision analyzes the images, identifies brand and model, determines category and condition, writes a compelling description, suggests searchable tags, and estimates a fair campus price range (INR).
- **Human-in-the-Loop Review & Edit** — Sellers review and can edit all AI suggestions before anything is published. AI never directly modifies the database.
- **Authentication & Security** — JWT stored in `httpOnly` secure cookies, bcrypt password hashing, and role/ownership middleware.
- **Product CRUD** — Create, edit, delete, and mark listings as sold.
- **Advanced Search & Filtering** — Search by title, category, or department. Filter by price, category, condition, and availability. Sort by price or date.
- **Image Upload Pipeline** — Multer-powered image upload with preview, file-type verification, and size validation.
- **Responsive Theme-Aware UI** — Dark and light themes using CSS design tokens, mobile-first responsive layout.
- **Automated Test Suite** — Full backend and frontend test suites with mocked Gemini API endpoints.

---

## 3. Technology Stack

- **Frontend:** React 18, Vite, React Router DOM v6, Axios, Context API, react-hot-toast, react-icons (Feather & Heroicons v2).
- **Backend:** Node.js (ES modules), Express.js 4.19, Mongoose 8.5.
- **AI / GenAI:** Google Gen AI SDK (`@google/genai`), Multimodal Gemini 2.5 Flash model, Structured JSON Output schemas.
- **Database:** MongoDB with Mongoose.
- **Authentication & Security:** JWT (`httpOnly`, `sameSite: lax` cookies), bcryptjs, Helmet, CORS.
- **File Handling:** Multer (memory buffers for ephemeral AI vision analysis; disk storage for confirmed listings).

---

## 4. Folder Structure

```
CampusX/
├── backend/
│   ├── config/
│   │   ├── db.js                 # MongoDB connection
│   │   └── aiPrompt.js           # Gemini system instructions & JSON schemas
│   ├── controllers/
│   │   ├── authController.js     # User registration, login, profile
│   │   ├── productController.js  # Product listing CRUD handlers
│   │   └── aiController.js       # AI listing generation endpoint
│   ├── middleware/
│   │   ├── auth.js               # JWT verification & ownership protection
│   │   ├── upload.js             # Multer disk upload for confirmed listings
│   │   ├── aiUpload.js           # Multer memory storage & validation for AI
│   │   ├── validate.js           # express-validator rules
│   │   └── errorHandler.js       # Centralized error handler
│   ├── models/
│   │   ├── User.js               # User schema
│   │   └── Product.js            # Product schema (strict enum constraints)
│   ├── routes/
│   │   ├── authRoutes.js         # /api/auth
│   │   ├── productRoutes.js      # /api/products
│   │   └── aiRoutes.js           # /api/ai
│   ├── services/
│   │   └── geminiService.js      # Google Gen AI SDK integration & vision pipeline
│   ├── utils/
│   │   ├── aiListingValidator.js # Normalization & validation of Gemini output
│   │   └── generateToken.js      # JWT cookie generation
│   ├── tests/
│   │   └── aiListing.test.js     # Automated backend integration test suite
│   ├── server.js                 # Express application bootstrap
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AiAssistantCard.jsx  # Interactive AI suggestions & review card
│   │   │   ├── Navbar.jsx, Footer.jsx, Button.jsx, ProductCard.jsx, etc.
│   │   ├── pages/
│   │   │   ├── SellProduct.jsx      # Create Listing page with AI integration
│   │   │   ├── BrowseProducts.jsx, EditProduct.jsx, ProductDetails.jsx, etc.
│   │   ├── services/
│   │   │   ├── api.js               # Axios instance with credentials & interceptors
│   │   │   ├── aiService.js         # Client API calls for AI listing generation
│   │   │   ├── authService.js
│   │   │   └── productService.js
│   │   ├── styles/
│   │   │   ├── theme.css, global.css, app.css
│   │   │   └── aiAssistant.css      # Dedicated AI assistant UI styles
│   ├── tests/
│   │   └── aiService.test.js        # Frontend unit tests
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
└── README.md
```

---

## 5. ✨ AI Listing Assistant (Google Gemini Vision)

### How It Works

```
                                  USER BROWSER (React)
                                           │
                             1. Uploads 1–5 Photos + Notes
                             2. Clicks "Generate with AI"
                                           ▼
                                  EXPRESS BACKEND
                                           │
                             3. Authenticates Request (JWT)
                             4. In-Memory Upload (Multer)
                             5. Invokes Gemini Service
                                           ▼
                             GOOGLE GEMINI 2.5 FLASH
                                           │
                             6. Multimodal Vision Analysis
                             7. Structured JSON Output
                                           ▼
                                  EXPRESS BACKEND
                                           │
                             8. Schema Validation & Normalization
                             9. Returns Structured Suggestions
                                           ▼
                                  USER BROWSER (React)
                                           │
                            10. Interactive Review & Editing
                            11. Seller Confirms & Edits Fields
                            12. Submits to Existing POST /api/products
                                           ▼
                                  MONGODB DATABASE
```

### Architectural Highlights

1. **Server-Side API Key Security:** The `GEMINI_API_KEY` is strictly confined to the backend server environment. It is never exposed to the React frontend, client bundle, or network requests.
2. **Ephemeral In-Memory Processing:** Images uploaded for AI analysis are buffered in RAM (`multer.memoryStorage()`) and sent directly to Gemini via base64 inline data parts. No temporary orphan files accumulate on disk if a seller decides not to publish.
3. **Structured JSON Output:** Uses the official `@google/genai` SDK with `responseMimeType: "application/json"` and strict `responseSchema` enforcement.
4. **Domain-Specific Normalization:**
   - **Categories:** Strictly mapped to the 10 supported CampusX categories (`Books`, `Electronics`, `Cycles`, `Furniture`, `Hostel Essentials`, `Lab Equipment`, `Calculators`, `Sports`, `Stationery`, `Others`).
   - **Conditions:** Mapped to application enums (`New`, `Like New`, `Good`, `Fair`, `Old`).
   - **Pricing:** Estimated fair resale price range in INR (`estimatedPriceMin` and `estimatedPriceMax`).
5. **Anti-Hallucination Design:**
   - The Gemini prompt mandates identifying visible evidence only. Unknown brands or models are marked `"Unknown / Unable to determine"` rather than hallucinating model numbers.
   - Seller context notes are passed with clear boundaries so seller input cannot override system classification rules.
6. **Graceful Fallback:** If the Gemini API is unreachable, rate-limited, or misconfigured, the frontend renders a clean alert: *"AI analysis is temporarily unavailable. You can continue creating the listing manually."* Normal manual listing creation continues to work 100% uninterrupted.

---

## 6. Installation & Setup

### Prerequisites
- Node.js 20+ (Node 22 recommended)
- MongoDB instance (local or MongoDB Atlas)
- Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Backend Setup

```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env with your credentials:
# PORT=5000
# MONGO_URI=mongodb://127.0.0.1:27017/campusx
# JWT_SECRET=your_jwt_secret_key
# GEMINI_API_KEY=your_actual_gemini_api_key
# GEMINI_MODEL=gemini-2.5-flash

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

## 7. Running Automated Tests

### Backend Test Suite (10 Integration & Unit Tests)

Runs native `node:test` covering unauthenticated rejections, image count limits, invalid file types, mock Gemini responses, schema normalization, rate limit fallbacks, and manual product creation:

```bash
cd backend
npm test
```

### Frontend Test Suite

Runs frontend service and request validation tests:

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

## 8. API Documentation

### AI Assistant
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/ai/generate-listing` | Private (Auth) | Upload 1–5 photos (`images`) + optional `sellerContext` (multipart/form-data) to receive structured listing recommendations. |

#### Sample Response:
```json
{
  "success": true,
  "message": "AI listing suggestions generated successfully",
  "data": {
    "detectedProduct": "Casio FX-991ES PLUS",
    "category": "Calculators",
    "condition": "Like New",
    "suggestedTitle": "Casio FX-991ES PLUS Scientific Calculator",
    "description": "Casio FX-991ES PLUS scientific calculator in excellent working condition.",
    "estimatedPriceMin": 650,
    "estimatedPriceMax": 850,
    "currency": "INR",
    "tags": ["calculator", "casio", "engineering"],
    "detectedAttributes": {
      "brand": "Casio",
      "model": "FX-991ES PLUS"
    },
    "confidence": 0.91,
    "notes": ["Original slide cover visible"]
  }
}
```

### Authentication
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register a new student account |
| `POST` | `/api/auth/login` | Public | Log in with college email & password |
| `POST` | `/api/auth/logout` | Private | Log out (clears authentication cookie) |
| `GET` | `/api/auth/profile` | Private | Get profile details |
| `PUT` | `/api/auth/profile` | Private | Update profile details |

### Products
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/products` | Public | List products (search, filter, sort, paginate) |
| `GET` | `/api/products/:id` | Public | Get product details + related category items |
| `POST` | `/api/products` | Private | Create a new listing (multipart, up to 6 images) |
| `PUT` | `/api/products/:id` | Private (Owner) | Update an existing product |
| `DELETE` | `/api/products/:id` | Private (Owner) | Delete a listing |
| `PATCH` | `/api/products/:id/sold` | Private (Owner) | Toggle Available/Sold status |
| `GET` | `/api/products/user/me` | Private | Get current user's listings and stats |

---

## 9. Security & Production Practices

- **Zero Client API Key Leakage:** API keys are never compiled into client-side JS or sent across HTTP responses.
- **MIME & Magic Header Validation:** Uploaded images are validated for both extension and binary MIME types (`jpeg`, `png`, `webp`).
- **Prompt Injection Defense:** Seller notes are sanitized and wrapped in strict delimited context blocks. System instructions explicitly command the model to prioritize category and condition bounds over user text.
- **Graceful Degradation:** When AI services are down or rate limited, the marketplace functions without disruption.
- **Human-in-the-Loop:** Listings are never auto-published; sellers retain complete agency to review and edit every attribute.

---

Built for students, by students. 🎓
