// routes/billRoutes.js
const express = require("express");
const { list, getOne, create, remove } = require("../controllers/billController");

const router = express.Router();

router.get("/", list);
router.get("/:id", getOne);
router.post("/", create);
router.delete("/:id", remove);

module.exports = router;
