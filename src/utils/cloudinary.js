import {v2 as cloudinary} from 'cloudinary';
import fs from "fs";

// first we will upload our file to local server, then from local server to cloudinary

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET // Click 'View Credentials' below to copy your API secret
});
    
// uploading image/video
const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) { // no file exists
            return null;
        }
        // if exists, then uplaod
        const response = cloudinary.uploader.uploadFile(localFilePath, {
            resource_type: "auto"
        });

        console.log("file uploaded successfully", response.url);

        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the upload operation got failed
        return null;
    }
}

export {uploadOnCloudinary};