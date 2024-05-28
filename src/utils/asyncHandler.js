
// const asyncHandler = () => {}; // normal function
// we can pass another function in a higher order function
// asynch handler is a higher order function

// const asyncHandler = (func) => () => {};
// const asyncHandler = (func) => async () => {}


// asynch function can be handeled in 2 ways
// 1. using try catch
// 2. using promises i.e.,  .then() .catch()





// 1.

// const asyncHandler = (func) => async (req, res, next) => { // next is used a flag in middlewares, it tell the next middleware that the previous middleware is finished
//     try {
//         await func(req, res, next);
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message
//         })
//     }
// }




// 2.
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next))
        .catch((err) => next(err))
    }
}

export {asyncHandler};