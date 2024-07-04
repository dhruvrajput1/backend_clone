import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";

const getChannelStats = asyncHandler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const userId = req.user?._id;

    const totalSubscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $group: {
                _id: null,
                subscribersCount: {
                    $sum: 1
                }
            }
        }
    ]);

    const video = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $project: {
                totalLikes: {
                    $size: "$likes"
                },
                totalViews: "$views",
                totalVideos: 1
            }
        },
        {
            $group: {
                _id: null,
                totalLikes: {
                    $sum: "$totalLikes"
                },
                totalViews: {
                    $sum: "$totalViews"
                },
                totalVideos: {
                    $sum: 1
                }
            }
        }
    ]);

    const channelStats = {
        totalSubscribers: totalSubscribers[0]?.subscribersCount || 0,
        totalLikes: video[0]?.totalLikes || 0,
        totalViews: video[0]?.totalViews || 0,
        totalVideos: video[0]?.totalVideos || 0
    };

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channelStats,
                "channel stats fetched successfully"
            )
        );
});

const getChannelVideos = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user Id");
    }

    try {

        const userVideos = await Video.find({
            owner: userId
        });

        // if(!userVideos.length) {
        //     throw new ApiError(404, "Channel has no videos");
        // }

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