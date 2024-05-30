import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path: "./.env"
});

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is live and running on port ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("error in connectDB in main index file: " + err.message);
})

