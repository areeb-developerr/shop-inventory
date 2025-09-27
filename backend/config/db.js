// config/db.js
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

function loadEnvForProd() {
  if (process.env.MONGO_URI) return;
  try {
    const prodEnv = path.join(process.resourcesPath || "", ".env");
    if (fs.existsSync(prodEnv)) dotenv.config({ path: prodEnv });
    else dotenv.config();
  } catch {
    dotenv.config();
  }
}
loadEnvForProd();

let connected = false;

async function connectDB() {
  if (connected) return;
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI missing in .env");
  await mongoose.connect(uri, {
    dbName: process.env.MONGO_DBNAME || "shopdb",
  });
  connected = true;
  console.log("MongoDB connected");
}

module.exports = connectDB;
