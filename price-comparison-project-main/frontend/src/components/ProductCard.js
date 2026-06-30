import React from "react";

const ProductCard = ({ product, lowestPrice }) => {
  const isLowest = product.price === lowestPrice;

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: "10px", padding: "10px", margin: "10px", width: "250px", textAlign: "center" }}>
      <img src={product.image} alt={product.name} style={{ width: "200px", height: "200px", objectFit: "contain" }} />
      <h3>{product.name}</h3>
      <p>Brand: {product.brand}</p>
      <p style={{ fontWeight: isLowest ? "bold" : "normal", color: isLowest ? "green" : "black" }}>
        {product.website} - ₹{product.price} {isLowest && "⭐ Best Price"}
      </p>
      <a href={product.productLink} target="_blank" rel="noopener noreferrer">
        <button style={{ padding: "5px 10px", borderRadius: "5px", backgroundColor: "#6c63ff", color: "white", border: "none" }}>
          Buy Now
        </button>
      </a>
    </div>
  );
};

export default ProductCard;