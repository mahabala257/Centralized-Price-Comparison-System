import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const BACKEND = "http://localhost:5000";

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════ */
function groupProducts(products) {
  const groups = {};
  products.forEach((p) => {
    const key = p.title
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .split(" ")
      .slice(0, 4)
      .join(" ");
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });
  return Object.values(groups).filter((g) => g.length >= 2);
}

function getCheapest(group) {
  return group.reduce((min, p) =>
    (p.price || Infinity) < (min.price || Infinity) ? p : min
  );
}

function useMouse() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const h = (e) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);
  return pos;
}

function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    const n = parseFloat(target);
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Number.isInteger(n) ? Math.round(eased * n) : (eased * n).toFixed(1));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
}

/* ═══════════════════════════════════════════════════════════════════
   MICRO COMPONENTS
═══════════════════════════════════════════════════════════════════ */
function Sparkline({ data = [], color = "#f472b6", height = 28, width = 72 }) {
  const points = data.length ? data : [5, 4, 6, 4, 3, 5, 3, 2, 3];
  const min = Math.min(...points), max = Math.max(...points);
  const px = (i) => (i / (points.length - 1)) * width;
  const py = (v) => height - 4 - ((v - min) / (max - min + 0.001)) * (height - 8);
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const area = d + ` L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${color.replace("#", "")})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(points.length - 1)} cy={py(points[points.length - 1])} r="3" fill={color} />
    </svg>
  );
}

function RingScore({ score, size = 52 }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = (score || 0) / 10;
  const color = score >= 8 ? "#ec4899" : score >= 6 ? "#a855f7" : "#f43f5e";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth="4" strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round" style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <span style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, color, fontFamily: "'DM Mono', monospace",
      }}>{score}</span>
    </div>
  );
}

function StoreBadge({ website }) {
  const cfg = {
    "amazon.com": { label: "Amazon", bg: "#f97316" },
    "flipkart.com": { label: "Flipkart", bg: "#818cf8" },
  };
  const c = cfg[website] || { label: website?.split(".")[0] || "Store", bg: "#f472b6" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 9.5,
      fontWeight: 700, letterSpacing: 0.8, fontFamily: "'DM Mono', monospace",
      background: c.bg + "22", color: c.bg, border: `1px solid ${c.bg}50`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.bg, display: "inline-block" }} />
      {c.label.toUpperCase()}
    </span>
  );
}

function PriceMeter({ price, min, max, isBest }) {
  const pct = max === min ? 50 : ((price - min) / (max - min)) * 100;
  const goodness = 100 - pct;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${goodness}%`, borderRadius: 4,
          background: isBest
            ? "linear-gradient(90deg, #ec4899, #f9a8d4)"
            : "linear-gradient(90deg, #a855f7, #c084fc)",
          transition: "width 1s cubic-bezier(.4,0,.2,1)",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 9, color: "rgba(255,200,220,0.25)", fontFamily: "'DM Mono',monospace" }}>COSTLY</span>
        <span style={{ fontSize: 9, color: "rgba(255,200,220,0.25)", fontFamily: "'DM Mono',monospace" }}>CHEAPEST</span>
      </div>
    </div>
  );
}

function Stars({ rating }) {
  const full = Math.floor(rating || 0);
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ fontSize: 12, color: i <= full ? "#f472b6" : "rgba(255,255,255,0.1)" }}>♥</span>
      ))}
      {rating && (
        <span style={{ fontSize: 10.5, color: "rgba(255,180,210,0.45)", marginLeft: 5, fontFamily: "'DM Mono',monospace" }}>
          {rating}
        </span>
      )}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PRODUCT CARD  (flip + tilt + details)
═══════════════════════════════════════════════════════════════════ */
function ProductCard({ p, isBest, minPrice, maxPrice, delay = 0 }) {
  const [flipped, setFlipped] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [vis, setVis] = useState(false);
  const cardRef = useRef();

  useEffect(() => {
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.1 });
    if (cardRef.current) ob.observe(cardRef.current);
    return () => ob.disconnect();
  }, []);

  const handleMouseMove = useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = (e.clientX - r.left) / r.width - 0.5;
    const cy = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: cy * 10, y: cx * -10 });
  }, []);

  const discountPct = p.originalPrice && p.originalPrice > p.price
    ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;

  const trendData = p.pricePrediction?.willDrop
    ? [9, 8, 9, 7, 8, 6, 7, 5, 4]
    : [4, 5, 4, 6, 5, 6, 5, 7, 6];
  const trendColor = p.pricePrediction?.willDrop ? "#34d399" : "#f472b6";

  return (
    <div ref={cardRef} style={{
      perspective: 1000,
      opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(24px)",
      transition: `opacity .5s ${delay}s, transform .5s ${delay}s cubic-bezier(.34,1.4,.64,1)`,
    }}>
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        style={{
          position: "relative",
          transformStyle: "preserve-3d",
          transform: flipped
            ? "rotateY(180deg)"
            : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: flipped ? "transform .65s cubic-bezier(.4,0,.2,1)" : "transform .15s ease-out",
          cursor: "pointer",
        }}
      >
        {/* ──── FRONT ──── */}
        <div style={{
          backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          background: isBest
            ? "linear-gradient(160deg, rgba(236,72,153,0.13) 0%, rgba(168,85,247,0.06) 100%)"
            : "linear-gradient(160deg, rgba(255,240,248,0.04) 0%, rgba(255,255,255,0.01) 100%)",
          border: `1px solid ${isBest ? "rgba(236,72,153,0.4)" : "rgba(255,180,210,0.1)"}`,
          borderRadius: 22,
          overflow: "hidden",
          boxShadow: isBest
            ? "0 8px 40px rgba(236,72,153,0.18), 0 2px 8px rgba(0,0,0,0.4)"
            : "0 4px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.2)",
        }}>
          <div style={{
            height: 2, width: "100%",
            background: isBest
              ? "linear-gradient(90deg, transparent, #ec4899 40%, #f9a8d4 60%, transparent)"
              : "linear-gradient(90deg, transparent, rgba(244,114,182,0.35), transparent)",
          }} />

          {isBest && (
            <div style={{
              position: "absolute", top: 20, left: -30, width: 115, textAlign: "center",
              background: "linear-gradient(90deg, #be185d, #ec4899)",
              color: "#fff", fontSize: 7.5, fontWeight: 700, letterSpacing: 2,
              padding: "5px 0", fontFamily: "'DM Mono',monospace",
              transform: "rotate(-45deg)",
              boxShadow: "0 2px 12px rgba(236,72,153,0.5)",
            }}>✦ BEST DEAL</div>
          )}

          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <StoreBadge website={p.website} />
              <RingScore score={p.dealScore} />
            </div>

            <div style={{
              position: "relative",
              background: "linear-gradient(145deg, rgba(255,240,248,0.07), rgba(255,255,255,0.02))",
              borderRadius: 16, padding: 14, marginBottom: 12, textAlign: "center",
              border: "1px solid rgba(244,114,182,0.1)",
            }}>
              <img
                src={p.image || `https://via.placeholder.com/160x120/1a0813/8b3a62?text=${encodeURIComponent(p.website?.split(".")[0] || "?")}`}
                alt={p.title}
                style={{ width: "100%", height: 110, objectFit: "contain", transition: "transform .35s cubic-bezier(.34,1.4,.64,1)" }}
                onMouseEnter={e => e.target.style.transform = "scale(1.1) translateY(-4px)"}
                onMouseLeave={e => e.target.style.transform = "scale(1) translateY(0)"}
              />
              {discountPct > 0 && (
                <div style={{
                  position: "absolute", top: 8, right: 8,
                  background: "linear-gradient(135deg, #be185d, #ec4899)",
                  color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 9px",
                  borderRadius: 20, fontFamily: "'DM Mono',monospace",
                  boxShadow: "0 2px 10px rgba(236,72,153,0.55)",
                  animation: "saleWiggle 2s ease-in-out infinite",
                }}>{discountPct}% OFF</div>
              )}
            </div>

            <p style={{
              fontSize: 12, color: "rgba(255,220,235,0.72)", lineHeight: 1.55,
              margin: "0 0 10px", minHeight: 36,
              fontFamily: "'Nunito', sans-serif", fontWeight: 400,
            }}>
              {p.title?.slice(0, 55)}{(p.title?.length || 0) > 55 ? "…" : ""}
            </p>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                  <span style={{ fontSize: 14, color: isBest ? "#f9a8d4" : "#c084fc", fontFamily: "'Nunito',sans-serif", fontWeight: 600 }}>$</span>
                  <span style={{
                    fontSize: 27, fontWeight: 700, lineHeight: 1,
                    color: isBest ? "#f472b6" : "#c084fc",
                    fontFamily: "'DM Mono', monospace",
                    textShadow: isBest ? "0 0 24px rgba(244,114,182,0.4)" : "0 0 24px rgba(192,132,252,0.35)",
                  }}>{p.price || "—"}</span>
                </div>
                {discountPct > 0 && (
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.22)", textDecoration: "line-through", fontFamily: "'DM Mono',monospace" }}>
                    ${p.originalPrice}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span style={{ fontSize: 9, color: trendColor, fontFamily: "'DM Mono',monospace", letterSpacing: 0.5 }}>
                  {p.pricePrediction?.willDrop ? "↘ DROPPING" : "→ STABLE"}
                </span>
                <Sparkline data={trendData} color={trendColor} />
              </div>
            </div>

            <PriceMeter price={p.price || 0} min={minPrice} max={maxPrice} isBest={isBest} />
          </div>

          <div style={{ padding: "10px 16px 0" }}>
            <Stars rating={p.rating} />
          </div>

          {p.priceDropAlert?.hasAlert && (
            <div style={{
              margin: "10px 16px 4px", padding: "9px 12px",
              background: "rgba(244,114,182,0.08)", border: "1px solid rgba(244,114,182,0.22)",
              borderRadius: 12, fontSize: 10.5, color: "#f9a8d4",
              fontFamily: "'Nunito',sans-serif",
            }}>
              🛎 {p.priceDropAlert.alertMessage}
              {p.priceDropAlert.savings > 0 && (
                <span style={{ display: "block", color: "rgba(255,255,255,0.28)", marginTop: 3, fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
                  Save ${p.priceDropAlert.savings} · Expected ${p.priceDropAlert.expectedPrice}
                </span>
              )}
            </div>
          )}

          {p.pricePrediction?.message && (
            <div style={{
              margin: "8px 16px 8px", padding: "6px 12px",
              background: p.pricePrediction.willDrop ? "rgba(52,211,153,0.08)" : "rgba(168,85,247,0.07)",
              borderRadius: 10, fontSize: 10,
              color: p.pricePrediction.willDrop ? "#34d399" : "#c084fc",
              fontFamily: "'DM Mono',monospace",
            }}>
              {p.pricePrediction.willDrop ? "📉" : "📈"} {p.pricePrediction.message}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, padding: "8px 16px 16px" }}>
            <a
              href={p.productLink || "#"} target="_blank" rel="noreferrer"
              style={{
                flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 12, textDecoration: "none",
                background: isBest
                  ? "linear-gradient(135deg, #be185d, #ec4899)"
                  : "linear-gradient(135deg, #6d28d9, #a855f7)",
                color: "#fff", fontSize: 11, fontWeight: 800,
                fontFamily: "'Nunito',sans-serif", letterSpacing: 1,
                boxShadow: isBest ? "0 4px 18px rgba(236,72,153,0.4)" : "0 4px 18px rgba(168,85,247,0.35)",
                transition: "all .2s", display: "block",
              }}
              onMouseEnter={e => { e.target.style.transform = "scale(1.03) translateY(-1px)"; e.target.style.filter = "brightness(1.18)"; }}
              onMouseLeave={e => { e.target.style.transform = "scale(1)"; e.target.style.filter = "brightness(1)"; }}
            >
              🛍 BUY NOW
            </a>
            <button
              onClick={() => setFlipped(true)}
              title="Product details"
              style={{
                padding: "10px 13px", borderRadius: 12,
                border: "1px solid rgba(244,114,182,0.22)",
                background: "rgba(244,114,182,0.07)", color: "rgba(249,168,212,0.5)",
                cursor: "pointer", fontSize: 16, transition: "all .2s",
              }}
              onMouseEnter={e => { e.target.style.background = "rgba(244,114,182,0.18)"; e.target.style.color = "#f9a8d4"; }}
              onMouseLeave={e => { e.target.style.background = "rgba(244,114,182,0.07)"; e.target.style.color = "rgba(249,168,212,0.5)"; }}
            >⋯</button>
          </div>
        </div>

        {/* ──── BACK ──── */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background: "linear-gradient(160deg, #1a0815, #0f0510)",
          border: "1px solid rgba(244,114,182,0.22)", borderRadius: 22, padding: 20,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 9, color: "#f472b6", fontFamily: "'DM Mono',monospace", letterSpacing: 2.5, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 14, height: 1, background: "#f472b6", display: "inline-block" }} />
              PRODUCT DETAILS
              <span style={{ width: 14, height: 1, background: "#f472b6", display: "inline-block" }} />
            </div>
            <p style={{ fontSize: 11.5, color: "rgba(255,220,235,0.65)", lineHeight: 1.65, margin: "0 0 16px", fontFamily: "'Nunito',sans-serif" }}>{p.title}</p>
            {[
              ["Store", p.website],
              ["Deal Score", `${p.dealScore || "—"} / 10`],
              ["Rating", p.rating ? `${p.rating} ♥` : "—"],
              ["Discount", discountPct ? `${discountPct}%` : "None"],
              ["Price Trend", p.pricePrediction?.willDrop ? "↘ Dropping" : "→ Stable"],
              ["Alert", p.priceDropAlert?.hasAlert ? "🔔 Active" : "None"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(244,114,182,0.07)", fontSize: 11 }}>
                <span style={{ color: "rgba(249,168,212,0.3)", fontFamily: "'DM Mono',monospace", fontSize: 10 }}>{k}</span>
                <span style={{ color: "rgba(255,220,235,0.85)", fontFamily: "'Nunito',sans-serif" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <a href={p.productLink || "#"} target="_blank" rel="noreferrer"
              style={{
                flex: 1, textAlign: "center", padding: "10px 0",
                background: "linear-gradient(135deg, #be185d, #ec4899)",
                color: "#fff", borderRadius: 12, textDecoration: "none",
                fontSize: 11, fontWeight: 800, fontFamily: "'Nunito',sans-serif",
              }}>
              VIEW →
            </a>
            <button onClick={() => setFlipped(false)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12,
                border: "1px solid rgba(244,114,182,0.2)",
                background: "rgba(244,114,182,0.07)", color: "rgba(249,168,212,0.7)",
                cursor: "pointer", fontSize: 11, fontFamily: "'Nunito',sans-serif",
              }}>
              ← BACK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STAT COUNTER
═══════════════════════════════════════════════════════════════════ */
function StatBox({ icon, label, value, suffix = "", accent = "#f472b6" }) {
  const n = useCountUp(parseFloat(value) || 0);
  return (
    <div style={{
      flex: 1, minWidth: 130,
      background: "linear-gradient(145deg, rgba(255,240,248,0.04), rgba(255,255,255,0.01))",
      border: "1px solid rgba(244,114,182,0.1)",
      borderRadius: 16, padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 14,
      transition: "border-color .25s, box-shadow .25s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(244,114,182,0.3)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(236,72,153,0.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(244,114,182,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 23, fontWeight: 700, color: accent, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>
          {n}{suffix}
        </div>
        <div style={{ fontSize: 9, color: "rgba(249,168,212,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: 1.5, marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════════════════════════════ */
function SearchBar({ value, onChange, products }) {
  const [focused, setFocused] = useState(false);
  const suggestions = value.length > 1
    ? [...new Set(products.filter(p => p.title?.toLowerCase().includes(value.toLowerCase())).map(p => p.title?.slice(0, 48)))].slice(0, 5)
    : [];

  return (
    <div style={{ position: "relative", width: "min(520px, 100%)" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(255,240,248,0.05)",
        border: `1.5px solid ${focused ? "rgba(236,72,153,0.65)" : "rgba(244,114,182,0.14)"}`,
        borderRadius: 50, padding: "0 18px",
        boxShadow: focused ? "0 0 0 3px rgba(236,72,153,0.12), 0 8px 32px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.3)",
        transition: "all .25s",
      }}>
        <span style={{ fontSize: 15, color: "rgba(244,114,182,0.5)" }}>🔍</span>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 160)}
          placeholder="Search for products, brands, deals…"
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "rgba(255,220,235,0.9)", fontSize: 13.5, padding: "13px 0",
            fontFamily: "'Nunito', sans-serif",
          }}
        />
        {value && (
          <button onClick={() => onChange("")}
            style={{ background: "none", border: "none", color: "rgba(244,114,182,0.45)", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        )}
      </div>
      {focused && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, zIndex: 200,
          background: "#130810", border: "1px solid rgba(244,114,182,0.14)",
          borderRadius: 18, overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
          animation: "dropIn .2s cubic-bezier(.34,1.4,.64,1)",
        }}>
          {suggestions.map((s, i) => (
            <div key={i}
              onMouseDown={() => onChange(s.split(" ").slice(0, 3).join(" "))}
              style={{
                padding: "12px 18px", fontSize: 12.5, color: "rgba(255,200,225,0.55)",
                cursor: "pointer", transition: "background .12s",
                borderBottom: i < suggestions.length - 1 ? "1px solid rgba(244,114,182,0.07)" : "none",
                fontFamily: "'Nunito',sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(236,72,153,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ color: "rgba(244,114,182,0.35)", marginRight: 10, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>→</span>{s}…
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   NAV TABS
═══════════════════════════════════════════════════════════════════ */
function NavTab({ id, active, onClick, icon, label, badge }) {
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        position: "relative", padding: "11px 22px", border: "none", cursor: "pointer",
        background: active ? "rgba(236,72,153,0.12)" : "transparent",
        color: active ? "#f472b6" : "rgba(249,168,212,0.35)",
        borderRadius: 10, fontFamily: "'DM Mono',monospace", fontSize: 10.5, fontWeight: 700,
        letterSpacing: 1, transition: "all .2s",
        display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = "rgba(249,168,212,0.7)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = "rgba(249,168,212,0.35)"; }}
    >
      {active && (
        <span style={{
          position: "absolute", bottom: 0, left: "15%", right: "15%", height: 2,
          background: "linear-gradient(90deg, transparent, #f472b6, transparent)", borderRadius: 2,
        }} />
      )}
      <span>{icon}</span>{label}
      {badge > 0 && (
        <span style={{
          background: "linear-gradient(135deg,#be185d,#ec4899)", color: "#fff", fontSize: 9, fontWeight: 700,
          padding: "1px 7px", borderRadius: 10, fontFamily: "'DM Mono',monospace",
          animation: "pulse 2s ease-in-out infinite",
        }}>{badge}</span>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPARE GROUP
═══════════════════════════════════════════════════════════════════ */
function CompareGroup({ group, index }) {
  const cheapest = getCheapest(group);
  const prices = group.map(p => p.price || 0);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const saving = maxPrice - minPrice;
  const [vis, setVis] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.1 });
    if (ref.current) ob.observe(ref.current);
    return () => ob.disconnect();
  }, []);

  return (
    <div ref={ref} style={{
      background: "linear-gradient(160deg, rgba(255,240,248,0.03), rgba(255,255,255,0.01))",
      border: "1px solid rgba(244,114,182,0.09)",
      borderRadius: 24, padding: "24px 24px 24px",
      opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(28px)",
      transition: `opacity .55s ${index * 0.12}s, transform .55s ${index * 0.12}s cubic-bezier(.34,1.2,.64,1)`,
      marginBottom: 18,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "rgba(255,220,235,0.88)", fontFamily: "'Nunito',sans-serif" }}>
            {group[0].title?.slice(0, 70)}{(group[0].title?.length || 0) > 70 ? "…" : ""}
          </h3>
          <p style={{ margin: "5px 0 0", fontSize: 10, color: "rgba(249,168,212,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: 1 }}>
            {group.length} STORES COMPARED
          </p>
        </div>
        {saving > 1 && (
          <div style={{
            padding: "8px 18px",
            background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.3)",
            borderRadius: 20, fontSize: 12, fontWeight: 700, color: "#f472b6",
            fontFamily: "'DM Mono',monospace", letterSpacing: 0.5,
          }}>
            SAVE ${saving.toFixed(2)}
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
        {group.map((p, pi) => (
          <ProductCard key={pi} p={p} isBest={p.price === cheapest.price}
            minPrice={minPrice} maxPrice={maxPrice} delay={pi * 0.07} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FILTER CHIP
═══════════════════════════════════════════════════════════════════ */
function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 15px", borderRadius: 20,
      border: `1px solid ${active ? "#ec4899" : "rgba(244,114,182,0.14)"}`,
      background: active ? "rgba(236,72,153,0.14)" : "rgba(255,240,248,0.03)",
      color: active ? "#f472b6" : "rgba(249,168,212,0.4)",
      cursor: "pointer", fontSize: 10, fontWeight: 700,
      fontFamily: "'DM Mono',monospace", letterSpacing: 0.8,
      transition: "all .2s",
    }}>{label}</button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOADING SCREEN
═══════════════════════════════════════════════════════════════════ */
function Loader() {
  const [step, setStep] = useState(0);
  const steps = ["Browsing Amazon shelves…", "Scanning Flipkart…", "AI analysing deals…", "Packing your results…"];
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 700);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0d0510" }}>
      <div style={{ position: "relative", width: 96, height: 96, marginBottom: 36 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: "absolute", inset: i * 10, borderRadius: "50%",
            border: "1.5px solid transparent",
            borderTopColor: `rgba(236,72,153,${1 - i * 0.28})`,
            animation: `spin ${1 + i * 0.4}s linear infinite ${i % 2 ? "reverse" : ""}`,
          }} />
        ))}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🛍</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Nunito',sans-serif", letterSpacing: 1, marginBottom: 6 }}>
        <span style={{ color: "#fff" }}>Price</span><span style={{ color: "#ec4899" }}>Pulse</span>
      </div>
      <div style={{ fontSize: 10, color: "rgba(249,168,212,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: 2.5, marginBottom: 22 }}>
        AI SHOPPING INTELLIGENCE
      </div>
      <div style={{ fontSize: 11.5, color: "rgba(249,168,212,0.45)", fontFamily: "'Nunito',sans-serif", height: 20, transition: "all .3s" }}>
        {steps[step]}
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 28 }}>
        {steps.map((_, i) => (
          <div key={i} style={{
            width: i <= step ? 28 : 8, height: 8, borderRadius: 4,
            background: i <= step ? "linear-gradient(90deg, #be185d, #ec4899)" : "rgba(255,255,255,0.07)",
            transition: "all .4s cubic-bezier(.34,1.4,.64,1)",
            boxShadow: i <= step ? "0 0 10px rgba(236,72,153,0.55)" : "none",
          }} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CURSOR GLOW
═══════════════════════════════════════════════════════════════════ */
function CursorGlow() {
  const mouse = useMouse();
  return (
    <div style={{
      position: "fixed", pointerEvents: "none", zIndex: 9999,
      left: mouse.x - 200, top: mouse.y - 200,
      width: 400, height: 400, borderRadius: "50%",
      background: "radial-gradient(circle, rgba(236,72,153,0.06) 0%, rgba(168,85,247,0.02) 50%, transparent 70%)",
      transition: "left .1s linear, top .1s linear",
    }} />
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const [products, setProducts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("compare");
  const [sort, setSort] = useState("dealScore");
  const [filterStore, setFilterStore] = useState("all");
  const [stats, setStats] = useState({ total: 0, hot: 0, alerts: 0, avg: 0 });

  useEffect(() => {
    axios
      .get(`${BACKEND}/api/products/search-multi-api?q=phone&pages=3`)
      .then(res => {
        const data = res.data;
        setProducts(data);
        setGroups(groupProducts(data));
        setStats({
          total: data.length,
          hot: data.filter(p => p.dealScore >= 8).length,
          alerts: data.filter(p => p.priceDropAlert?.hasAlert).length,
          avg: (data.reduce((s, p) => s + (p.dealScore || 0), 0) / (data.length || 1)).toFixed(1),
        });
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <Loader />;
  if (error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0d0510", fontFamily: "'DM Mono',monospace" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: "#f43f5e", fontSize: 15, marginBottom: 8, fontFamily: "'Nunito',sans-serif", fontWeight: 700 }}>Connection Failed</div>
        <div style={{ color: "rgba(249,168,212,0.4)", fontSize: 11 }}>{error}</div>
        <div style={{ color: "rgba(249,168,212,0.22)", fontSize: 10, marginTop: 10 }}>Make sure <code style={{ color: "#f472b6" }}>node server.js</code> is running</div>
      </div>
    </div>
  );

  const stores = [...new Set(products.map(p => p.website).filter(Boolean))];
  const alertProducts = products.filter(p => p.priceDropAlert?.hasAlert);
  const hotProducts = products.filter(p => p.dealScore >= 8);

  let filtered = products
    .filter(p => p.title?.toLowerCase().includes(search.toLowerCase()))
    .filter(p => filterStore === "all" || p.website === filterStore)
    .sort((a, b) => {
      if (sort === "dealScore") return (b.dealScore || 0) - (a.dealScore || 0);
      if (sort === "price-asc") return (a.price || 0) - (b.price || 0);
      if (sort === "price-desc") return (b.price || 0) - (a.price || 0);
      if (sort === "rating") return (b.rating || 0) - (a.rating || 0);
      return 0;
    });

  const filteredGroups = groups.filter(g => g[0].title?.toLowerCase().includes(search.toLowerCase()));
  const globalMin = Math.min(...filtered.map(p => p.price || 0));
  const globalMax = Math.max(...filtered.map(p => p.price || 0));

  return (
    <div style={{ minHeight: "100vh", background: "#0d0510", color: "#fff", fontFamily: "'Nunito', sans-serif", overflowX: "hidden" }}>
      <CursorGlow />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Playfair+Display:ital,wght@1,700&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes dropIn { from { opacity:0; transform:translateY(-8px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes saleWiggle { 0%,100%{transform:rotate(-3deg) scale(1)} 50%{transform:rotate(3deg) scale(1.08)} }
        @keyframes heartbeat { 0%,100%{transform:scale(1)} 40%{transform:scale(1.2)} 60%{transform:scale(0.95)} }
        * { box-sizing: border-box; margin:0; padding:0; }
        body { background: #0d0510; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0d0510; }
        ::-webkit-scrollbar-thumb { background: rgba(236,72,153,.25); border-radius: 4px; }
        ::selection { background: rgba(236,72,153,.28); }
      `}</style>

      {/* Ambient blobs */}
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -250, left: "5%", width: 650, height: 650, borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,.05) 0%, transparent 65%)" }} />
        <div style={{ position: "absolute", top: 350, right: "-12%", width: 550, height: 550, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,.04) 0%, transparent 65%)" }} />
        <div style={{ position: "absolute", top: "60%", left: "30%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(244,114,182,.025) 0%, transparent 65%)" }} />
        {/* diagonal stripe texture */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.022 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="diag" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
              <line x1="0" y1="0" x2="0" y2="40" stroke="#f472b6" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diag)" />
        </svg>
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* ── HEADER ── */}
        <header style={{ borderBottom: "1px solid rgba(244,114,182,0.08)", padding: "22px 28px 0" }}>
          <div style={{ maxWidth: 1320, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ec4899", boxShadow: "0 0 10px #ec4899", animation: "heartbeat 2s ease-in-out infinite" }} />
                  <span style={{ fontSize: 9, color: "#ec4899", fontFamily: "'DM Mono',monospace", letterSpacing: 2 }}>LIVE · REAL-TIME PRICES</span>
                </div>
                <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: 0, fontFamily: "'Nunito',sans-serif", lineHeight: 1, color: "#fff" }}>
                  Price<span style={{ color: "#ec4899", fontStyle: "italic", fontFamily: "'Playfair Display',serif" }}>Pulse</span>
                </h1>
                <p style={{ fontSize: 9.5, color: "rgba(249,168,212,0.28)", fontFamily: "'DM Mono',monospace", letterSpacing: 2.5, marginTop: 5 }}>
                  AI-POWERED · MULTI-STORE COMPARISON
                </p>
              </div>
              <SearchBar value={search} onChange={setSearch} products={products} />
            </div>

            <div style={{ display: "flex", gap: 2, overflowX: "auto", paddingBottom: 0 }}>
              <NavTab id="compare" active={view === "compare"} onClick={setView} icon="⇄" label="COMPARE" />
              <NavTab id="all" active={view === "all"} onClick={setView} icon="◉" label="ALL DEALS" />
              <NavTab id="alerts" active={view === "alerts"} onClick={setView} icon="◎" label="ALERTS" badge={stats.alerts} />
              <NavTab id="ai" active={view === "ai"} onClick={setView} icon="◈" label="AI INSIGHTS" />
            </div>
          </div>
        </header>

        {/* ── STATS BAR ── */}
        <div style={{ padding: "16px 28px", borderBottom: "1px solid rgba(244,114,182,0.05)" }}>
          <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatBox icon="💜" label="PRODUCTS" value={stats.total} accent="rgba(255,220,235,0.85)" />
            <StatBox icon="🔥" label="HOT DEALS" value={stats.hot} accent="#f43f5e" />
            <StatBox icon="🔔" label="LIVE ALERTS" value={stats.alerts} accent="#f472b6" />
            <StatBox icon="♥" label="AVG SCORE" value={stats.avg} suffix="/10" accent="#c084fc" />
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <main style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 28px 60px" }}>

          {view === "compare" && (
            <div style={{ animation: "fadeUp .3s both" }}>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Nunito',sans-serif", color: "rgba(255,220,235,0.85)" }}>
                  {filteredGroups.length} product groups found
                </div>
                <div style={{ fontSize: 10.5, color: "rgba(249,168,212,0.3)", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>
                  Same product · Multiple stores · Best deal highlighted
                </div>
              </div>
              {filteredGroups.length === 0 && (
                <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(249,168,212,0.15)", fontFamily: "'Nunito',sans-serif" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🛍</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>No matching products found</div>
                </div>
              )}
              {filteredGroups.map((g, i) => <CompareGroup key={i} group={g} index={i} />)}
            </div>
          )}

          {view === "all" && (
            <div style={{ animation: "fadeUp .3s both" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Nunito',sans-serif", color: "rgba(255,220,235,0.75)" }}>
                  {filtered.length} products available
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Chip label="ALL" active={filterStore === "all"} onClick={() => setFilterStore("all")} />
                  {stores.map(s => <Chip key={s} label={s.replace(".com", "").toUpperCase()} active={filterStore === s} onClick={() => setFilterStore(s)} />)}
                  <div style={{ width: 1, background: "rgba(244,114,182,0.1)", margin: "0 4px" }} />
                  {[["dealScore", "BEST DEAL"], ["price-asc", "CHEAPEST"], ["price-desc", "PRICIEST"], ["rating", "TOP RATED"]].map(([v, l]) => (
                    <Chip key={v} label={l} active={sort === v} onClick={() => setSort(v)} />
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))", gap: 16 }}>
                {filtered.map((p, i) => <ProductCard key={i} p={p} isBest={false} minPrice={globalMin} maxPrice={globalMax} delay={Math.min(i * 0.035, 0.5)} />)}
              </div>
            </div>
          )}

          {view === "alerts" && (
            <div style={{ animation: "fadeUp .3s both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ec4899", boxShadow: "0 0 14px #ec4899", animation: "heartbeat 1.5s ease-in-out infinite" }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Nunito',sans-serif", color: "#f9a8d4" }}>
                    {alertProducts.length} Live Price Alerts
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(249,168,212,0.3)", marginTop: 3, fontFamily: "'DM Mono',monospace" }}>AI-predicted drops based on discount patterns</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))", gap: 16 }}>
                {alertProducts
                  .filter(p => p.title?.toLowerCase().includes(search.toLowerCase()))
                  .map((p, i) => <ProductCard key={i} p={p} isBest={false} minPrice={0} maxPrice={9999} delay={i * 0.05} />)}
              </div>
            </div>
          )}

          {view === "ai" && (
            <div style={{ animation: "fadeUp .3s both" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
                {[
                  { icon: "🔥", label: "HOT DEALS", val: `${hotProducts.length}`, sub: "Score ≥ 8/10", color: "#f43f5e" },
                  { icon: "📉", label: "PRICE DROPS", val: `${products.filter(p => p.pricePrediction?.willDrop).length}`, sub: "Expected this week", color: "#a78bfa" },
                  { icon: "♥", label: "AVG DEAL SCORE", val: `${stats.avg}/10`, sub: "AI-calculated", color: "#f472b6" },
                  { icon: "💰", label: "BIGGEST SAVING", val: `$${Math.max(...groups.map(g => { const pr = g.map(p => p.price||0); return Math.max(...pr)-Math.min(...pr); })).toFixed(0)}`, sub: "Cross-store gap", color: "#c084fc" },
                ].map((c, i) => (
                  <div key={i} style={{
                    background: `linear-gradient(160deg, ${c.color}12, ${c.color}04)`,
                    border: `1px solid ${c.color}22`, borderRadius: 20, padding: "22px 24px",
                    animation: `fadeUp .4s ${i * 0.08}s both`,
                    transition: "transform .2s, box-shadow .2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 30px ${c.color}20`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{ fontSize: 26, marginBottom: 12 }}>{c.icon}</div>
                    <div style={{ fontSize: 9, color: "rgba(249,168,212,0.3)", fontFamily: "'DM Mono',monospace", letterSpacing: 1.5, marginBottom: 5 }}>{c.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: c.color, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{c.val}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,200,225,0.35)", marginTop: 7, fontFamily: "'Nunito',sans-serif" }}>{c.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: "linear-gradient(160deg, rgba(244,63,94,0.06), rgba(255,255,255,0.01))", border: "1px solid rgba(244,63,94,0.14)", borderRadius: 24, padding: 26, marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <span style={{ fontSize: 20 }}>🔥</span>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#f43f5e", fontFamily: "'DM Mono',monospace", letterSpacing: 1.5 }}>TOP HOT DEALS</div>
                    <div style={{ fontSize: 11, color: "rgba(249,168,212,0.3)", fontFamily: "'Nunito',sans-serif" }}>Score ≥ 8 out of 10</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))", gap: 14 }}>
                  {hotProducts.slice(0, 8).map((p, i) => <ProductCard key={i} p={p} isBest={false} minPrice={0} maxPrice={9999} delay={i * 0.05} />)}
                </div>
              </div>

              <div style={{ background: "linear-gradient(160deg, rgba(168,85,247,0.06), rgba(255,255,255,0.01))", border: "1px solid rgba(168,85,247,0.14)", borderRadius: 24, padding: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <span style={{ fontSize: 20 }}>💜</span>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#a855f7", fontFamily: "'DM Mono',monospace", letterSpacing: 1.5 }}>BEST VALUE PICKS</div>
                    <div style={{ fontSize: 11, color: "rgba(249,168,212,0.3)", fontFamily: "'Nunito',sans-serif" }}>High rating + stable price</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))", gap: 14 }}>
                  {products.filter(p => !p.pricePrediction?.willDrop && (p.rating || 0) >= 4 && (p.dealScore || 0) >= 6).slice(0, 8).map((p, i) => (
                    <ProductCard key={i} p={p} isBest={false} minPrice={0} maxPrice={9999} delay={i * 0.05} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}