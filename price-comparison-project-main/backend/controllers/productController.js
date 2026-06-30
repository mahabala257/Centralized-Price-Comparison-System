import axios from "axios";

// ── Config ────────────────────────────────────────────────────────────────────
const RAPIDAPI_KEY = (process.env.API_KEY_1 || "").trim();

// Simple in-memory cache — avoids hammering APIs on every page refresh
let cachedProducts = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── AI Helpers ────────────────────────────────────────────────────────────────
function calcDealScore(product) {
  let score = 5;
  const discount =
    product.originalPrice && product.price && product.originalPrice > product.price
      ? ((product.originalPrice - product.price) / product.originalPrice) * 100
      : 0;
  if (discount >= 40) score += 3;
  else if (discount >= 20) score += 2;
  else if (discount >= 10) score += 1;
  if ((product.rating || 0) >= 4.5) score += 1.5;
  else if ((product.rating || 0) >= 4.0) score += 1;
  if ((product.reviews || 0) > 1000) score += 0.5;
  return Math.min(10, Math.round(score * 10) / 10);
}

function predictPrice(product) {
  const discount =
    product.originalPrice && product.price && product.originalPrice > product.price
      ? ((product.originalPrice - product.price) / product.originalPrice) * 100
      : 0;
  const willDrop = discount < 15 && (product.rating || 0) < 4.2;
  return {
    willDrop,
    message: willDrop
      ? "Price may drop — low discount + average rating"
      : "Good deal now — price likely stable",
  };
}

function priceDropAlert(product) {
  const discount =
    product.originalPrice && product.price && product.originalPrice > product.price
      ? ((product.originalPrice - product.price) / product.originalPrice) * 100
      : 0;
  const hasAlert = discount >= 25 && (product.rating || 0) >= 4.0;
  return {
    hasAlert,
    alertMessage: hasAlert ? `🔥 ${Math.round(discount)}% off — strong deal!` : null,
    expectedPrice: hasAlert ? Math.round((product.price || 0) * 0.95) : null,
    savings: hasAlert ? Math.round((product.price || 0) * 0.05) : 0,
  };
}

function getRecommendations(product, allProducts) {
  return allProducts
    .filter(
      (p) =>
        p.id !== product.id &&
        p.website !== product.website &&
        Math.abs((p.price || 0) - (product.price || 0)) < 50
    )
    .slice(0, 3);
}

// ── Parsers ───────────────────────────────────────────────────────────────────
function parseAmazon(items) {
  return (items || [])
    .map((item) => ({
      id: item.asin || Math.random().toString(36).slice(2),
      title: item.product_title || item.title || "Amazon Product",
      price: parseFloat(item.product_price?.replace(/[^0-9.]/g, "")) || null,
      originalPrice:
        parseFloat(item.product_original_price?.replace(/[^0-9.]/g, "")) || null,
      image: item.product_photo || item.thumbnail || "",
      rating: parseFloat(item.product_star_rating) || null,
      reviews: parseInt(item.product_num_ratings?.replace(/[^0-9]/g, "")) || 0,
      productLink: item.product_url || "#",
      website: "amazon.com",
    }))
    .filter((p) => p.price && p.title);
}

function parseFlipkart(data) {
  const items =
    data?.products ||
    data?.data?.products ||
    data?.data ||
    (Array.isArray(data) ? data : []);
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const p = item.product || item;
      return {
        id: p.pid || p.id || Math.random().toString(36).slice(2),
        title: p.name || p.title || "Flipkart Product",
        price: parseFloat(String(p.price || "").replace(/[^0-9.]/g, "")) || null,
        originalPrice:
          parseFloat(String(p.mrp || p.originalPrice || "").replace(/[^0-9.]/g, "")) || null,
        image: p.image || p.imageUrl || p.img || "",
        rating: parseFloat(p.rating) || null,
        reviews: parseInt(p.ratingCount || p.reviewCount) || 0,
        productLink: p.url || p.productUrl || "#",
        website: "flipkart.com",
      };
    })
    .filter((p) => p.title);
}

function parseShein(data) {
  const items =
    data?.data?.productList ||
    data?.productList ||
    (Array.isArray(data?.data) ? data.data : null) ||
    (Array.isArray(data) ? data : []);
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const price =
        parseFloat(
          item.salePrice?.amount ||
            item.retailPrice?.amount ||
            item.price?.amount ||
            item.price ||
            ""
        ) || null;
      const originalPrice =
        parseFloat(
          item.retailPrice?.amount ||
            item.originalPrice?.amount ||
            item.originalPrice ||
            ""
        ) || null;
      return {
        id: item.goods_id || item.productId || item.id || Math.random().toString(36).slice(2),
        title: item.goods_name || item.productName || item.name || "Shein Product",
        price,
        originalPrice: originalPrice && originalPrice > price ? originalPrice : null,
        image: item.goods_img || item.mainImage || item.imgUrl || item.image || "",
        rating: parseFloat(item.goods_score || item.rating) || null,
        reviews: parseInt(item.comment_num || item.reviewCount) || 0,
        productLink: item.goods_url ? `https://www.shein.com${item.goods_url}` : "#",
        website: "shein.com",
      };
    })
    .filter((p) => p.title);
}

// ── DummyJSON — guaranteed fallback, no API key needed ───────────────────────
async function fetchDummyJSON() {
  try {
    const res = await axios.get("https://dummyjson.com/products?limit=100", { timeout: 8000 });
    const items = res.data?.products || [];
    console.log(`DummyJSON fallback ✅ ${items.length} products`);
    return items.map((item) => ({
      id: `dummy-${item.id}`,
      title: item.title || "Product",
      price: item.price || null,
      originalPrice: item.price
        ? Math.round(item.price * (1 + (item.discountPercentage || 10) / 100))
        : null,
      image: item.thumbnail || (item.images && item.images[0]) || "",
      rating: item.rating || null,
      reviews: item.stock || 0,
      productLink: "#",
      website: "dummyjson.com",
    }));
  } catch (err) {
    console.warn("DummyJSON ❌", err.message);
    return [];
  }
}

// ── Safe RapidAPI GET — correct header casing ─────────────────────────────────
async function rapidGet(url, params, host) {
  return axios.get(url, {
    params,
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": host,
    },
    timeout: 12000,
  });
}

// ── delay helper ──────────────────────────────────────────────────────────────
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Fetch Amazon — sequential pages with delay ────────────────────────────────
async function fetchAmazon(query = "phone", pages = 2) {
  if (!RAPIDAPI_KEY) { console.warn("Amazon ⚠️  No API key"); return []; }
  const all = [];
  for (let page = 1; page <= pages; page++) {
    try {
      const res = await rapidGet(
        "https://real-time-amazon-data.p.rapidapi.com/search",
        { query, page: String(page), country: "US", sort_by: "RELEVANCE" },
        "real-time-amazon-data.p.rapidapi.com"
      );
      const parsed = parseAmazon(res.data?.data?.products || []);
      all.push(...parsed);
      console.log(`Amazon page ${page} ✅ ${parsed.length}`);
      if (page < pages) await delay(800);
    } catch (err) {
      const code = err.response?.status;
      console.warn(`Amazon page ${page} ❌ ${code}`);
      if (code === 429) { console.warn("Amazon rate limited — stopping"); break; }
    }
  }
  return all;
}

// ── Fetch Flipkart — sequential ───────────────────────────────────────────────
async function fetchFlipkart(pages = 2) {
  if (!RAPIDAPI_KEY) { console.warn("Flipkart ⚠️  No API key"); return []; }
  const all = [];
  const categoryIDs = ["tyy%2F4io%2F4ioA8E", "axc"];
  for (let i = 0; i < Math.min(pages, categoryIDs.length); i++) {
    try {
      const res = await rapidGet(
        "https://flipkart-apis.p.rapidapi.com/backend/rapidapi/category-products-list",
        { categoryID: categoryIDs[i], page: "1" },
        "flipkart-apis.p.rapidapi.com"
      );
      const parsed = parseFlipkart(res.data);
      all.push(...parsed);
      console.log(`Flipkart cat ${i + 1} ✅ ${parsed.length}`);
      if (i < pages - 1) await delay(800);
    } catch (err) {
      const code = err.response?.status;
      console.warn(`Flipkart cat ${i + 1} ❌ ${code}`);
      if (code === 429) break;
    }
  }
  return all;
}

// ── Fetch Shein — sequential with fallback endpoint ───────────────────────────
async function fetchShein(query = "electronics", pages = 2) {
  if (!RAPIDAPI_KEY) { console.warn("Shein ⚠️  No API key"); return []; }
  const all = [];
  for (let page = 1; page <= pages; page++) {
    let success = false;
    try {
      const res = await rapidGet(
        "https://shein-scraper-api.p.rapidapi.com/shein/search/products",
        { q: query, page: String(page), limit: "20", currency: "USD", country: "US" },
        "shein-scraper-api.p.rapidapi.com"
      );
      const parsed = parseShein(res.data);
      all.push(...parsed);
      console.log(`Shein page ${page} ✅ ${parsed.length}`);
      success = true;
    } catch (err) {
      const code = err.response?.status;
      console.warn(`Shein page ${page} ❌ ${code}`);
      if (code === 429) break;
    }
    // Fallback endpoint if primary returned 0 or failed
    if (!success) {
      try {
        await delay(400);
        const res2 = await rapidGet(
          "https://shein-scraper-api.p.rapidapi.com/shein/product/search",
          { keyword: query, page: String(page), limit: "20" },
          "shein-scraper-api.p.rapidapi.com"
        );
        const parsed2 = parseShein(res2.data);
        all.push(...parsed2);
        console.log(`Shein fallback ${page} ✅ ${parsed2.length}`);
      } catch (err2) {
        console.warn(`Shein fallback ${page} ❌ ${err2.response?.status}`);
      }
    }
    if (page < pages) await delay(800);
  }
  return all;
}

// ── Enrich with AI ────────────────────────────────────────────────────────────
function enrichProducts(products) {
  const enriched = products.map((p) => ({
    ...p,
    dealScore: calcDealScore(p),
    pricePrediction: predictPrice(p),
    priceDropAlert: priceDropAlert(p),
  }));
  return enriched.map((p) => ({
    ...p,
    recommendations: getRecommendations(p, enriched),
  }));
}

// ── Main Controller ───────────────────────────────────────────────────────────
export const searchMultiAPI = async (req, res) => {
  try {
    // Serve from cache if fresh (avoids re-hitting APIs every page load)
    if (cachedProducts && Date.now() - cacheTime < CACHE_TTL) {
      console.log(`📦 Cache hit — serving ${cachedProducts.length} products`);
      return res.status(200).json(cachedProducts);
    }

    const query = req.query.q || "phone";
    const pages = Math.min(parseInt(req.query.pages) || 2, 2); // cap at 2 to reduce 429s

    console.log(`\n🔍 "${query}" | Pages: ${pages}`);
    console.log("━".repeat(48));

    // Sequential — NOT parallel — to avoid rate limit bursts
    const amazonProducts = await fetchAmazon(query, pages);
    await delay(1000);
    const flipkartProducts = await fetchFlipkart(pages);
    await delay(1000);
    const sheinProducts = await fetchShein("fashion phone accessories", pages);

    console.log("━".repeat(48));
    console.log(`Amazon   : ${amazonProducts.length}`);
    console.log(`Flipkart : ${flipkartProducts.length}`);
    console.log(`Shein    : ${sheinProducts.length}`);

    let allRaw = [...amazonProducts, ...flipkartProducts, ...sheinProducts];

    // Fallback: if ALL external APIs failed, use DummyJSON so frontend isn't empty
    if (allRaw.length === 0) {
      console.log("\n⚠️  All RapidAPI sources returned 0 — falling back to DummyJSON");
      allRaw = await fetchDummyJSON();
    }

    const enriched = enrichProducts(allRaw);
    console.log(`✅ Enriched total: ${enriched.length}\n`);

    cachedProducts = enriched;
    cacheTime = Date.now();

    return res.status(200).json(enriched);
  } catch (error) {
    console.error("Controller error:", error.message);
    try {
      const fallback = enrichProducts(await fetchDummyJSON());
      return res.status(200).json(fallback);
    } catch {
      return res.status(500).json({ error: error.message });
    }
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await rapidGet(
      "https://shein-scraper-api.p.rapidapi.com/shein/product/details",
      { goods_id: id },
      "shein-scraper-api.p.rapidapi.com"
    );
    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};