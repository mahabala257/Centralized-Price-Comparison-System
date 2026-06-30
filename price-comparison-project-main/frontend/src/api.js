import axios from "axios";

export const getProducts = async () => {
  const res = await axios.get("http://localhost:5000/api/products/");
  return res.data;
};

export const searchProductsMultiAPI = async (query) => {
  const res = await axios.get(
    `http://localhost:5000/api/products/search-multi-api?query=${query}`
  );
  return res.data;
};