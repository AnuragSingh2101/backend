// import express from 'express';
// import cors from "cors" 
// import cookieParser from 'cookie-parser';


// const app = express()

// app.use(cors({
//     origin: process.env.CORS_ORIGIN,
//     credentials: true
// }))

// app.use(express.json({limit:"16kb"}))

// app.use(express.urlencoded({extended: true, limit: "16kb"}))
// app.use(cookieParser());
// app.use(express.static("public"))

// export {app};



import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRouter from './routes/user.routes.js'
const app = express();



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



//routes import




// routes declaration
app.use("/api/v1/users", userRouter);



// http://localhost:8000/api/v1/users/register


export default app;