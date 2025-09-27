// routes/productRoutes.js
const express = require("express");
const {
  list,
  getOne,
  create,
  update,
  remove,
  lowStock,
  updateStock,
  bulkUpdate,
  bulkDelete,
} = require("../controllers/productController");

const router = express.Router();

router.get("/", list);
router.get("/low-stock", lowStock);
router.get("/:id", getOne);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

// Inventory adjustments
router.patch("/:id/stock", updateStock);

// Bulk operations
router.patch("/bulk", bulkUpdate);
router.delete("/bulk", bulkDelete);

module.exports = router;
