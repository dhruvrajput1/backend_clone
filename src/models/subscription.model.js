import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    subscriber: { // one who is subscribing
        type: mongoose.Types.ObjectId,
        ref: "User"
    },
    channel: { // who is uploading video on youtube
        type: mongoose.Types.ObjectId,
        ref: "User"
    }
}, {timestamps: true})

export const Subscription = mongoose.model("Subscription", subscriptionSchema);