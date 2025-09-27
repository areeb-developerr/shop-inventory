// routes/customerRoutes.js
const express = require("express");
const {
  list,
  getOne,
  create,
  update,
  remove,
} = require("../controllers/customerController");

const router = express.Router();

router.get("/", list);
router.get("/:id", getOne);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

module.exports = router;
