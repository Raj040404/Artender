const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI;

mongoose
  .connect(mongoURI)
  .then(() => {
    console.log("MongoDB Connected Successfully!");
  })
  .catch((err) => {
    console.log("Failed to Connect!", err);
  });

// Schema for User Login
const LogInSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
});

// Schema for Competition Posts
const CompetitionPostSchema = new mongoose.Schema({
  username: { type: String, required: true },
  description: { type: String, required: true },
  file: { type: Buffer, required: true },
  fileType: { type: String, required: true },
  postNo: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  likes: { type: [String], default: [] },
});

// Schema for User Profile
const ProfileSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  bio: { type: String, default: "No bio added yet." },
  followers: { type: Number, default: 0 },
  following: { type: [String], default: [] },
  location: { type: String, default: "No location added." },
  profilePicture: { type: Buffer },
  phone: { type: String },
});

// Schema for Contest
const ContestSchema = new mongoose.Schema({
  contestId: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true },
  poster: { type: String }, // URL or path to image
  deadline: { type: Date, required: true },
  price: { type: Number, required: true },
  type: { type: String },
  theme: { type: String },
});

// Schema for Enrollment
const EnrollmentSchema = new mongoose.Schema({
  userName: { type: String },
  email: { type: String },
  contestId: { type: String },
  file: { type: String },
  fileType: { type: String },
  phone: { type: String },
  paid: { type: Boolean, default: false },
  paymentId: { type: String },
  merchantOrderId: { type: String },
  phonepeOrderId: { type: String },
  phonepeRedirectUrl: { type: String },
}, { timestamps: true });
const SellerRegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  address: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  artworkCategory: { type: String, required: true },
}, { timestamps: true });
// Models
const LogInCollection = mongoose.model("LogInCollection", LogInSchema);
const CompetitionPostCollection = mongoose.model("CompetitionPostCollection", CompetitionPostSchema);
const ProfileCollection = mongoose.model("ProfileCollection", ProfileSchema);
const EnrollmentCollection = mongoose.model("EnrollmentCollection", EnrollmentSchema);
const SellerRegistrationCollection = mongoose.model(
  "SellerRegistrationCollection",
  SellerRegistrationSchema
);

// If you want to use a separate DB for contests
const conn = mongoose.connection.useDb("test");
const ContestCollection = conn.model("ContestCollection", ContestSchema, "contests");

module.exports = {
  LogInCollection,
  CompetitionPostCollection,
  ProfileCollection,
  ContestCollection,
  EnrollmentCollection,
  SellerRegistrationCollection,
};
