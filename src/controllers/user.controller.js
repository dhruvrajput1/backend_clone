import { asyncHandler } from "../utils/asyncHandler.js" 
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export {registerUser};