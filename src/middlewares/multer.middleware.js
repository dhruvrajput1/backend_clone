import multer from "multer";

// multer is a middleware used to upload files  
// data to ja raha hai but jaate jaate images bhi le jao 

const storage = multer.diskStorage({
    destination: function (req, file, cb) { // cb is callback
        cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})

export const upload = multer({ storage: storage })