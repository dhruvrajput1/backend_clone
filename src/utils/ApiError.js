class ApiError extends Error {
    constructor(statusCode, message="something went wrong", errors=[], stack="") {
        super(message); // calls the constructor of parent class (Error)
        this.statusCode = statusCode;
        this.data = null;
        this.message = message;
        this.success = false;
        this.errors = errors;

        if(stack) {
            this.stack = stack;
        }
        else {
            Error.captureStackTrace(this, this.constructor);
        }

    }
}

export {ApiError};