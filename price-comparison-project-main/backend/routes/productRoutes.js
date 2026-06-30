import express from "express";
import { searchMultiAPI, getProductById } from "../controllers/productController.js";

const router = express.Router();

router.get("/search-multi-api", searchMultiAPI);
router.get("/:id", getProductById);

export default router;