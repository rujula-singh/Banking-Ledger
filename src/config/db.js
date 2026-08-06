import mongoose from 'mongoose';
import config from './config.js';

async function connectDB() {
    await mongoose.connect(config.MONGO_URI)
    .then(() => {
      console.log("server is connected to DB");
    })
    .catch(err=> {
      console.log("Error connecting to DB");
      process.exit(1);
    })
}

export default connectDB;