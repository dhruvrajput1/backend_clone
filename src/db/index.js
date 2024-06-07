import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`\n MongoDB connected!! ${connectionInstance.connection.host}`); // connectionInstance stores many information
    } catch (error) {
        console.log("Error in MongoDB connection", error);
        process.exit(1); // exit with error, 0 means exit without error
    }
}

export default connectDB;