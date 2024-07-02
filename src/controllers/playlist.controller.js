import mongoose, {isValidObjectId} from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";

const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body;

    if(!name) {
        throw new ApiError(400, "Name is required");
    }

    if(!description) {
        throw new ApiError(400, "Description is required");
    }

    const userId = await req.user._id;

    try {

        const playlist = await Playlist.create({
            name: name,
            description,
            owner: userId,
            videos: []
        })

        if(!playlist) {
            throw new ApiError(500, "Error while creating a new playlist");
        }

        return res
        .status(201)
        .json(
            new ApiResponse(201, playlist, "Playlist created successfully")
        )


    } catch (error) {
        throw new ApiError(500, error.message);
    }
})


const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params;

    if(!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user Id");
    }

    try {

        const userPlaylist = await Playlist.aggregate(
            [
                //for owner of playlist
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
                                    _id: 1,
                                    username: 1,
                                    fullName: 1,
                                    avatar: 1
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
                },
                //for videos of playlist
                {
                    $lookup: {
                        from: "videos",
                        localField: "videos",
                        foreignField: "_id",
                        as: "videos",
                        pipeline: [
                            {
                                $project: {
                                    _id: 1,
                                    video: 1,
                                    thumbnail: 1,
                                    title: 1,
                                    views: 1,
                                    owner: 1
                                }
                            },
                            //for owner of videos
                            {
                                $lookup: {
                                    from: "users",
                                    localField: "owner",
                                    foreignField: "_id",
                                    as: "owner",
                                    pipeline: [
                                        {
                                            $project: {
                                                _id: 1,
                                                username: 1,
                                                fullName: 1,
                                                avatar: 1
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
    
            ]
        );

        // if(!userPlaylist.length) {
        //     throw new ApiError(404, "User has no playlists");
        // }

        return res
        .status(200)
        .json(
            new ApiResponse(200, userPlaylist, "User playlists fetched successfully")
        )
        
    } catch (error) {
        throw new ApiError(500, error.message);
    }
})


const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params;

    if(!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist Id");
    }

    try {

        const playlist = await Playlist.findById(playlistId);

        if(!playlist) {
            throw new ApiError(404, "Playlist not found");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, playlist, "Playlist fetched successfully")
        )

    } catch (error) {
        throw new ApiError(500, `error while getting user playlist in playlist controller ${error.message}`);
    }
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params;

    if(!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist Id");
    }

    if(!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video Id");
    }

    try {

        const video = await Video.findById(videoId);
        
        if(!video) {
            throw new ApiError(404, "Video not found");
        }

        const playlist = await Playlist.findById(playlistId);

        if(!playlist) {
            throw new ApiError(404, "Playlist not found");
        }

        // check if video already exists in playlist
        const videoExists = playlist.videos.find(vid => vid.toString() === videoId.toString());

        if(videoExists) {
            throw new ApiError(400, "Video already exists in playlist");
        }

        if(playlist.owner.toString()!== req.user._id.toString()) {
            throw new ApiError(401, "You are not authorized to add this video to this playlist");
        }

        const updatedPlaylist = await Playlist.findByIdAndUpdate(playlistId, {
            $push: {
                videos: videoId
            }
        });

        if(!updatedPlaylist) {
            throw new ApiError(404, "can not add video to playlist");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, updatedPlaylist, "Video added to playlist successfully")
        )

        
    } catch (error) {
        throw new ApiError(500, error.message);
    }
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params;

    if(!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist Id");
    }

    if(!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video Id");
    }

    try {
        
        const video = await Video.findById(videoId);

        if(!video) {
            throw new ApiError(404, "Video not found");
        }

        const playlist = await Playlist.findById(playlistId);

        if(!playlist) {
            throw new ApiError(404, "Playlist not found");
        }

        if(playlist.owner.toString()!== req.user._id.toString()) {
            throw new ApiError(401, "You are not authorized to remove this video from this playlist");
        }

        const updatedPlaylist = await Playlist.findByIdAndUpdate(playlistId, {
            $pull: {
                videos: videoId
            }
        });

        if(!updatedPlaylist) {
            throw new ApiError(404, "can not remove video from playlist");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, updatedPlaylist, "Video removed from playlist successfully")
        )

    } catch (error) {
        throw new ApiError(500, error.message);
    }
})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params;

    if(!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist Id");
    }

    try {

        const playlist = await Playlist.findById(playlistId);

        if(!playlist) {
            throw new ApiError(404, "Playlist not found");
        }

        if(playlist.owner.toString()!== req.user._id.toString()) {
            throw new ApiError(401, "You are not authorized to delete this playlist");
        }

        const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);

        if(!deletedPlaylist) {
            throw new ApiError(404, "can not delete playlist");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, deletedPlaylist, "Playlist deleted successfully")
        )
        
    } catch (error) {
        throw new ApiError(500, error.message);
    }
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params;
    const {name, description} = req.body;

    if(!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist Id");
    }

    if(name === "") {
        throw new ApiError(400, "Name is required");
    }

    if(description === "") {
        throw new ApiError(400, "Description is required");
    }

    try {

        const playlist = await Playlist.findById(playlistId);

        if(!playlist) {
            throw new ApiError(404, "Playlist not found");
        }

        if(playlist.owner.toString()!== req.user._id.toString()) {
            throw new ApiError(401, "You are not authorized to update this playlist");
        }

        const updatedPlaylist = await Playlist.findByIdAndUpdate(playlistId, {
            name,
            description
        });

        if(!updatedPlaylist) {
            throw new ApiError(404, "can not update playlist");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
        )
        
    } catch (error) {
        throw new ApiError(500, error.message);
    }
})




export {
    createPlaylist,
    addVideoToPlaylist,
    deletePlaylist,
    updatePlaylist,
    getPlaylistById,
    getUserPlaylists,
    removeVideoFromPlaylist
}