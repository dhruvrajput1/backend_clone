import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
                      
app.use(cors({  // use is used in handling middlewares and configuratons
    origin: process.env.CORS_ORIGIN,
    credentials: true
})); 

app.use(express.json({limit: "90mb"})); // when data comes in form of JSON
app.use(express.urlencoded({extended: true, limit: "90mb"})); // when data comes in form of link string
app.use(express.static("public")); // used to store images and files
app.use(cookieParser()); // it is used to read and update the cookies stored in user browser


// import routes
import userRouter from "./routes/user.routes.js";
import commentRouter from "./routes/comment.routes.js";
import videoRouter from "./routes/video.routes.js";
import likeRouter from "./routes/like.routes.js";
import tweetRouter from "./routes/tweet.routes.js"; 
import playlistRouter from "./routes/playlist.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import healthCheckRouter from "./routes/healthCheck.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";

// routes declaration
// app.use("/users", userRouter);

// more better to use with api version
app.use("/api/v1/users", userRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/likes", likeRouter);
app.use("/api/v1/tweets", tweetRouter);
app.use("/api/v1/playlists", playlistRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/healthcheck", healthCheckRouter);
app.use("/api/v1/dashboard", dashboardRouter);



// https://localhost:8000/users/register
// https://localhost:8000/users/login
// -> this will go like this


export {app};