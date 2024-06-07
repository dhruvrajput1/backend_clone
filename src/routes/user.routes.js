import { Router } from "express";
import { changeCurrentPassword, getCurrentUser, getUserCurrentProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// router.route("/register").post(registerUser);
// now add middleware to above route
router.route("/register").post(upload.fields([
    {
        name: "avatar",
        maxCount: 1
    },
    {
        name: "coverImage",
        maxCount: 1
    }
]), registerUser)

router.route("/login").post(loginUser);

// secured routes
router.route("/logout").post(verifyJWT, logoutUser); // verifyJWT is a middleware (we have to verify JWT token before logging out)
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountDetails); // patch applies partial modification, post applies modification in all fields
router.route("/update-avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar); // 2 middlewares
router.route("/update-cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage);

// if we are taking from link, we have to give the variable through the link
router.route("/c/:username").get(verifyJWT, getUserCurrentProfile);
router.route("/history").get(verifyJWT, getWatchHistory);

export default router;