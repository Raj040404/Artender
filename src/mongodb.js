const mongoose = require("mongoose");

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/LoginSignup")
  .then(() => {
    console.log("MongoDB Connected Successfully!");
  })
  .catch(() => {
    console.log("Failed to Connect!");
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

// Schema for Competition Posts
const CompetitionPostSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  file: {
    type: Buffer,
    required: true,
  },
  fileType: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
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
  userName: { type: String, required: true },
  email: { type: String, required: true },
  contestId: { 
    type: String, 
    ref: "Contest",  // Reference to the Contest collection
    required: true 
  },
  paymentId: { type: String, required: false },
  file: { type: Buffer }, // URL or file path
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
