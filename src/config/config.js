import dotenv from 'dotenv';
dotenv.config();

const config = {
  MONGO_URI:process.env.MONGO_URI,
  JWT_SECRET:process.env.JWT_SECRET,
  EMAIL_USER:process.env.EMAIL_USER,
  CLIENT_ID:process.env.CLIENT_ID,
  CLIENT_SECRET:process.env.CLIENT_SECRET,
  REFRESH_TOKEN:process.env.REFRESH_TOKEN
}

export default config;