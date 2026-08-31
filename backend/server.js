const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/authRoutes");
const verificationRoutes = require('./src/routes/verificationRoutes')
const propertyRoutes = require("./src/routes/propertyRoutes")
const publicRoutes = require('./src/routes/publicRoutes')

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use('/api/v1/properties', propertyRoutes);
app.use('/api/v1/verification', verificationRoutes);
app.use('/api/public', publicRoutes);

connectDB();

app.get("/", (req, res) => {
  res.json({
    message: "HomeLink API is running"
  });
});

const PORT = 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HomeLink server running on port ${PORT}`);
});
