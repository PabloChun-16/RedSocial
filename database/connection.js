const mongoose = require('mongoose');
require('dotenv').config(); // Para leer el archivo .env

const connection = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected successfully to MongoDB Atlas');
  } catch (error) {
    console.error('❌ Error connecting to database:', error.message);
    throw new Error('Error connecting to database');
  }
};

module.exports = connection;
