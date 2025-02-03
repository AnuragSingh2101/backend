import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const authorizedOwner = (userId, req) => {
  return userId.toString() === req.user._id.toString();
};

// Create Tweet
const createTweet = asyncHandler(async (req, res, next) => {
  const { content } = req.body;

  if (!content) {
    return next(new ApiError("Content is required", 400));
  }

  try {
    const tweet = await Tweet.create({
      content,
      owner: req.user._id,
    });

    return res
      .status(201)
      .json(new ApiResponse(tweet, "Tweet created successfully"));
  } catch (error) {
    return next(error);
  }
});

// Get User's Tweets
const getUserTweets = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    return next(new ApiError("Invalid user ID", 400));
  }

  try {
    const tweets = await Tweet.find({ owner: userId }).sort({ createdAt: -1 });
    return res
      .status(200)
      .json(new ApiResponse(tweets, "User's tweets retrieved successfully"));
  } catch (error) {
    return next(error);
  }
});

// Update Tweet
const updateTweet = asyncHandler(async (req, res, next) => {
  const { tweetId } = req.params;
  const { content } = req.body;

  if (!content) {
    return next(new ApiError("Content is required to update the tweet", 400));
  }

  if (!isValidObjectId(tweetId)) {
    return next(new ApiError("Invalid tweet ID", 400));
  }

  try {
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      return next(new ApiError("Tweet not found", 404));
    }

    if (tweet.owner.toString() !== req.user._id.toString()) {
      return next(
        new ApiError("Unauthorized: You can only update your own tweets", 401)
      );
    }

    tweet.content = content;
    await tweet.save();

    return res
      .status(200)
      .json(new ApiResponse(tweet, "Tweet updated successfully"));
  } catch (error) {
    return next(error);
  }
});

// Delete Tweet
const deleteTweet = asyncHandler(async (req, res, next) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    return next(new ApiError("Invalid tweet ID", 400));
  }

  try {
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      return next(new ApiError("Tweet not found", 404));
    }

    if (tweet.owner.toString() !== req.user._id.toString()) {
      return next(
        new ApiError("Unauthorized: You can only delete your own tweets", 401)
      );
    }

    await tweet.remove();
    return res
      .status(200)
      .json(new ApiResponse({}, "Tweet deleted successfully"));
  } catch (error) {
    return next(error);
  }
});



export { 
        createTweet, 
        getUserTweets,
        updateTweet, 
        deleteTweet 
    };