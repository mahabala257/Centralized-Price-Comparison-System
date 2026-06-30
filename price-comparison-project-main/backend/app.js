const productRoutes = require("./routes/productRoutes");
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", productRoutes);

app.get("/", (req, res) => {
    res.send("Price Comparison API Running");
});

module.exports = app;