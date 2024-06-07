import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        lowercase: true,
        unique: true,
        trim: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        unique: true,
        trim: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    avatar: {
        type: String, // cloudinary link
        required: true
    },
    coverImage: {
        type: String, // cloudinary link
    },
    watchHistory: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Video"
        }
    ],
    password: {
        type: String,
        required: [true, "Password is required"],
    },
    refreshToken: {
        type: String
    }

}, {timestamps: true})


// hasing the password using "pre" middleware (pre means something before saving)
userSchema.pre("save", async function (next) {
    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)
    next()
})

// now compare the password entered by user and the bcrypted password
userSchema.methods.isPasswordCorrect = async function(password) { // .methods is used for creating our own custom methods
    return await bcrypt.compare(password, this.password); // returns 1 or 0
}

// generating access token
userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        { // payload(data)
            _id: this._id,
            username: this.username, // this.username is coming from database
            email: this.email,
            fullName: this.fullName,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

// generating refresh token
userSchema.methods.generateRefreshToken = function() {
    return jwt.sign( // accepts 3 fields, 1. object of payload, 2. token secret, 3. object of expires in time
        { // payload(data)
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}


export const User = mongoose.model("User", userSchema);