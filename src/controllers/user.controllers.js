import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';

import {User} from '../models/user.model.js';

import {uploadOnCloudinary} from '../utils/cloudinary.js';

import { ApiResponse } from '../utils/ApiResponse.js';


const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


    const {fullName, email, username, password } = req.body
    
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }


    const existedUSer = User.findOne({
        $or: [{username}, {email}]
    })


    if(existedUSer){
        throw new ApiError(409, "Either User already exists with this email or username");
    }



    // upload avatar to cloudinary

    const avatarLocalpath = req.files?.avatar[0]?.path;
    const coverImageLocalpath = req.files?.coverImage[0]?.path;

    if(!avatarLocalpath){
        throw new ApiError(400, "Avatar file is required");
    }


    const avatar = await uploadOnCloudinary(avatarLocalpath);
    const coverImage = await uploadOnCloudinary(coverImageLocalpath);

    if(!avatar){
        throw new ApiError(400, "Avatar file failed to upload");
    }

    if(!coverImage){
        throw new ApiError(400, "Cover Image file failed to upload");
    }


    // create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage.url || " ",
        email,
        password,
        username: username.toLowerCase(),
    })



    //check user created successfully or not.
    // remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )


    // check for user creation
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user or Failed to create user");
    }


    //return response.
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User created/registered successfully")
    )

})


export default registerUser