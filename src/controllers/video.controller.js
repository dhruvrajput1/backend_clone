import mongoose, {isValidObjectId} from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";
import {v2 as cloudinary} from 'cloudinary';

const getAllVideos = asyncHandler(async (req, res) => {

    const { page = 1, limit = 10, sortBy = "title", sortType = "asc", userId } = req.query;
    
    const pageNumber = parseInt(page);
    const pageLimit = parseInt(limit);

    const skip = (pageNumber - 1) * pageLimit;
    
    const sortingDirection = sortType === "desc"? -1 : 1; // +1 for ascending

    try {
        const videos = await Video.aggregate(
            [
                {
                    $match: {
                        owner: new mongoose.Types.ObjectId(userId)
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
                                $project: {
                                    fullName: 1,
                                    username: 1,
                                    avatar: 1
                                }
                            }
                        ]
                    }
                }, 
                {
                    $addFields: {
                        owner: {
                            $arrayElemAt: [ "$owner", 0 ]
                        }
                    }
                },
                {
                    $skip: skip
                },
                {
                    $limit: pageLimit
                },
                {
                    $sort: { [sortBy]: sortingDirection }
                }

            ])


        if(!videos) {
            throw new ApiError(404, "No videos found");
        }

        const totalVideo = await Video.countDocuments({ owner: userId });
        const totalPages = Math.ceil(totalVideo / pageLimit)

        return res
        .status(200)
        .json(
            new ApiResponse(200, videos, "Videos found successfully", {
                totalPages,
                totalVideo
            })
        )
        

    } catch (error) {
        throw new ApiError(400, `Error while showing videos on home page ${error.message}`, error);
    }
})

const publishAVideo = asyncHandler(async (req, res) => {
    const {title, description} = req.body;

    try {

        const userId = await req.user._id;

        const videoLocalPath = req.files?.videoFile[0].path;
        const thumbnailLocalPath = req.files?.thumbnail[0].path;


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
            isPublished: true
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
        const video = await Video.findById(videoId);

        if(!video) {
            throw new ApiError(404, "Video not found");
        }


        // incrementing the view of the video
        await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } }, { new: true });

        // adding the video to the watch history of the user
        await User.findByIdAndUpdate(req.user._id, { $push: { watchHistory: videoId } }, { new: true });


        return res
        .status(200)
        .json(
            new ApiResponse(200, video, "Video fetched successfully")
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