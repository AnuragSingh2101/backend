import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.model.js";
import mongoose, { isValidObjectId } from "mongoose";

// Helper function to get subscribed channels
const getSubscribedChannelsAggregation = async (subscriberId) => {
  return Subscription.aggregate([
    {
      $match: {
        subscriber: subscriberId,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "subscribedChannels",
        pipeline: [
          {
            $project: {
              _id: 1,
              fullName: 1,
              avatar: 1,
              userName: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        _id: 0,
        subscribedChannels: 1,
      },
    },
  ]);
};

// Toggle subscription (add/remove)
const toggleSubscription = asyncHandler(async (req, res, next) => {
  const { channelId } = req.params;

  if (!channelId || !isValidObjectId(channelId)) {
    return next(new ApiError(400, `Invalid or missing channel ID`));
  }

  const channel = await User.findById(channelId);
  if (!channel) {
    return next(new ApiError(400, `Channel not found`));
  }

  const subscriberId = req.user._id;
  const existingSubscription = await Subscription.findOne({ subscriber: subscriberId, channel: channelId });

  if (existingSubscription) {
    await Subscription.findByIdAndDelete(existingSubscription._id);
    const subscriptions = await getSubscribedChannelsAggregation(subscriberId);
    return res.status(200).json(new ApiResponse(200, subscriptions[0]?.subscribedChannels || [], "Subscription removed"));
  }

  await Subscription.create({ subscriber: subscriberId, channel: channelId });
  const subscriptions = await getSubscribedChannelsAggregation(subscriberId);
  res.status(200).json(new ApiResponse(200, subscriptions[0]?.subscribedChannels || [], "Subscription added"));
});

// Get channel subscribers
const getChannelSubscribers = asyncHandler(async (req, res, next) => {
  const { channelId } = req.params;

  if (!channelId || !isValidObjectId(channelId)) {
    return next(new ApiError(400, `Invalid or missing channel ID`));
  }

  const channel = await User.findById(channelId);
  if (!channel) {
    return next(new ApiError(400, `Channel not found`));
  }

  const subscribers = await Subscription.aggregate([
    {
      $match: { channel: new mongoose.Types.ObjectId(channelId) },
    },
    {
      $group: {
        _id: "$channel",
        subscribersArray: { $push: "$subscriber" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscribersArray",
        foreignField: "_id",
        as: "subscribersList",
        pipeline: [
          { $project: { _id: 1, userName: 1, fullName: 1, avatar: 1 } },
        ],
      },
    },
    {
      $addFields: {
        totalSubscribers: { $size: "$subscribersArray" },
      },
    },
    { $project: { _id: 0, subscribersList: 1, totalSubscribers: 1 } },
  ]);

  res.status(200).json(new ApiResponse(200, subscribers[0] || [], "Channel subscribers fetched"));
});

// Get user subscriptions
const getUserSubscriptions = asyncHandler(async (req, res, next) => {
  const { subscriberId } = req.params;

  if (!subscriberId || !isValidObjectId(subscriberId)) {
    return next(new ApiError(400, `Invalid or missing subscriber ID`));
  }

  const subscriber = await User.findById(subscriberId);
  if (!subscriber) {
    return next(new ApiError(400, `Subscriber not found`));
  }

  const subscriptions = await Subscription.aggregate([
    { $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) } },
    {
      $group: {
        _id: "$subscriber",
        subscribedArray: { $push: "$channel" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscribedArray",
        foreignField: "_id",
        as: "subscribedChannelList",
        pipeline: [
          { $project: { _id: 1, fullName: 1, avatar: 1, userName: 1 } },
        ],
      },
    },
    { $addFields: { totalSubscribedChannels: { $size: "$subscribedArray" } } },
    { $project: { _id: 0, subscribedChannelList: 1, totalSubscribedChannels: 1 } },
  ]);

  res.status(200).json(new ApiResponse(200, subscriptions[0] || [], "User subscriptions fetched"));
});

// Get latest video from subscribed channels
const getLatestVideoFromSubscribedChannels = asyncHandler(async (req, res, next) => {
  const { subscriberId } = req.params;

  if (!subscriberId || !isValidObjectId(subscriberId)) {
    return next(new ApiError(400, `Invalid or missing subscriber ID`));
  }

  const subscriber = await User.findById(subscriberId);
  if (!subscriber) {
    return next(new ApiError(400, `Subscriber not found`));
  }

  const latestVideosData = await Subscription.aggregate([
    { $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) } },
    {
      $lookup: {
        from: "videos",
        let: { channels: "$channel" },
        pipeline: [
          { $match: { $expr: { $eq: ["$owner", "$$channels"] } } },
          { $sort: { createdAt: -1 } },
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              pipeline: [
                { $project: { _id: 0, fullName: 1, userName: 1, avatar: 1 } },
              ],
              as: "owner",
            },
          },
          { $addFields: { owner: { $first: "$owner" } } },
          {
            $project: {
              _id: 1,
              thumbnail: 1,
              duration: 1,
              views: 1,
              owner: 1,
              title: 1,
              createdAt: 1,
            },
          },
        ],
        as: "video",
      },
    },
    { $unwind: "$video" },
    { $group: { _id: "$channel", latestVideo: { $first: "$video" } } },
    { $project: { _id: 0, latestVideo: 1 } },
    { $sort: { "latestVideo.createdAt": -1 } },
    {
      $group: { _id: null, latestVideos: { $push: "$latestVideo" } },
    },
    { $project: { _id: 0, latestVideos: 1 } },
  ]);

  res.status(200).json(
    new ApiResponse(200, latestVideosData[0]?.latestVideos || [], "Latest videos from subscribed channels fetched")
  );
});

export {
  toggleSubscription,
  getChannelSubscribers,
  getUserSubscriptions,
  getLatestVideoFromSubscribedChannels,
};
