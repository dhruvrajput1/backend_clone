import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
                      
app.use(cors({  // use is used in handling middlewares and configuratons
    origin: process.env.CORS_ORIGIN,
    credentials: true
})); 

app.use(express.json({limit: "20kb"})); // when data comes in form of JSON
app.use(express.urlencoded({extended: true, limit: "20kb"})); // when data comes in form of link string
app.use(express.static("public")); // used to store images and files
app.use(cookieParser()); // it is used to read and update the cookies stored in user browser


// import routes
import userRouter from "./routes/user.routes.js";

// routes declaration
// app.use("/users", userRouter);

// more better to use with api version
app.use("/api/v1/users", userRouter);


// https://localhost:8000/users/register
// https://localhost:8000/users/login
// -> this will go like this


export {app};