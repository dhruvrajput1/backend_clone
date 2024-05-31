import { asyncHandler } from "../utils/asyncHandler.js" 
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { response } from "express";


// generating refresh and access tokens
const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false}); // do not check for password and other credentials, only save refresh token

        return {accessToken, refreshToken};

    } catch (error) {
        throw new ApiError(500, "something went wrong while generating refresh and access token");
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
    if(!email || !username) {
        throw new ApiError(400, "username or email is required");
    }

    // find the user
    const user = await User.findOne({$or: {email, username}});

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
        200,
        {
            user: loggedInUser, accessToken, refreshToken
        },
        "Logged in successfully"
    )
})

export {registerUser, loginUser};