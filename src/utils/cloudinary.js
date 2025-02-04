import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload an image
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    //upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // file has been uploaded successfull
    //console.log("file is uploaded on cloudinary ", response.url);

    const { url, public_id, duration } = response;

    fs.unlinkSync(localFilePath);
    return { url, public_id, duration };
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the upload operation got failed
    console.error("Cloudinary upload error:", error);
    return null;
  }
};

// Function to delete video or thumbnail from Cloudinary using public_id
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      throw new Error(
        "Public ID is required to delete the file from Cloudinary"
      );
    }

    // Deleting the file from Cloudinary using the public_id
    const response = await cloudinary.uploader.destroy(publicId);
    return response;
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return null;
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
