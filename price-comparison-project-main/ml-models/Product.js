const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  brand: {
    type: String
  },
  price: {
    type: Number,
    required: true
  },
  website: {
    type: String
  },
  productLink: {
    type: String
  },
  image: {
    type: String
  }
});

module.exports = mongoose.model("Product", productSchema);