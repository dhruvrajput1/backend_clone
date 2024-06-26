import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.model.js";

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const userId = await req.user._id;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel Id");
    }

    let subscriptionStatus;

    try {

        const subscription = await Subscription.findOne({
            subscriber: userId,
            channel: channelId
        });
        
        if(!subscription) {
            await Subscription.create({
                subscriber: userId,
                channel: channelId
            });
            subscriptionStatus: {isSubscribed: true}
        }
        else {
            await Subscription.deleteOne({
                subscriber: userId,
                channel: channelId
            });

            subscriptionStatus: {isSubscribed: false}
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, subscriptionStatus, "Subscription status updated successfully")
        )


        
    } catch (error) {
        throw new ApiError(500, `error while creating a toggling subscription ${error.message}`);
    }
})


// return the subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params;

    if(!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel Id");
    }

    try {

        const subscribers = await Subscription.aggregate([
            {
                $match: {
                    channel: channelId,
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "subscriber",
                    foreignField: "_id",
                    as: "subscriber",
                    pipeline: [
                        {
                            $lookup: {
                                from: "subscriptions",
                                localField: "_id",
                                foreignField: "channel",
                                as: "subscribedToSubscriber",
                            },
                        },
                        {
                            $addFields: {
                                subscribedToSubscriber: {
                                    $cond: {
                                        if: {
                                            $in: [
                                                channelId,
                                                "$subscribedToSubscriber.subscriber",
                                            ],
                                        },
                                        then: true,
                                        else: false,
                                    },
                                },
                                subscribersCount: {
                                    $size: "$subscribedToSubscriber",
                                },
                            },
                        },
                    ],
                },
            },
            {
                $unwind: "$subscriber",
            },
            {
                $project: {
                    _id: 0,
                    subscriber: {
                        _id: 1,
                        username: 1,
                        fullName: 1,
                        "avatar.url": 1,
                        subscribedToSubscriber: 1,
                        subscribersCount: 1,
                    },
                },
            },
        ]);

        return res
        .status(200)
        .json(
            new ApiResponse(200, subscribers, "Subscribers fetched successfully")
        )
        
    } catch (error) {
        throw new ApiError(500, `error while fetching subscribers of a channel ${error.message}`);
    }
})


const getSubscribedChannels = asyncHandler(async (req, res) => {
    const userId = await req.user._id;

    try {

        const subscribedChannels = await Subscription.aggregate(
            [
                {
                    $match: {
                        subscriber: new mongoose.Types.ObjectId(subscriberId)
                    }
                },
    
                {
                    $lookup: {
                        from: "users",
                        localField: "channel",
                        foreignField: "_id",
                        as: "subscribedTo",
                        pipeline: [
                            {
                                $project: {
                                    fullName: 1,
                                    username: 1,
                                    isSubscribed: 1
                                }
                            }
                        ]
                    }
                },
    
                {
                    $addFields: {
                        subscribedTo: {
                            $first: "$subscribedTo"
                        }
                    }
                }
            ]
        )

        if(!subscribedChannels.length) {
            throw new ApiError(404, "User has no subscribed channels");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, subscribedChannels, "Subscribed channels fetched successfully")
        )
        
    } catch (error) {
        throw new ApiError(500, `error while fetching subscribed channels ${error.message}`);
    }
})




export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}