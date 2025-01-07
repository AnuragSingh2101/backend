import dotenv from "dotenv"
import connectDB from "./db/index.js";

// import app from "./app.js";

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRouter from './routes/user.routes.js'
const app = express();






dotenv.config({
    path: './env'
})



// Check if the CORS_ORIGIN environment variable is set
const corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin) {
    console.warn('CORS_ORIGIN environment variable is not set!');
}

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))



app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(cookieParser());
app.use(express.static('public'));


app.use("/api/v1/users", userRouter);






connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running on port : ${process.env.PORT}`)
    })
})
.catch((err) => {
    console.error("MONGODB CONNECTION FAIL ! ", err);
})














/*

import express from "express";
const app = express();

(async() => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error) => {
            console.log("Error occurred: ", error);
            throw error
        })


        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
        })


    } catch (error) {
        console.error("ERROR: ", error);
        throw error
    }
})()

*/