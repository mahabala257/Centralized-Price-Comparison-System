import axios from "axios";

const API_BASE_URL = "http://localhost:5000/api/products";

export const getProducts = async () => {
  try {
    const res = await axios.get(API_BASE_URL);
    return res.data;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export const searchProducts = async (query) => {
  try {
    const res = await axios.get(`${API_BASE_URL}/search?name=${query}`);
    return res.data;
  } catch (error) {
    console.error(error);
    return [];
  }
};