import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";  // Import the video model
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Function to check if the user is authorized to perform an action on the playlist
const authorizedOwner = (userId, req) => {
  return userId.toString() === req.user._id.toString();
};

// Create Playlist
const createPlaylist = asyncHandler(async (req, res, next) => {
  const { name, description } = req.body;

  // Validate input
  if (!name || !description) {
    return next(new ApiError("Invalid request: name and description are required", 400));
  }

  try {
    // Create playlist in DB
    const playlist = await Playlist.create({
      name,
      description,
      owner: req.user._id,
    });

    if (!playlist) {
      return next(new ApiError("Failed to create playlist", 400));
    }

    return res.status(201).json(new ApiResponse(playlist, "Playlist created successfully"));
  } catch (error) {
    return next(error);
  }
});

// Get User's Playlists
const getUserPlaylists = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  if (!userId) {
    return next(new ApiError("User ID is required", 400));
  }

  if (!isValidObjectId(userId)) {
    return next(new ApiError("Invalid user ID", 400));
  }

  if (!authorizedOwner(userId, req)) {
    return next(new ApiError("Unauthorized access", 401));
  }

  try {
    const playlists = await Playlist.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(userId) } },
      { $sort: { createdAt: -1 } },
    ]);

    if (!playlists || playlists.length === 0) {
      return res.status(404).json(new ApiResponse([], "No playlists found for this user"));
    }

    return res.status(200).json(new ApiResponse(playlists, "User's playlists retrieved successfully"));
  } catch (error) {
    return next(error);
  }
});

// Get Playlist by ID
const getPlaylistById = asyncHandler(async (req, res, next) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    return next(new ApiError("Invalid playlist ID", 400));
  }

  try {
    const playlist = await Playlist.findById(playlistId).populate("videos");

    if (!playlist) {
      return next(new ApiError("Playlist not found", 404));
    }

    if (!authorizedOwner(playlist.owner, req)) {
      return next(new ApiError("Unauthorized access", 401));
    }

    return res.status(200).json(new ApiResponse(playlist, "Playlist fetched successfully"));
  } catch (error) {
    return next(error);
  }
});

// Add Video to Playlist
const addVideoToPlaylist = asyncHandler(async (req, res, next) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    return next(new ApiError("Invalid playlist ID or video ID", 400));
  }

  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return next(new ApiError("Playlist not found", 404));
    }

    if (!authorizedOwner(playlist.owner, req)) {
      return next(new ApiError("Unauthorized access", 401));
    }

    const video = await Video.findById(videoId);
    if (!video) {
      return next(new ApiError("Video not found", 404));
    }

    if (!video.isPublished) {
      return next(new ApiError("Video is not published", 400));
    }

    if (playlist.videos.includes(videoId)) {
      return next(new ApiError("Video already exists in this playlist", 400));
    }

    playlist.videos.push(videoId);
    await playlist.save();

    return res.status(200).json(new ApiResponse(playlist, "Video added to playlist"));
  } catch (error) {
    return next(error);
  }
});

// Remove Video from Playlist
const removeVideoFromPlaylist = asyncHandler(async (req, res, next) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    return next(new ApiError("Invalid playlist ID or video ID", 400));
  }

  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return next(new ApiError("Playlist not found", 404));
    }

    if (!authorizedOwner(playlist.owner, req)) {
      return next(new ApiError("Unauthorized access", 401));
    }

    if (!playlist.videos.includes(videoId)) {
      return next(new ApiError("Video not found in playlist", 404));
    }

    playlist.videos.pull(videoId);
    await playlist.save();

    return res.status(200).json(new ApiResponse(playlist, "Video removed from playlist"));
  } catch (error) {
    return next(error);
  }
});

// Delete Playlist
const deletePlaylist = asyncHandler(async (req, res, next) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    return next(new ApiError("Invalid playlist ID", 400));
  }

  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return next(new ApiError("Playlist not found", 404));
    }

    if (!authorizedOwner(playlist.owner, req)) {
      return next(new ApiError("Unauthorized access", 401));
    }

    await playlist.remove();
    return res.status(200).json(new ApiResponse({}, "Playlist deleted successfully"));
  } catch (error) {
    return next(error);
  }
});

// Update Playlist
const updatePlaylist = asyncHandler(async (req, res, next) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!isValidObjectId(playlistId)) {
    return next(new ApiError("Invalid playlist ID", 400));
  }

  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return next(new ApiError("Playlist not found", 404));
    }

    if (!authorizedOwner(playlist.owner, req)) {
      return next(new ApiError("Unauthorized access", 401));
    }

    if (!name && !description) {
      return next(new ApiError("At least one field (name or description) is required", 400));
    }

    playlist.name = name || playlist.name;
    playlist.description = description || playlist.description;
    await playlist.save();

    return res.status(200).json(new ApiResponse(playlist, "Playlist updated successfully"));
  } catch (error) {
    return next(error);
  }
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
