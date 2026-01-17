import mongoose from 'mongoose';

/**
 * Hàm kết nối tới MongoDB
 * Sử dụng async/await để xử lý bất đồng bộ
 */
const connectDB = async () => {
  try {
    // Lấy connection string từ biến môi trường
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/PingMe',
      {
        // Các options để tránh warning deprecated
        // (Mongoose 6+ đã tự động set các option này, nhưng để rõ ràng)
      },
    );

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📦 Database Name: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    // Exit process nếu không kết nối được DB (critical error)
    process.exit(1);
  }
};

// Xử lý các sự kiện connection
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB Disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB Error: ${err}`);
});

export default connectDB;
