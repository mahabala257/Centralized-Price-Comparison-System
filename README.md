# PricePulse — AI-Powered Multi-Store Price Comparison

PricePulse fetches live product listings from multiple stores (Amazon, Flipkart, Shein via RapidAPI, with a DummyJSON fallback), groups matching products together, and scores each deal with a few lightweight AI-style heuristics — deal score, price-drop prediction, and price-drop alerts — so you can see at a glance which store has the best price.

## Features

- **Multi-store aggregation** — pulls product data from Amazon, Flipkart, and Shein (RapidAPI), falling back to [DummyJSON](https://dummyjson.com/) if no API key is set or all sources fail.
- **Deal intelligence** — every product is enriched with:
  - `dealScore` (0–10) based on discount size, rating, and review count
  - `pricePrediction` — a simple heuristic guess at whether the price will drop
  - `priceDropAlert` — flags strong current deals with an expected savings estimate
  - `recommendations` — similar-priced products from other stores
- **In-memory caching** — results are cached for 5 minutes to avoid re-hitting rate-limited APIs on every page load.
- **React UI** — product comparison grid, search with suggestions, store/sort filters, live alerts tab, and an AI insights dashboard.

## Project Structure

```
price-comparison-project-main/
├── backend/
│   ├── server.js              # App entry point (Express + MongoDB)
│   ├── config/db.js           # Mongo connection helper
│   ├── controllers/productController.js   # Multi-API fetch, parsing, AI enrichment
│   ├── routes/productRoutes.js
│   └── models/Product.js      # Mongoose schema
├── frontend/
│   └── src/
│       ├── App.js             # Main UI (single-file app)
│       ├── api.js             # Axios calls to the backend
│       └── index.js           # React entry point
├── mock-api/products.json     # Sample/mock product data
└── globalTLS.js                # Forces TLS 1.2 for outbound HTTPS requests
```

> Note: `backend/app.js`, `ml-models/Product.js`, and `frontend/src/pages|components|services` are legacy/unused leftovers — the live backend entry is `backend/server.js`, and the live frontend entry renders `frontend/src/App.js`.

## Prerequisites

- Node.js 18+
- A MongoDB connection string (e.g. [MongoDB Atlas](https://www.mongodb.com/atlas))
- (Optional) A [RapidAPI](https://rapidapi.com/) key with access to:
  - `real-time-amazon-data`
  - `flipkart-apis`
  - `shein-scraper-api`

  Without a key, the backend automatically falls back to DummyJSON sample data.

## Setup

### Backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
API_KEY_1=your_rapidapi_key   # optional
```

Run the server:

```bash
npm start        # node server.js
# or
npm run dev      # nodemon server.js
```

### Frontend

```bash
cd frontend
npm install
npm start
```

The app runs on `http://localhost:3000` and expects the backend at `http://localhost:5000`.

## API Endpoints

| Method | Endpoint                              | Description                                      |
|--------|----------------------------------------|--------------------------------------------------|
| GET    | `/api/products/search-multi-api`      | Searches all stores, returns enriched products. Query params: `q` (search term), `pages` (capped at 2) |
| GET    | `/api/products/:id`                   | Fetches details for a single product (Shein lookup) |

## Tech Stack

- **Backend:** Node.js, Express, Mongoose, Axios, dotenv, cors
- **Frontend:** React 18, Axios
- **Data sources:** RapidAPI (Amazon, Flipkart, Shein), DummyJSON fallback
