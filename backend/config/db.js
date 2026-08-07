import mongoose from "mongoose";

// Establishes the connection to MongoDB using the URI from environment variables.
// Exits the process if the connection fails, since the API cannot function without a database.
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
