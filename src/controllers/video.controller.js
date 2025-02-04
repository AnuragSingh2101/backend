import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import { Playlist } from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary, deleteFromCloudinary} from "../utils/cloudinary.js"
import { authorizedOwner } from "./playlist.controller.js"



const addVideoToPlaylist = asyncHandler(async (videoId, playlistId, req, next) => {
    if (!videoId || !playlistId) {
      return next(new ApiError(400, "Video ID or Playlist ID is missing."));
    }
  
    if (!isValidObjectId(videoId) || !isValidObjectId(playlistId)) {
      return next(new ApiError(400, "Invalid Video ID or Playlist ID."));
    }
  
    // Find the playlist
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return next(new ApiError(404, "Playlist not found"));
    }
  
    // Authorization check: User must be the owner of the playlist
    if (!authorizedOwner(playlist.owner, req)) {
      return next(new ApiError(401, "Unauthorized access"));
    }
  
    // Check if video already exists in playlist
    if (playlist.videos.includes(videoId)) {
      return next(new ApiError(400, "Video already in playlist"));
    }
  
    // Add video to playlist
    playlist.videos.push(videoId);
  
    // Save the updated playlist
    await playlist.save();
  
    return res.status(200).json(new ApiResponse(200, {}, "Video added to playlist successfully"));
  });
  

  const deleteVideo = asyncHandler(async (req, res, next) => {
    //TODO: delete video
    const { videoId } = req.params;
  
    if (!videoId) {
      return next(new ApiError(400, "video id is missing."));
    }
  
    if (!isValidObjectId(videoId)) {
      return next(new ApiError(400, "invalid video id"));
    }
  
    let video = await Video.findById(videoId);
  
    if (!video) {
      return next(
        new ApiError(400, `video with id ${videoId} is already deleted`)
      );
    }
  
  
    // check if the user has the authority to delete the video
    if (req.user._id.toString() !== video.owner.toString()) {
      return next(
        new ApiError(
          401,
          "You do not have permission to perform this action on this resource"
        )
      );
    }

  // Extract Cloudinary public IDs for video and thumbnail
    const videoPublicId = video.videoFile.split("/").pop().split(".")[0];
    const thumbnailPublicId = video.thumbnail.split("/").pop().split(".")[0];
  
    await deleteFromCloudinary(videoPublicId);
    await deleteFromCloudinary(thumbnailPublicId);
  
    const deletedVideo = await Video.findByIdAndDelete(videoId);
  
    if (!deletedVideo) {
      return next(new ApiError(500, `video with id ${videoId} does not exist`));
    }
    
    res.status(200).json(new ApiResponse(200, {}, "video deleted successfully"));
  });
  

  const updateVideo = asyncHandler(async (req, res, next) => {
      const { videoId } = req.params;
    
      // Check if videoId is provided and valid
      if (!videoId) {
        return next(new ApiError(400, "Video ID is missing."));
      }
    
      if (!isValidObjectId(videoId)) {
        return next(new ApiError(400, "Invalid Video ID."));
      }
    
      const { title, description, visibility } = req.body;
    
      // Parse playlistIds (if provided)
      let playlistIds = JSON.parse(req.body.playlistIds || "[]");
    
      // Handle thumbnail update if provided
      let newThumbnail, oldThumbnail;
    
      if (req.file) {
        // Get old thumbnail for deletion
        oldThumbnail = await Video.findById(videoId).select("thumbnail");
    
        // Upload new thumbnail
        const thumbnailLocalPath = req.file.path;
        newThumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    
        if (!newThumbnail) {
          return next(new ApiError(500, "Something went wrong while uploading thumbnail."));
        }
    
        // Delete old thumbnail from Cloudinary
        await deleteFromCloudinary(oldThumbnail.thumbnail.split("/").pop().split(".")[0]);
      }
    
      // Handle adding video to playlists (if any)
      if (Array.isArray(playlistIds) && playlistIds.length > 0) {
        for (const playlistId of playlistIds) {
          await addVideoToPlaylistUtility(videoId, playlistId, req, next);
        }
      }
    
      // Determine if the video is public
      const isPublished = visibility === "public";
    
      // Update video details in the database
      const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
          $set: {
            title,
            description,
            thumbnail: newThumbnail?.url,
            isPublished,
          },
        },
        { new: true }
      );
    
      if (!updatedVideo) {
        return next(new ApiError(500, `Video with ID ${videoId} does not exist.`));
      }
    
      // Respond with success
      res.status(200).json(new ApiResponse(200, updatedVideo, "Video details updated successfully"));
    });


  
    const getAllVideos = asyncHandler(async (req, res, next) => {
        const { page = 1, limit = 10, query, sortBy = 'createdAt', sortType = -1, userId } = req.query;
      
        // Convert page and limit to numbers and calculate the skip value for pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
      
        // Build the search query if a query parameter is provided (search on title and description)
        const searchQuery = query
          ? {
              $or: [
                { title: { $regex: query, $options: "i" } }, // Case-insensitive search on title
                { description: { $regex: query, $options: "i" } }, // Case-insensitive search on description
              ],
            }
          : {}; // Empty object means no search filter
      
        // Build the aggregation pipeline for MongoDB
        const pipeline = [
          {
            $match: {
              isPublished: true, // Ensure only published videos are fetched
              ...searchQuery, // Apply search filter (if any)
              ...(userId ? { owner: new mongoose.Types.ObjectId(userId) } : {}), // Filter by user if provided
            },
          },
          {
            $lookup: {
              from: "users", // Join the 'users' collection to fetch owner details
              localField: "owner",
              foreignField: "_id",
              as: "ownerDetails",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    userName: 1,
                    avatar: 1, // Select relevant fields of the owner
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: { $arrayElemAt: ["$ownerDetails", 0] }, // Extract the first (and only) element from the ownerDetails array
            },
          },
          {
            $sort: {
              [sortBy]: parseInt(sortType), // Sort based on the field and order (ascending or descending)
            },
          },
          {
            $skip: skip, // Apply pagination (skip)
          },
          {
            $limit: parseInt(limit), // Limit the number of results (page size)
          },
        ];
      
        // Execute the aggregation pipeline to fetch the videos
        const videos = await Video.aggregate(pipeline);
      
        // Count the total number of published videos (for pagination metadata)
        const totalVideos = await Video.countDocuments({
          isPublished: true, // Only count published videos
          ...searchQuery, // Include search filter if provided
          ...(userId ? { owner: new mongoose.Types.ObjectId(userId) } : {}), // Count by user if provided
        });
      
        // If no videos found, send a response with an appropriate message
        if (!videos || videos.length === 0) {
          return next(new ApiError(404, "No videos found"));
        }
      
        // Send the response with the fetched videos and pagination metadata
        res.status(200).json(
          new ApiResponse(
            200,
            {
              videos,
              currentPage: parseInt(page),
              totalPages: Math.ceil(totalVideos / parseInt(limit)),
              totalVideos,
            },
            "Videos fetched successfully"
          )
        );
      });
      

      const publishVideo = asyncHandler(async (req, res, next) => {
        const { title, description, visibility } = req.body;
      
        // Parse playlist IDs if provided
        let playlistIds = [];
        playlistIds = JSON.parse(req.body.playlistIds || "[]");
      
        // Validate input fields
        if (!title) {
          return next(new ApiError(400, "Title cannot be empty"));
        }
      
        if (!req.files || !req.files.videoFile || !req.files.thumbnail) {
          return next(
            new ApiError(400, "Please select a video and a thumbnail image to upload")
          );
        }
      
        const videoLocalPath = req?.files?.videoFile[0]?.path;
        const thumbnailLocalPath = req?.files?.thumbnail[0]?.path;
      
        // Upload video to Cloudinary
        const video = await uploadOnCloudinary(videoLocalPath);
        if (!video) {
          return next(new ApiError(500, "Something went wrong while uploading video"));
        }
      
        // Upload thumbnail to Cloudinary
        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
        if (!thumbnail) {
          return next(new ApiError(500, "Something went wrong while uploading thumbnail"));
        }
      
        // Set the visibility of the video (public/private)
        const isPublished = visibility === "public" ? true : false;
      
        // Create the Video document in the database
        const videoDoc = await Video.create({
          title,
          description,
          videoFile: video.url,
          thumbnail: thumbnail.url,
          duration: video.duration,
          owner: req.user._id,
          isPublished,
        });
      
        // If video creation fails, send error response
        if (!videoDoc) {
          return next(new ApiError(500, "Something went wrong while saving video"));
        }
      
        // Add video to playlists if playlist IDs are provided
        if (Array.isArray(playlistIds) && playlistIds.length > 0) {
          for (const playlistId of playlistIds) {
            console.log(`Adding video to playlist ${playlistId}`);
      
            // addVideoToPlaylist is a function that adds the video to the playlist
            await addVideoToPlaylist(videoDoc._id, playlistId, req);
          }
        }
      
        // Send successful response with the video data
        res.status(201).json(
          new ApiResponse(201, videoDoc, "Video published successfully")
        );
      });
      

      const getVideoById = asyncHandler(async (req, res, next) => {
        const { videoId } = req.params;
      
        // Validate the video ID
        if (!videoId) {
          return next(new ApiError(400, "Video ID is missing."));
        }
      
        if (!isValidObjectId(videoId)) {
          return next(new ApiError(400, "Invalid video ID."));
        }
      
        // Update the view count
        await Video.updateOne(
          { _id: new mongoose.Types.ObjectId(videoId) },
          { $inc: { views: 1 } }
        );
      
        // Aggregation pipeline to fetch video with owner details
        const pipeline = [
          {
            $match: { _id: new mongoose.Types.ObjectId(videoId) },
          },
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                { $project: { userName: 1, fullName: 1, avatar: 1 } },
              ],
            },
          },
          {
            $addFields: {
              owner: { $first: "$owner" }, // Get the first owner in case it's an array
            },
          },
        ];
      
        // Execute the pipeline
        const video = await Video.aggregate(pipeline);
      
        // If the video isn't found
        if (!video || video.length === 0) {
          return next(new ApiError(404, `Video with ID ${videoId} not found.`));
        }
      
        // Send response with the video data
        res.status(200).json(
          new ApiResponse(200, video[0], `Video with ID ${videoId} fetched successfully.`)
        );
      });
      


const togglePublishStatus = asyncHandler(async (req, res, next) => {
    const { videoId } = req.params;
  
    if (!videoId) {
      return next(new ApiError(400, "Video ID is missing"));
    }
  
    if (!isValidObjectId(videoId)) {
      return next(new ApiError(400, "Invalid Video ID"));
    }
  
    const video = await Video.findById(videoId);
  
    if (!video) {
      return next(new ApiError(404, "Video not found"));
    }
  
    // Toggle the isPublished status
    video.isPublished = !video.isPublished;
  
    await video.save();
  
    res.status(200).json(
      new ApiResponse(200, video, `Video publish status toggled successfully`)
    );
  });



  
  const watchHistory = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
  
    const user = await User.findById(userId).select("watchHistory");
  
    if (!user) {
      return next(new ApiError(404, "User not found"));
    }
  
    if (!user.watchHistory || user.watchHistory.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, [], "No videos in watch history")
      );
    }
  
    // Use the videoIds in the watchHistory to fetch the corresponding video details
    const videos = await Video.find({
      _id: { $in: user.watchHistory }, // Find videos where ID matches any in watchHistory
    });
  
    if (!videos || videos.length === 0) {
      return res.status(200).json(
        new ApiResponse(200, [], "No videos found in watch history")
      );
    }
  
    // Return the list of videos in the watch history
    res.status(200).json(
      new ApiResponse(200, videos, "Watch history fetched successfully")
    );
  });
  

  

export {
    addVideoToPlaylist,
    deleteVideo,
    updateVideo,
    getAllVideos,
    publishVideo,
    getVideoById,
    togglePublishStatus,
    watchHistory
}