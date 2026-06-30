import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import SearchBar from "../components/SearchBar";
import ProductCard from "../components/ProductCard";
import { getProducts, searchProducts } from "../services/api";

const Home = () => {
  const [products, setProducts] = useState([]);
  const [lowestPrice, setLowestPrice] = useState(0);

  const fetchAllProducts = async () => {
    const data = await getProducts();
    setProducts(data);
    updateLowestPrice(data);
  };

  const handleSearch = async (query) => {
    if (!query) {
      fetchAllProducts();
      return;
    }
    const data = await searchProducts(query);
    setProducts(data);
    updateLowestPrice(data);
  };

  const updateLowestPrice = (data) => {
    if (data.length > 0) {
      const minPrice = Math.min(...data.map((p) => p.price));
      setLowestPrice(minPrice);
    } else {
      setLowestPrice(0);
    }
  };

  useEffect(() => {
    fetchAllProducts();
  }, []);

  return (
    <div>
      <Navbar />
      <SearchBar onSearch={handleSearch} />
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
        {products.length > 0 ? products.map((product) => (
          <ProductCard key={product._id} product={product} lowestPrice={lowestPrice} />
        )) : <p>No products found.</p>}
      </div>
    </div>
  );
};

export default Home;