import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";

const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;
    const userId = await req.user._id;

    try {

        if(!content) {
            throw new ApiError(400, "Content is required");
        }
    
        const tweet = await Tweet.create({
            content,
            owner: userId
        });

        return res
        .status(201)
        .json(
            new ApiResponse(201, tweet, "Tweet created successfully")
        )
        
    } catch (error) {
        throw new ApiError(500, `error while creating a new tweet ${error.message}`);
    }

})

const getUserTweets = asyncHandler(async (req, res) => {

    const { userId } = req.params;

    if(!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user Id");
    }

    try {

        const userTweets = await Tweet.aggregate([
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId),
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "ownerDetails",
                    pipeline: [
                        {
                            $project: {
                                username: 1,
                                avatar: 1,
                            },
                        },
                    ],
                },
            },
            {
                $lookup: {
                    from: "likes",
                    localField: "_id",
                    foreignField: "tweet",
                    as: "likeDetails",
                    pipeline: [
                        {
                            $project: {
                                likedBy: 1,
                            },
                        },
                    ],
                },
            },
            {
                $addFields: {
                    likesCount: {
                        $size: "$likeDetails",
                    },
                    ownerDetails: {
                        $first: "$ownerDetails",
                    },
                    isLiked: {
                        $cond: {
                            if: {$in: [req.user?._id, "$likeDetails.likedBy"]},
                            then: true,
                            else: false
                        }
                    }
                },
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $project: {
                    content: 1,
                    ownerDetails: 1,
                    likesCount: 1,
                    createdAt: 1,
                    isLiked: 1
                },
            },
        ]);

        if(!userTweets.length) {
            throw new ApiError(404, "User has no tweets");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, userTweets, "User tweets fetched successfully")
        )

        
    } catch (error) {
        throw new ApiError(500, `error while fetching user tweets ${error.message}`);
    }

})


const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    const { content } = req.body;

    if(!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet Id");
    }

    try {

        const tweet = await Tweet.findById(tweetId);

        if(!tweet) {
            throw new ApiError(404, "Tweet not found");
        }

        if(tweet.owner.toString()!== req.user._id.toString()) {
            throw new ApiError(401, "You are not authorized to update this tweet");
        }

        const updatedTweet = await Tweet.findByIdAndUpdate(tweetId, {
            content
        });

        if(!updateTweet) {
            throw new ApiError(404, "can not update tweet");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, updatedTweet, "Tweet updated successfully")
        )

        
    } catch (error) {

        throw new ApiError(500, `error while updating tweet ${error.message}`);
        
    }
})

const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if(!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet Id");
    }

    try {

        const tweet = await Tweet.findById(tweetId);

        if(!tweet) {
            throw new ApiError(404, "Tweet not found");
        }

        if(tweet.owner.toString()!== req.user._id.toString()) {
            throw new ApiError(401, "You are not authorized to delete this tweet");
        }

        await Tweet.findByIdAndDelete(tweetId);

        return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Tweet deleted successfully")
        )
        
    } catch (error) {
        throw new ApiError(500, `error while deleting tweet ${error.message}`);
    }
})


export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}
