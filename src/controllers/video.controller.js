import mongoose, {isValidObjectId} from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";
import {v2 as cloudinary} from 'cloudinary';

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    const pipeline = [];

    // for using Full Text based search u need to create a search index in mongoDB atlas
    // you can include field mapppings in search index eg.title, description, as well
    // Field mappings specify which fields within your documents should be indexed for text search.
    // this helps in seraching only in title, desc providing faster search results
    // here the name of search index is 'search-videos'
    if (query) {
        pipeline.push({
            $search: {
                index: "search-videos",
                text: {
                    query: query,
                    path: ["title", "description"] //search only on title, desc
                }
            }
        });
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId");
        }

        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    // fetch videos only that are set isPublished as true
    pipeline.push({ $match: { isPublished: true } });

    //sortBy can be views, createdAt, duration
    //sortType can be ascending(-1) or descending(1)
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } else {
        pipeline.push({ $sort: { createdAt: -1 } });
    }

    pipeline.push(
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
                            "avatar": 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerDetails"
        }
    )

    const videoAggregate = Video.aggregate(pipeline);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const video = await Video.aggregatePaginate(videoAggregate, options);

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
    const {title, description} = req.body;

    try {

        const userId = await req.user._id;

        const videoLocalPath = req.files?.videoFile[0].path;
        const thumbnailLocalPath = req.files?.thumbnail[0].path;

        if(!videoLocalPath) {
            throw new ApiError(400, "Video file path is required")
        }

        if(!thumbnailLocalPath) {
            throw new ApiError(400, "Thumbnail file path is required")
        }


        const video = await uploadOnCloudinary(videoLocalPath);
        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

        console.log("thumbnail: : : : : ", thumbnail);


        if (!video) {
            throw new ApiError(400, "Error while uploading Video on cloudinary")
        }
    
        if (!thumbnail) {
            throw new ApiError(400, "Error while uploading Thumbnail on cloudinary")
        }

        const newVideo = await Video.create({
            title: title,
            description: description,
            thumbnail: thumbnail.url,
            videoFile: video.url,
            publicId: video.public_id,
            duration: video.duration,
            owner: userId,
            isPublished: false
        })

        if(!newVideo) {
            throw new ApiError(400, "Error while creating a new video");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, newVideo, "Video published successfully")
        )
        
    } catch (error) {
        throw new ApiError(400, `Error while publishing a video ${error.message}`);
    }
})

const getVideoById = asyncHandler(async (req, res) => {

    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "videoId is not correct to find video")
    }

    try {
        
        const video = await Video.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(videoId)
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
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner",
                    pipeline: [
                        {
                            $lookup: {
                                from: "subscriptions",
                                localField: "_id",
                                foreignField: "channel",
                                as: "subscribers"
                            }
                        },
                        {
                            $addFields: {
                                subscribersCount: {
                                    $size: "$subscribers"
                                },
                                isSubscribed: {
                                    $cond: {
                                        if: {
                                            $in: [
                                                req.user?._id,
                                                "$subscribers.subscriber"
                                            ]
                                        },
                                        then: true,
                                        else: false
                                    }
                                }
                            }
                        },
                        {
                            $project: {
                                username: 1,
                                "avatar": 1,
                                subscribersCount: 1,
                                isSubscribed: 1
                            }
                        }
                    ]
                }
            },
            {
                $addFields: {
                    likesCount: {
                        $size: "$likes"
                    },
                    owner: {
                        $first: "$owner"
                    },
                    isLiked: {
                        $cond: {
                            if: {$in: [req.user?._id, "$likes.likedBy"]},
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project: {
                    "videoFile": 1,
                    title: 1,
                    description: 1,
                    views: 1,
                    createdAt: 1,
                    duration: 1,
                    comments: 1,
                    owner: 1,
                    likesCount: 1,
                    isLiked: 1
                }
            }
        ]);

        if(!video) {
            throw new ApiError(404, "Video not found");
        }

        // increment views if video fetched successfully
        await Video.findByIdAndUpdate(videoId, {
            $inc: {
                views: 1
            }
        });

        // add this video to user watch history
        await User.findByIdAndUpdate(req.user?._id, {
            $addToSet: {
                watchHistory: videoId
            }
        });


        return res
        .status(200)
        .json(
            new ApiResponse(200, video[0], "Video fetched successfully")
        )
    } catch(error) {
        throw new ApiError(400, error.message);
    }

});

const updateVideo = asyncHandler(async (req, res) => { // update thumbnail, description and title

    const { videoId } = req.params;
    const { title, description } = req.body;
    const thumbnail = req.files?.thumbnail[0].path;

    try {

        const video = await Video.findById(videoId);

        if(!video) {
            throw new ApiError(404, "Video not found while updating video");
        }

        // delete the thumbnail from cloudinary
        const publicId = await video.thumbnail.public_id;

        if(publicId) { // deleting old thumbnail
            try {
                await cloudinary.uploader.destroy(publicId, {resource_type: "image"});
            } catch (error) {
                throw new ApiError(400, "Error while deleting old thumbnail");
            }
        }

        const thumbnailLocalPath = req.file?.path;

        if(!thumbnailLocalPath) {
            throw new ApiError(400, "Error while uploading thumbnail to cloudinary");
        }

        const newThumbnail = await uploadOnCloudinary(thumbnailLocalPath);


        const updatedVideo = await Video.findByIdAndUpdate(videoId, {
            $set: {
                thumbnail: newThumbnail.url,
                title,
                description
            }
        }, { new: true });


        if(!updatedVideo) {
            throw new ApiError(404, "Video not found while updating video");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, updatedVideo, "Video updated successfully")
        )

        
    } catch (error) {
        throw new ApiError(400, `Error while updating video ${error.message}`);
    }

});

const deleteVideo = asyncHandler(async (req, res) => {

    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "videoId is not correct to find video")
    }

    try {

        const video = await Video.findById(videoId);

        if(!video) {
            throw new ApiError(404, "Video not found while deleting video");
        }

        const publicId = video.publicId;

        if(!publicId) {
            throw new ApiError(400, "Error in publicId while deleting video");
        }

        if(publicId) {
            try {
                // deleting from cloudinary
                await cloudinary.uploader.destroy(publicId, {resource_type: "video"});
                // delete from database
                await Video.findByIdAndDelete(videoId);
            } catch (error) {
                throw new ApiError(400, "Error while deleting video");
            }
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, null, "Video deleted successfully")
        )
        
    } catch (error) {
        throw new ApiError(400, "Error while deleting video");
    }

});

const togglePublishStatus = asyncHandler(async (req, res) => {

    const { videoId } = req.params;

    if(!isValidObjectId(videoId)) {
        throw new ApiError(400, "videoId is not correct to find video for toggling publish status");
    }

    try {

        const video = await Video.findById(videoId);

        if(!video) {
            throw new ApiError(404, "Video not found while toggling publish status");
        }

        const updatedVideo = await Video.findByIdAndUpdate(videoId, {
            $set: {
                isPublished: !video.isPublished
            }
        }, { new: true }).select("-video -thumbnail -title -description");

        if(!updatedVideo) {
            throw new ApiError(404, "Video not found while toggling publish status");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, updatedVideo, "Publish status toggled successfully")
        )
        
    } catch (error) {
        throw new ApiError(400, "Error while toggling publish status");
    }
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}