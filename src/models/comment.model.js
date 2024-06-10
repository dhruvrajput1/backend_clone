import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"; // bcz user ko ek particular range me comments show karne hai (not all at a time)

const commentScehma = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    video: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Video"
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
    
}, {timestamps: true});


commentScehma.plugin(mongooseAggregatePaginate);
export const Comment = mongoose.model("Comment", commentScehma);
