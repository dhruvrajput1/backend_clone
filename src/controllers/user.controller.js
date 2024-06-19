import { asyncHandler } from "../utils/asyncHandler.js" 
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// generating refresh and access tokens
const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false }); // do not change other fields
        return {accessToken, refreshToken};
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}


const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    const {email, username, password, fullName} = req.body;
    console.log(email, username, fullName);

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
    const isPasswordValid = await user.isPasswordCorrect(password);

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

    await User.findByIdAndUpdate(userId, {$unset: {refreshToken: 1}}); // this removes the field from document

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
    console.log(req.cookies);
    console.log(req.body);
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request of refresh token");
    }


    // verify this token
    try {
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
    
        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

        console.log("new refresh token", refreshToken);
        console.log("new access token", accessToken);
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
            200,
            {accessToken, refreshToken: refreshToken},
            "access token refreshed successfully"
            )
        )
    } catch (error) {
        console.log(error);
        throw new ApiError(401, error.message || "Invalid refresh token");
        
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body;

    console.log(req.body);

    const userId = await req.user?._id;
    const user = await User.findById(userId);

    if(!user) {
        throw new ApiError(404, "User not found");
    }

    const isPassCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPassCorrect) {
        throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Password updated successfully")
    )
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body;

    if(!fullName || !email) {
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {fullName: fullName, email: email}
        },
        {new: true}
    ).select("-password");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "account details updated successfully"));
})

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar image is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url) {
        throw new ApiError(400, "Avatar image is not uploaded");
    }

    const user = await User.findByIdAndUpdate(req.user._id, {$set: {avatar: avatar.url}}, {new: true}).select("-password");
    
    return res
    .status(200)
    .json(new ApiResponse(200, user, "user avatar updated successfully"));
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath) {
        throw new ApiError(400, "Cover image is required");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url) {
        throw new ApiError(400, "Cover image is not uploaded");
    }

    const user = await User.findByIdAndUpdate(req.user._id, {$set: {coverImage: coverImage.url}}, {new: true}).select("-password");
    
    return res
    .status(200)
    .json(new ApiResponse(200, user, "user cover image updated successfully"));
})

const getUserCurrentProfile = asyncHandler(async(req, res) => { // channel profile
    const {username} = req.params; // coming from the url

    if(!username?.trim()) {
        throw new ApiError(400, "Username is required");
    }

    const channel = await User.aggregate([ // aggregation pipeline
        { // 1st pipeline
            $match: {
                username: username?.toLowerCase()
            } 
        },
        { // 2nd pipeline
            $lookup: { 
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        { // 3rd pipeline
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscriberdTo"
            }
        },
        { // 4th pipeline
            $addFields: { // added these extra fields to user database
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscriberdToCount: {
                    $size: "$subscriberdTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$subscribers.subscriber"] // checking for subscriber in subscribers
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        { // 5th pipeline
            $project: { // fields which we want to show
                username: 1,
                fullName: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscriberdToCount: 1,
                isSubscribed: 1
            }
        }
    ])

    if(!channel?.length) {
        throw new ApiError(404, "channel does not exists");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        { 
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [ // because we have again user in videos
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [ // because we do not want all fields of user
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    { // instead of giving array of videos, giving object
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200, user[0].watchHistory, "User watch history fetched successfully")
    )
})

export {
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails, 
    updateUserAvatar, 
    updateUserCoverImage,
    getUserCurrentProfile,
    getWatchHistory
};