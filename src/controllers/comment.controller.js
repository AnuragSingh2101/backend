import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!videoId) {
    return next(new ApiError(400, "video id is missing."));
  }

  if (!isValidObjectId) {
    return next(new ApiError(400, "Invalid video id."));
  }

  const video = await Video.findById(videoId);
  if (!video) {
    return next(new ApiError(500, `video with id ${videoId} does not exist`));
  }


  const pipeline = [
    { $match: { video: new mongoose.Types.ObjectId(videoId) } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "userDetails",
        pipeline: [
          {
            $project: {
              _id: 0,
              userName: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
  ];

  const comments = Comment.aggregate(pipeline);

  if (!comments) {
    return next(new ApiError(404, "No comments found not this video"));
  }

  const options = {
    page,
    limit,
    pagination: true,
  };

  const response = await Comment.aggregatePaginate(comments, options);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totaldocs: response.totalDocs,
        count: response.docs?.length,
        totalPages: response.totalPages,
        currentPage: response.page,
        nextPage: response.nextPage,
        prevPage: response.prevPage,
        hasNextPage: response.hasNextPage,
        hasPrevPage: response.hasPrevPage,
        pagingCounter: response.pagingCounter,
        videoComments: response.docs.reverse(),
      },
      "video comments fetched successfully"
    )
  );
});


const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  const {videoId} = req.params;
  const {comment} = req.body;

  if(!videoId){
    return next(new ApiError(400, "Video id is required"))
  }

  if(!isValidObjectId(videoId)){
    return next(new ApiError(400, "Invalid video id"))
  }

  const video = await Video.findById(videoId);
  if (!video) {
    return next(new ApiError(500, `video with id ${videoId} does not exist`));
  }


  if(!comment){
    return next(new ApiError(400, "Comment is required or empty"))
  }


  const createComments = await Comment.create({
    content: comment,
    video: videoId,
    owner: req.user._id
  })

  console.log(createComments);
  res.status(201).json({
    message: "Comment added successfully",
    comment: createComments
    });
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment of a video
  const { commentId } = req.params;
  const { updatedComment } = req.body;

  if (!commentId) {
    throw new ApiError(400, "Comment id is missing.");
  }

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, `Comment with id ${commentId} does not exist`);
  }

  if (!updatedComment) {
    throw new ApiError(400, "Comment body is empty");
  }

  // Check if the user is the owner of the comment
  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this comment");
  }

  const updatedCommentDoc = await Comment.findByIdAndUpdate(
    commentId,
    { content: updatedComment },
    { new: true }
  );

  res.status(200).json({
    message: "Comment updated successfully",
    comment: updatedCommentDoc,
  });
});


const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment of a video
  const { commentId } = req.params;

  if (!commentId) {
    throw new ApiError(400, "Comment id is missing.");
  }

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, `Comment with id ${commentId} does not exist`);
  }

  // Check if the user is the owner of the comment
  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this comment");
  }

  // Delete the comment
  await Comment.findByIdAndDelete(commentId);

  res.status(200).json({
    message: "Comment deleted successfully",
  });
});


export { getVideoComments, addComment, updateComment, deleteComment };