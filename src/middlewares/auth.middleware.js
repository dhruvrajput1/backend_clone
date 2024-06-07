import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

const verifyJWT = asyncHandler(async(req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", ""); // or part is for the mobile browser

        if(!token) {
            throw new ApiError(401, "Unauthorized access");
        }
    
        const decodedTokenInfo = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
        const user = await User.findById(decodedTokenInfo._id).select("-password -refreshToken");
    
        if(!user) {
            throw new ApiError(401, "Invalid access token");
        }
    
        req.user = user; // this req.user will be used in logging out the user
        next();

    } catch (error) {
        throw new ApiError(401, "Invalid access token");
    }

})

export {verifyJWT};