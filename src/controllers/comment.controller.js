import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query


    const pageLimit = parseInt(limit);
    const pageNumber = parseInt(page);
    const offset = (pageNumber - 1) * pageLimit;
    const skip = offset;

    const comments = await Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)  //it'll give all comments with this videoId
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [ // pipeline is used to project only some field from users
                    {
                        $project: {
                            fullname: 1,
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
                    $first: "$owner" //return directly object not in array, as it takes only first element of the array
                }
            }
        },
        {
            $skip: skip
        },
        {
            $limit: pageLimit
        }

    ])

    const totalComments = await Comment.countDocuments({ video: videoId })
    const totalPages = Math.ceil(totalComments / pageLimit)

    return res
        .status(200)
        .json(
            new ApiResponse(200, { comments, totalComments, totalPages }, "video all Comments fetched Sucessfully!")
        )

})

const addComment = asyncHandler(async (req, res) => {
    try {
        const { videoId } = req.params;
        const { text } = req.body;
        const userId = await req.user._id;

        if(text === "") {
            throw new ApiError(400, "Comment cannot be empty");
        }
    
        const comment = await Comment.create({
            content: text,
            video: videoId,
            owner: userId
        });
    
        if(!comment) {
            throw new ApiError(400, "Comment not added");
        }
    
        return res
        .status(200)
        .json(
            new ApiResponse(200, comment, "Comment added successfully")
        )
    } catch (error) {
        throw new ApiError(500, error.message);
    }
})

const updateComment = asyncHandler(async (req, res) => {
    try {
        const { commentId } = req.params;
        const { newComment } = req.body;

        if(!newComment) {
            throw new ApiError(400, "Comment cannot be empty");
        }

        const updatedComment = await Comment.findByIdAndUpdate(commentId, {content: newComment});

        if(!updatedComment) {
            throw new ApiError(404, "Comment not found");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, updatedComment, "Comment updated successfully")
        )

    } catch(error) {
        throw new ApiError(500, error.message);
    }
})

const deleteComment = asyncHandler(async (req, res) => {
    try {
        
        const { commentId } = req.params;
        const userId = await req.user._id;

        const comment = await Comment.findByIdAndDelete(commentId);

        if(!comment) {
            throw new ApiError(404, "Comment not found");
        }


        return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Comment deleted successfully")
        )

    } catch (error) {
        throw new ApiError(500, error.message);
    }
})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}