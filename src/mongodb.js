const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/LoginSignup";

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB Connected Successfully!");
  })
  .catch((err) => {
    console.log("Failed to Connect!", err);
  });

// Schema for User Login
const LogInSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
});

const CompetitionPostSchema = new mongoose.Schema({
  username: { type: String, required: true },
  description: { type: String, required: true },
  file: { type: Buffer, required: true },
  fileType: { type: String, required: true },
  postNo: { type: Number, required: true }, // Add post number field
  createdAt: { type: Date, default: Date.now },
  likes: { type: [String], default: [] }, // Store liked usernames
});




// Schema for User Profile
const ProfileSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  bio: {
    type: String,
    default: "No bio added yet.",
  },
  followers: {
    type: Number,
    default: 0,
  },
  following: {
    type: [String],
    default: [] 
  }, // Array of usernames this user follows
  location: {
    type: String,
    default: "No location added.",
  },
  profilePicture: { // New field to store profile picture
    type: Buffer,
  },
});

const ContestSchema = new mongoose.Schema({
  contestId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  poster: { type: String }, 
  deadline: { type: Date, required: true },
  price: { type: Number, required: true },
  type: { type: String },
  theme: { type: String },
});

const EnrollmentSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
  },
  contestId: {
    type: String,
    ref: "Contest", // Reference to the Contest collection
    required: true,
  },
  orderId: { 
    type: String, 
 // Ensure the order ID is unique for each enrollment
    unique: true 
  },
  paymentId: { 
    type: String, 
    // required: true, // Ensure that each enrollment has a valid payment ID
  },
  file: { 
    type: Buffer, // Optional field for uploaded file (image/video) 
  },
  createdAt: { 
    type: Date, 
    default: Date.now // Automatically capture the enrollment date
  }
});

const EnrollmentCollection = mongoose.model("Enrollment", EnrollmentSchema);
const ContestCollection = mongoose.model("Contest", ContestSchema);
const LogInCollection = mongoose.model("LogInCollection", LogInSchema);
const CompetitionPostCollection = mongoose.model(
  "CompetitionPostCollection",
  CompetitionPostSchema
);
const ProfileCollection = mongoose.model("ProfileCollection", ProfileSchema);

module.exports = { LogInCollection, CompetitionPostCollection, ProfileCollection, ContestCollection, EnrollmentCollection };
