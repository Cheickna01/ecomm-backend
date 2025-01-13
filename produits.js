const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
  id: Number,
  category_id: Number,
  title: String,
  img: String,
  promo: Number,
  price: Number,
  info: String,
  inCart: {
    type: Boolean,
    default: false,
  },
  count: Number,
  total: Number,
  created_at: {
    type: Date,
    default: Date.now(),
  },
});

const Product = mongoose.model("product", ProductSchema);
module.exports = Product;
