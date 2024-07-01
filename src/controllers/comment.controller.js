import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";


const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

    const commentsAggregate = Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes"
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
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                likesCount: 1,
                owner: {
                    username: 1,
                    fullName: 1,
                    avatar: 1
                },
                isLiked: 1
            }
        }
    ]);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const comments = await Comment.aggregatePaginate(
        commentsAggregate,
        options
    );

    // const totalComments = await Comment.countDocuments({ video: videoId })
    // const totalPages = Math.ceil(totalComments / pageLimit)

    return res
        .status(200)
        .json(
            new ApiResponse(200, comments, "video all Comments fetched Sucessfully!")
        )

})

const addComment = asyncHandler(async (req, res) => {
    try {
        const { videoId } = req.params;
        const { content } = req.body;
        const userId = await req.user._id;

        const user = await User.findById(userId);

        if(content === "") {
            throw new ApiError(400, "Comment cannot be empty");
        }

    
        const comment = await Comment.create({
            content: content,
            video: videoId,
            owner: user
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
        throw new ApiError(500, `error while creating a new comment ::  ${error.message}`);
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