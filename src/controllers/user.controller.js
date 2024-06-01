import { asyncHandler } from "../utils/asyncHandler.js" 
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

// generating refresh and access tokens
const generateAccessAndRefreshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return {accessToken, refreshToken};
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}


const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    const {email, username, password, fullName} = req.body;
    console.log(email, username, password, fullName);

    // validation - not empty
    if([fullName, email, username, password].some( (field) => field?.trim() === "")) { // if any of the field is empty
        throw new ApiError(400, "All fields are required");
    }

    // check if user already exists (email, username)
    const existedUser = await User.findOne({ $or: [{username}, {email}]});

    if(existedUser) {
        throw new ApiError(409, "User already exists");
    }

    // upload avatar and coverImage to cloudinary (check for avatar)
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;

    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath) {
        throw new ApiError(403, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar) {
        throw new ApiError(400, "Avatar file is required");
    }


    // create user object(to be uploaded on mongoDB)
    const user = await User.create({
        fullName: fullName,
        avatar: avatar?.url,
        coverImage: coverImage?.url || "",
        username: username.toLowerCase(),
        password: password,
        email: email
    });


    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select("-password -refreshToken") // select everything except pass and RT

    // check for user creation
    if(!createdUser) {
        throw new ApiError(409, "User not created");
    }

    // return res
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    );
})

const loginUser = asyncHandler(async(req, res) => {
    // req body -> data
    const {email, username, password} = req.body;

    // username or email (authentication)
    if(!email && !username) {
        throw new ApiError(400, "username or email is required");
    }

    // find the user
    const user = await User.findOne({$or: [{email}, {username}]});


    if(!user) {
        throw new ApiError(404, "User not found");
    }

    // password check
    const isPasswordValid = user.isPasswordCorrect(password);

    if(!isPasswordValid) {
        throw new ApiError(400, "password is incorrect");
    }

    // access and refresh token
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

    // cookies
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken"); // select everything excpet password and refresh token

    const options = {
        httpOnly: true, // now cookie can only be accessed from server side
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200,
        {
            user: loggedInUser, accessToken, refreshToken
        },
        "Logged in successfully"
        ))
})

const logoutUser = asyncHandler(async(req, res) => {
    const userId = req.user._id;

    await User.findByIdAndUpdate(userId, {$set: {refreshToken: undefined}});

    const options = {
        httpOnly: true, // now cookie can only be accessed from server side
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged out successfully")
    )

})

// refresh the access token of user
const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request of refresh token");
    }

    // verify this token
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id);

    if(!user) {
        throw new ApiError(401, "Invalid refresh token");
    }

    if(incomingRefreshToken !== user.refreshToken) {
        throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
        httpOnly: true,
        secure: true
    }

    const {accessToken, newRefreshToken} = await user.generateAccessAndRefreshTokens(user._id);

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
        200,
        {accessToken, refreshToken: newRefreshToken},
        "access token refreshed successfully"
    )
})

export {registerUser, loginUser, logoutUser, refreshAccessToken};