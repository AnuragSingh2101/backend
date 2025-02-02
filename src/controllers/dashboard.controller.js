import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res, next) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const { channelId } = req.params;
  
    if (!channelId) {
      return next(new ApiError(400, "Channel ID is missing."));
    }
  
    if (!isValidObjectId(channelId)) {
      return next(new ApiError(400, "Invalid channel ID."));
    }
  
    // Get total videos count
    const totalVideos = await Video.countDocuments({ owner: new mongoose.Types.ObjectId(channelId) });
  
    // Get total views for the channel
    const totalViews = await Video.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(channelId) } },
      { $group: { _id: null, totalViews: { $sum: "$views" } } }
    ]);
  
    // Get total subscribers count
    const totalSubscribers = await Subscription.countDocuments({ channel: new mongoose.Types.ObjectId(channelId) });
  
    // Get total likes count (sum of likes on videos)
    const totalLikes = await Like.aggregate([
      { $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "videoDetails"
      }},
      { $unwind: "$videoDetails" },
      { $match: { "videoDetails.owner": new mongoose.Types.ObjectId(channelId) } },
      { $count: "totalLikes" }
    ]);
  
    const stats = {
      totalVideos,
      totalViews: totalViews.length > 0 ? totalViews[0].totalViews : 0,
      totalSubscribers,
      totalLikes: totalLikes.length > 0 ? totalLikes[0].totalLikes : 0
    };
  
    res.status(200).json(new ApiResponse(200, stats, "Channel stats fetched successfully."));
  });
  
  const getChannelVideos = asyncHandler(async (req, res, next) => {
    // TODO: Get all the videos uploaded by the channel
    const { channelId } = req.params;
    const { page = 1, limit = 10 } = req.query;  // Pagination: default page 1, limit 10
  
    if (!channelId) {
      return next(new ApiError(400, "Channel ID is missing."));
    }
  
    if (!isValidObjectId(channelId)) {
      return next(new ApiError(400, "Invalid channel ID."));
    }
  
    const videos = await Video.find({ owner: new mongoose.Types.ObjectId(channelId) })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 }); // Sort by creation date (latest first)
  
    if (!videos.length) {
      return next(new ApiError(404, "No videos found for this channel."));
    }
  
    res.status(200).json(new ApiResponse(200, videos, "Videos fetched successfully."));
  });

export {
    getChannelStats, 
    getChannelVideos
    }