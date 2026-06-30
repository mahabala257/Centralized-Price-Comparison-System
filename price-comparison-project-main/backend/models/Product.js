import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  title: String,
  brand: String,
  price: Number,
  originalPrice: Number,
  website: String,
  productLink: String,
  image: String,
  rating: Number,
  numRatings: Number,
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("Product", ProductSchema);