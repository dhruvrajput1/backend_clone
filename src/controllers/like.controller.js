import mongoose, {isValidObjectId} from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Like } from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const toggleVideoLike = asyncHandler(async (req, res) => {

    try {
        
        const { videoId } = req.params;
        const userId = await req.user._id;

        if(!isValidObjectId(videoId)) {
            throw new ApiError(400, "Invalid video Id");
        }
        
        const isLiked = await Like.findOne({
            video: videoId,
            likedBy: userId
        });

        let videoLikeStatus;

        if(!isLiked) {
            await Like.create({
                video: videoId,
                likedBy: userId
            })

            videoLikeStatus = { isLiked: true };
        } else {
            await Like.findByIdAndDelete(isLiked._id);

            videoLikeStatus = { isLiked: false };
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, videoLikeStatus, "Like status updated successfully")
        )

    } catch (error) {
        throw new ApiError(500, error.message);
    }
})

const toggleCommentLike = asyncHandler(async (req, res) => {

    const { commentId } = req.params;
    const userId = await req.user._id;

    if(!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment Id");
    }

    if(!userId) {
        throw new ApiError(401, "requested user not found while toggling comment like status");
    }

    try {

        const isLiked = await Like.findOne({
            comment: commentId,
            likedBy: userId
        });

        let commentLikeStatus;

        if(!isLiked) {
            const like = await Like.create({
                comment: commentId,
                likedBy: userId
            })

            commentLikeStatus = { isLiked: true };
        }
        else {
            await Like.findByIdAndDelete(isLiked._id);
            commentLikeStatus = { isLiked: false };
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, commentLikeStatus, "Comment like status updated successfully")
        )

        
    } catch (error) {
        throw new ApiError(500, error.message);
    }

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if(!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet Id");
    }

    const userId = await req.user._id;

    if(!userId) {
        throw new ApiError(401, "requested user not found while toggling tweet like status");
    }

    try {

        const isLiked = await Like.findOne({
            tweet: tweetId,
            likedBy: userId
        });

        let tweetLikeStatus;

        if(!isLiked) {
            const like = await Like.create({
                tweet: tweetId,
                likedBy: userId
            })

            tweetLikeStatus = { isLiked: true };
        }
        else {
            await Like.findByIdAndDelete(isLiked._id);
            tweetLikeStatus = { isLiked: false };
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, tweetLikeStatus, "Tweet like status updated successfully")
        )
        
    } catch (error) {
        throw new ApiError(500, error.message);
    }
})

// get all the videos liked by current user
const getLikedVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id;


    if(!userId) {
        throw new ApiError(401, "requested user not found while fetching liked videos");
    }

    try {

        const likedVideosByUser = await Like.aggregate([
            {
                $match: {
                    likedBy: new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $match: {
                    video: {
                        $exists: true
                    }
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "video",
                    foreignField: "_id",
                    as: "video",
                    pipeline: [
                        {
                            $project: {
                                video: 1,
                                title: 1,
                                description: 1,
                                thumbnail: 1,
                                createdAt: 1,
                                owner: 1,
                                views: 1
                            }
                        },
                        {
                            $lookup: { // getting info about the user from the video
                                from: "users", // look from the users database
                                localField: "owner", // in the video DB
                                foreignField: "_id",
                                as: "owner",
                                pipeline: [
                                    {
                                        $project: {
                                            username: 1,
                                            avatar: 1,
                                            fullName: 1
                                        }
                                    }
                                ]
                                
                            }
                        },
                        {
                            $addFields: {
                                owner: {
                                    $first: "$owner"
                                }
                            }
                        }
                    ]
                }
            },
            
        ]);

        console.log("liked videos ", likedVideosByUser);

        if(!likedVideosByUser) {
            throw new ApiError(404, "No liked videos found");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, likedVideosByUser, "Liked videos fetched successfully")
        )
        
    } catch (error) {
        throw new ApiError(500, error.message);
    }
})

export {
    toggleVideoLike,
    toggleCommentLike,
    toggleTweetLike,
    getLikedVideos
}