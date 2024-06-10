import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"; // user ko ek sath saare video nahi show karne

const videoSchema = new mongoose.Schema({
    
    videoFile: {
        type: String, // cloudinary url
        required: true,
    },
    thumbnail: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    duration: {
        type: Number, //  we will fetch from cloudinary
        required: true,
    },
    publicId: { // from cloudinary
        type: String, 
        required: true,
    },
    views: {
        type: Number,
        default: 0
    },
    isPublished: {
        type: Boolean,
        default: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }


}, {timestamps: true})

// plugin is a middleware which is used to apply some properties to all the schemas efficiently
videoSchema.plugin(mongooseAggregatePaginate); // used for pipelining

export const Video = mongoose.model("Video", videoSchema);