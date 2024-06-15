import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";

const getChannelStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user Id");
    }

    try {

        const user = await User.findById(userId);

        if(!user) {
            throw new ApiError(404, "User not found");
        }

        const totalSubscribers = await Subscription.countDocuments({
            channel: userId
        });

        const totalVideos = await Video.countDocuments({
            owner: userId
        });

        const totalVideosViews = await Video.aggregate(
            [
                {
                    $match: {
                        owner: new mongoose.Types.ObjectId(userId)
                    }
                },
                {
                    $match: {
                        views: {
                            $gt: 0
                        }
                    }
                },
                {
                    $group: {
                        _id: "$views",
                        totalViews: {
                            $sum: "$views"
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalViews: 1
                    }
                }
            ]
        )

        const totalVideos_Views = totalVideosViews[0].totalViews;

        if(!totalVideosViews) {
            throw new ApiError(404, "No videos found while fetching total views");
        }
    
        //Total Likes on Videos
        const totalVideosLikes = await Like.aggregate(
            [
                {
                    $lookup: {
                        from: "videos",
                        localField: "video",
                        foreignField: "_id",
                        as: "allVideos",
                    }
                },
                {
                    $unwind: "$allVideos" //can use addFields->first also 
                },
                {
                    $match: {
                        "allVideos.owner": new mongoose.Types.ObjectId(req.user?._id)
                    }
                },
                {
                    $group: {
                        _id: null,  //means Single group
                        totalVideosLikes: {
                            $sum: 1 //count all the Input Documents in pipeline
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalVideosLikes: 1
                    }
                },
            ]
        )

        const totalVideos_Likes = totalVideosLikes[0].totalVideosLikes;

        const channelStats = {
            totalSubscribers,
            totalVideos,
            totalVideos_Views,
            totalVideos_Likes
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, channelStats, "Stats fetched successfully")
        )
        
    } catch (error) {
        throw new ApiError(500, `error while fetching stats of a channel ${error.message}`);
    }
})

const getChannelVideos = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user Id");
    }

    try {

        const userVideos = await Video.find({
            owner: userId
        });

        if(!userVideos.length) {
            throw new ApiError(404, "Channel has no videos");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, userVideos, "Videos fetched successfully")
        )
        
    } catch (error) {
        throw new ApiError(500, `error while fetching videos of a channel ${error.message}`);
    }


})


export {
    getChannelVideos,
    getChannelStats
}