const express = require("express");
const app = express();
const path = require("path");
const hbs = require("hbs");
const multer = require("multer");
const session = require("express-session");
const { LogInCollection, CompetitionPostCollection, ProfileCollection, ContestCollection, EnrollmentCollection } = require("./mongodb");
const handlebars = require("hbs");
const MongoStore = require("connect-mongo");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const axios = require("axios");
const rateLimit = require('express-rate-limit');
const crypto = require("crypto"); // Add this for hashing

// ✅ Register the "json" helper in hbs
hbs.registerHelper("json", function (context) {
  return JSON.stringify(context);
});


// Register the "startsWith" helper
handlebars.registerHelper("startsWith", (str, prefix) => {
  if (typeof str !== "string" || typeof prefix !== "string") {
    return false;
  }
  return str.startsWith(prefix);
});

handlebars.registerHelper("formatPrice", (price, currency = "INR") => {
  if (typeof price !== "number") {
    return "Invalid Price";
  }

  // Ensure currency is a string
  const validCurrency = typeof currency === "string" ? currency : "INR";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: validCurrency,
  }).format(price);
});



// Set up paths
const templatePath = path.join(__dirname, "../templates");


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));



// Set up session management
require("dotenv").config();

// Trust proxy for platforms like Render
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Rate limiter (apply early)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
  keyGenerator: (req) => req.ip
});
app.use(limiter);

// Set up session management
app.use(
  session({
    secret: process.env.secret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    }
  })
);

// Set up Multer for image and video uploads
const storage = multer.memoryStorage(); // Use memory storage to store the file as Buffer
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type! Only images and videos are allowed."), false);
  }
};
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB file size
    fieldSize: 25 * 1024 * 1024 // 25MB for text fields (increase as needed)
  }
});

// Set up view engine
app.set("view engine", "hbs");
app.set("views", templatePath);

// Authentication middleware
function requireLogin(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.redirect("/login");
  }
}

// Public routes (no login required)
app.get("/", (req, res) => {
  res.redirect("/home1");
});
app.get("/home1", (req, res) => {
  res.render("home1");
});
app.get("/signup", (req, res) => {
  res.render("signup");
});
app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/about", (req, res) => {
  res.render("about");
});
app.get("/help", (req, res) => {
  res.render("help");
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,  // Use App Password from Google
  },
});

// Store OTPs temporarily
const otpStorage = {};

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (password.length < 8) {
    return res.render("signup", {
      error: "Password must be at least 8 characters long.",
    });
  }

  try {
    const existingUser = await LogInCollection.findOne({
      $or: [{ email }, { name }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.render("signup", { error: "Email is already registered." });
      }
      if (existingUser.name === name) {
        return res.render("signup", { error: "Username is already taken." });
      }
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage[email] = otp;

    // Send OTP via email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for Signup",
      text: `Your OTP for signing up is ${otp}. This OTP is valid for 5 minutes.`,
    });

    // Store user data in session
    req.session.tempUser = { name, email, password };

    return res.render("verifyOTP", { email });
  } catch (err) {
    console.error(err);
    res.status(500).render("signup", { error: "Error signing up. Please try again later." });
  }
});


// Verify OTP Route
app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (otpStorage[email] && otpStorage[email] == otp) {
    const { name, email, password } = req.session.tempUser;

    // Save user to the database
    const newUser = new LogInCollection({ name, email, password });
    await newUser.save();

    // Set session and redirect to home
    req.session.userId = newUser._id;
    req.session.username = newUser.name;

    delete otpStorage[email]; // Clear OTP after verification
    delete req.session.tempUser; // Clear temporary session data

    return res.redirect("/home");
  } else {
    return res.render("verifyOTP", { email, error: "Invalid OTP. Please try again." });
  }
});

app.post("/resend-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Invalid email." });
  }

  try {
    // Generate a new OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage[email] = otp;

    // Send OTP via email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your New OTP for Signup",
      text: `Your new OTP is ${otp}. This OTP is valid for 5 minutes.`,
    });

    return res.json({ success: true, message: "OTP resent successfully." });
  } catch (err) {
    console.error("Error resending OTP:", err);
    return res.status(500).json({ success: false, message: "Failed to resend OTP." });
  }
});

// Login POST route
app.post("/login", async (req, res) => {
  const { loginType, loginInput, password } = req.body; // Accept email or username

  try {
    // Find the user by either email or username
    let user;
    if (loginType === "email") {
      user = await LogInCollection.findOne({ email: loginInput });
    } else {
      user = await LogInCollection.findOne({ name: loginInput });
    }

    if (!user) {
      return res.render("login", { error: "User not found. Please sign up." });
    }

    // Validate password
    if (user.password === password) {
      req.session.userId = user._id;
      req.session.username = user.name;
      req.session.email = user.email; // <-- ADD THIS LINE
      res.redirect("/home");
    } else {
      res.render("login", { error: "Incorrect password." });
    }
  } catch (err) {
    console.error("Error logging in:", err);
    res.status(500).send("Error logging in. Please try again later.");
  }
});

// Protected routes (login required)
app.get("/home", requireLogin, (req, res) => {
  res.render("home");
});
app.get("/completeenrollment", requireLogin, (req, res) => {
  const contestId = req.query.contestId || "";
  res.render("completeenrollment", { contestId });
});

app.get("/paymentfailed", (req, res) => {
  const reason = req.query.reason || "Unknown error";
  res.render("paymentfailed", { reason });
});
app.get("/paymentpending", (req, res) => {
  const reason =  "Unknown error";
  res.render("paymentpending", { reason });
});

app.get("/explorecompetitions", requireLogin, async (req, res) => {
  try {
    const userId = req.session.userId; // ✅ Get logged-in user ID

    // Fetch all competition posts
    const posts = await CompetitionPostCollection.find().sort({ createdAt: -1 });

    // Extract unique usernames
    const usernames = [...new Set(posts.map((post) => post.username))];

    // Fetch profiles of post authors
    const profiles = await ProfileCollection.find({ username: { $in: usernames } });

    // Map profile pictures to usernames
    const profileMap = profiles.reduce((map, profile) => {
      map[profile.username] = profile.profilePicture
        ? `data:image/jpeg;base64,${profile.profilePicture.toString("base64")}`
        : null;
      return map;
    }, {});

    // Format posts with like information
    const formattedPosts = posts.map((post) => {
      return {
        username: post.username, // Post owner's username
        description: post.description,
        file: post.file ? post.file.toString("base64") : null,
        fileType: post.fileType || "image/png",
        profilePicture: profileMap[post.username] || "/default-profile.png", // Use default if no profile picture
        postNo: post.postNo, // Ensure postNo is included
        likeCount: post.likes.length, // Send only the count for display
        isLiked: post.likes.includes(userId), // ✅ Check if logged-in user has liked the post
      };
    });

    // Render the explore competitions page
    res.render("explorecompetitions", { posts: formattedPosts });
  } catch (err) {
    console.error("Error fetching competition posts:", err);
    res.status(500).send("Error loading competitions. Please try again later.");
  }
});

// Publish Post Route
app.post("/publish", requireLogin, upload.single("file"), async (req, res) => {
  const { description, croppedImageData } = req.body;
  const file = req.file; // Uploaded file from Multer
  const userId = req.session.userId;

  // --- Cooldown logic: 10 seconds (10,000 ms) ---
  const COOLDOWN_MS = 10 * 1000; // 10 seconds cooldown
  const now = Date.now();
  if (req.session.lastPostTime && now - req.session.lastPostTime < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - (now - req.session.lastPostTime)) / 1000);
    return res.status(429).send(`Please wait ${waitSec} seconds before posting again.`);
  }
  // --------------------------------------------

  if (!userId) {
    return res.redirect("/login");
  }

  if (!description || (!file && !croppedImageData)) {
    return res.status(400).send("Description and an image are required.");
  }

  try {
    const user = await LogInCollection.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Calculate the next post number for the user
    const lastPost = await CompetitionPostCollection.findOne({ username: user.name }).sort({
      postNo: -1,
    });
    const nextPostNo = lastPost ? lastPost.postNo + 1 : 1;

    let fileBuffer = null;
    let fileType = null;

    // Handle cropped image (base64)
    if (croppedImageData) {
      const base64Data = croppedImageData.replace(/^data:image\/\w+;base64,/, "");
      fileBuffer = Buffer.from(base64Data, "base64");
      fileType = "image/jpeg"; // Default to JPEG from Cropper.js
    }
    // Fallback to multer-uploaded file
    else if (file) {
      fileBuffer = file.buffer;
      fileType = file.mimetype;
    }

    // Create a new post with `postNo`
    const newPost = new CompetitionPostCollection({
      username: user.name,
      description,
      file: fileBuffer,
      fileType,
      postNo: nextPostNo,
      likes: [],
      createdAt: new Date(),
    });

    await newPost.save();

    // --- Set last post time in session ---
    req.session.lastPostTime = now;
    // -------------------------------------

    res.redirect("/explorecompetitions");
  } catch (err) {
    console.error("Error posting work:", err.message);
    res.status(500).send("Error posting work. Please try again later.");
  }
});

app.post("/delete-post/:postNo", requireLogin, async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).send("Unauthorized. Please log in.");
  }

  try {
    const user = await LogInCollection.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    const post = await CompetitionPostCollection.findOneAndDelete({
      username: user.name,
      postNo: req.params.postNo
    });

    if (!post) {
      return res.status(404).send("Post not found or you are not authorized to delete it.");
    }

    res.redirect("/profile");
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).send("Error deleting post. Please try again later.");
  }
});

app.post("/edit-post/:postNo", requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const { description } = req.body;

  if (!userId) {
    return res.status(401).send("Unauthorized. Please log in.");
  }

  try {
    const user = await LogInCollection.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    const post = await CompetitionPostCollection.findOneAndUpdate(
      { username: user.name, postNo: req.params.postNo },
      { description },
      { new: true }
    );

    if (!post) {
      return res.status(404).send("Post not found or you are not authorized to edit it.");
    }

    res.redirect("/profile");
  } catch (err) {
    console.error("Error updating post:", err);
    res.status(500).send("Error updating post. Please try again later.");
  }
});



app.get("/profile", requireLogin, async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.redirect("/login");
  }

  try {
    const user = await LogInCollection.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Fetch profile details
    const profile = await ProfileCollection.findOne({ email: user.email });

    const profileData = profile || {
      username: user.name,
      email: user.email,
      bio: "This is your default bio. Update it in your profile.",
      followers: 0,
      location: "No location set",
    };

    // Fetch user's posts
    const posts = await CompetitionPostCollection.find({ username: user.name }).sort({ createdAt: -1 });

    const formattedPosts = posts.map((post) => {
      return {
        username: post.username,
        description: post.description,
        file: post.file ? post.file.toString("base64") : null,
        fileType: post.fileType || "image/png",
        postNo: post.postNo,
        likes: post.likes, // Send the full likes array
        likeCount: post.likes.length, // Send only the count for display
        isLiked: post.likes.includes(userId), // Check if the logged-in user liked it
      };
    });

    // Fetch enrolled contests for the user
    const enrolledContests = await EnrollmentCollection.find({ userName: user.name }).exec();
    const contestIds = enrolledContests.map((enrollment) => enrollment.contestId);
    const populatedContests = await ContestCollection.find({ contestId: { $in: contestIds } });

    // Pass the results to the view
    res.render("profile", {
      name: profileData.username,
      email: profileData.email,
      bio: profileData.bio,
      followers: profileData.followers,
      location: profileData.location,
      posts: formattedPosts,
      enrolledContests: populatedContests,
      profilePicture: profileData.profilePicture ? profileData.profilePicture.toString("base64") : null,
    });
  } catch (err) {
    console.error("Error loading profile:", err.message);
    res.status(500).send("Error loading profile. Please try again later.");
  }
});



app.post("/updateProfile", requireLogin, upload.single("profilePicture"), async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.redirect("/login");
  }

  const { bio, location, croppedImageData } = req.body;

  try {
    const user = await LogInCollection.findById(userId);

    if (!user) {
      return res.status(404).send("User not found.");
    }

    const existingProfile = await ProfileCollection.findOne({ email: user.email });

    // Prepare profile picture data
    let profilePictureBuffer = null;

    // Check if a cropped image was provided (base64 string from Cropper.js)
    if (croppedImageData) {
      // Remove the "data:image/jpeg;base64," prefix if present and convert to Buffer
      const base64Data = croppedImageData.replace(/^data:image\/\w+;base64,/, "");
      profilePictureBuffer = Buffer.from(base64Data, "base64");
    }
    // Fallback to multer-uploaded file if no cropped image is provided
    else if (req.file) {
      profilePictureBuffer = req.file.buffer;
    }
    // If neither is provided, retain the existing profile picture (if any)
    else if (existingProfile && existingProfile.profilePicture) {
      profilePictureBuffer = existingProfile.profilePicture;
    }

    if (existingProfile) {
      // If a profile exists, update it
      await ProfileCollection.updateOne(
        { email: user.email },
        {
          $set: {
            bio: bio || existingProfile.bio, // Retain existing bio if not provided
            location: location || existingProfile.location, // Retain existing location if not provided
            profilePicture: profilePictureBuffer, // Update with new buffer or retain existing
          },
        }
      );
    } else {
      // Create a new profile if none exists
      await ProfileCollection.create({
        username: user.name,
        email: user.email,
        bio: bio || "No bio added yet.",
        followers: 0,
        following: [],
        location: location || "No location added.",
        profilePicture: profilePictureBuffer, // Store profile picture if available
      });
    }

    res.redirect("/profile"); // Redirect to the profile page
  } catch (err) {
    console.error("Error updating profile:", err.message);
    res.status(500).send("Error updating profile. Please try again later.");
  }
});

app.get("/user/:username", requireLogin, async (req, res) => {
  try {
    const { username } = req.params;
    const userId = req.session.userId; // ✅ Get logged-in user ID

    // Fetch user from LogInCollection
    const user = await LogInCollection.findOne({ name: username });
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Fetch profile from ProfileCollection
    const profile = await ProfileCollection.findOne({ username: user.name });

    // Use existing profile or provide default values
    const profileData = {
      username: user.name,
      email: user.email,
      bio: profile?.bio || "This user has not updated their profile yet.",
      followers: profile?.followers || 0,
      location: profile?.location || "No location set",
      profilePicture: profile?.profilePicture || null,
    };

    // Fetch user's posts from CompetitionPostCollection
    const posts = await CompetitionPostCollection.find({ username: user.name }).sort({ createdAt: -1 });

    // Format posts to include Base64 conversion for file & like status
    const formattedPosts = posts.map((post) => ({
      username: post.username,
      description: post.description,
      file: post.file ? post.file.toString("base64") : null,
      fileType: post.fileType || "image/png",
      postNo: post.postNo, // Include post number
      likeCount: post.likes.length, // ✅ Send only the count for display
      isLiked: post.likes.includes(userId), // ✅ Check if logged-in user has liked the post
    }));

    // Render user profile page
    res.render("userProfile", {
      name: profileData.username,
      email: profileData.email,
      bio: profileData.bio,
      followers: profileData.followers,
      location: profileData.location,
      profilePicture: profileData.profilePicture ? profileData.profilePicture.toString("base64") : null,
      posts: formattedPosts,
    });
  } catch (err) {
    console.error("Error loading user profile:", err.message);
    res.status(500).send("Error loading profile. Please try again later.");
  }
});





app.get("/search", requireLogin, async (req, res) => {
  const { query } = req.query;
  const loggedInUser = req.session.username; // Get the logged-in user's username from the session

  try {
    // Fetch users matching the query
    const users = await ProfileCollection.find({
      username: { $regex: query, $options: "i" }, // Case-insensitive search
    });

    if (!users || users.length === 0) {
      return res.render("searchResults", { users: [], message: "No users found." });
    }

    // Fetch the logged-in user's profile to check their following list
    const currentUserProfile = await ProfileCollection.findOne({ username: loggedInUser });
    if (!currentUserProfile) {
      return res.status(404).send("Logged-in user profile not found.");
    }

    // Format user data with follow status and profile picture
    const formattedUsers = users.map((user) => {
      const isFollowed = currentUserProfile.following.includes(user.username); // Check if logged-in user is following

      return {
        username: user.username,
        bio: user.bio || "No bio provided.",
        following: user.following || 0, // Ensure 'following' is defined
        isFollowed, // Add follow status
        profilePicture: user.profilePicture
          ? `data:image/jpeg;base64,${user.profilePicture.toString("base64")}`
          : "/default-profile.png", // Use default if no profile picture
      };
    });

    // Render the template with users, profile pictures, and follow status
    res.render("searchResults", { users: formattedUsers });

  } catch (err) {
    console.error("Error searching users:", err.message);
    res.status(500).send("Error searching users. Please try again later.");
  }
});




app.post('/follow/:username', requireLogin, async (req, res) => {
  const { username } = req.params;

  const userId = req.session.userId; // Logged-in user's ID from session

  if (!userId) {
    return res.status(401).send("Unauthorized: Please log in.");
  }

  try {
    // Fetch the logged-in user's profile using their username
    const currentUserProfile = await ProfileCollection.findOne({ username: req.session.username });
    if (!currentUserProfile) {
      return res.status(404).send("Your profile not found.");
    }

    // Fetch the target user's profile using the username
    const userToFollow = await ProfileCollection.findOne({ username });
    if (!userToFollow) {
      return res.status(404).send("User not found.");
    }

    // Prevent self-following
    if (currentUserProfile.username === username) {
      return res.status(400).send("You cannot follow yourself.");
    }

    // Check if the user is already following the target user
    if (currentUserProfile.following.includes(username)) {
      // If already followed, return a message and no further changes are needed
      return res.status(400).send("You are already following this user.");
    }

    // Add to the logged-in user's following list
    currentUserProfile.following.push(username);
    await currentUserProfile.save();

    // Increment followers count for the target user
    userToFollow.followers = (userToFollow.followers || 0) + 1;
    await userToFollow.save();

    res.status(200).send("Followed successfully.");
  } catch (err) {
    console.error("Error following user:", err.message);
    res.status(500).send("An error occurred while following the user.");
  }
});


app.get("/competitions", requireLogin, async (req, res) => {
  try {
    const contests = await ContestCollection.find({});
    // Clean up poster URLs if they have unwanted quotes
    contests.forEach(contest => {
      if (contest.poster && typeof contest.poster === 'string') {
        contest.poster = contest.poster.replace(/"/g, '');
      }
    });
    res.render("competitions", { contests });
  } catch (err) {
    console.error("Error fetching contests:", err);
    res.status(500).send("Error fetching contests. Please try again later.");
  }
});

const mongoose = require("mongoose");

// PhonePe payment callback (restores working logic + token fallback)
app.get("/enroll/phonepe-callback", async (req, res) => {
  // Primary values expected from PhonePe
  let { orderId, contestId } = req.query;
  const token = req.query.token || null;
  console.log("[phonepe-callback] incoming query:", req.query);

  // If PhonePe returned only a token, try to find the enrollment that stored the redirectUrl containing that token
  if (!orderId && token) {
    try {
      const enrollment = await EnrollmentCollection.findOne({ phonepeRedirectUrl: { $regex: token } }).lean();
      if (enrollment) {
        orderId = enrollment.phonepeOrderId || enrollment.paymentId || orderId;
        contestId = contestId || enrollment.contestId || contestId;
        console.log("[phonepe-callback] token matched enrollment:", { userName: enrollment.userName, paymentId: enrollment.paymentId, phonepeOrderId: enrollment.phonepeOrderId });
      } else {
        console.log("[phonepe-callback] token did not match any enrollment");
      }
    } catch (e) {
      console.error("[phonepe-callback] DB lookup error for token:", e.message);
    }
  }

  if (!orderId) {
    console.log("[phonepe-callback] No orderId available; returning generic message");
    return res.send("Callback received. If your payment completed, please wait and check profile.");
  }

  try {
    const accessToken = await getPhonePeAccessToken();
    const statusUrl = `${process.env.PHONEPE_BASE_URL}/checkout/v2/order/${orderId}/status?details=false`;
    console.log("[phonepe-callback] Checking status at:", statusUrl);

    const response = await axios.get(statusUrl, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `O-Bearer ${accessToken}`
      }
    });

    const statusResponse = response.data;
    console.log("[phonepe-callback] PhonePe status response:", statusResponse);

    // Use the state from paymentDetails[0] if present, otherwise fallback to overall state
    const paymentState = statusResponse?.paymentDetails?.[0]?.state || statusResponse?.state;
    console.log("[phonepe-callback] Determined paymentState:", paymentState);

    // Reconcile enrollment using merchantOrderId or phonepe orderId
    const merchantOrderId = statusResponse?.merchantOrderId || statusResponse?.metaInfo?.udf2 || null;
    const query = merchantOrderId ? { paymentId: merchantOrderId } : { phonepeOrderId: orderId };

    if (paymentState === "SUCCESS" || paymentState === "COMPLETED") {
      await EnrollmentCollection.findOneAndUpdate(query, { $set: { paid: true, phonepeOrderId: orderId } }, { new: true });
      console.log("[phonepe-callback] Payment SUCCESS for order:", orderId);
      return res.redirect(`/completeenrollment?contestId=${contestId || (statusResponse?.metaInfo?.udf2 || "")}`);
    } else if (paymentState === "PENDING") {
      console.log("[phonepe-callback] Payment PENDING for order:", orderId);
      return res.redirect(`/paymentpending?orderId=${orderId}`);
    } else {
      const reason = statusResponse?.message || "Payment failed";
      console.log("[phonepe-callback] Payment FAILED for order:", orderId, "Reason:", reason);
      return res.redirect(`/paymentfailed?reason=${encodeURIComponent(reason)}`);
    }
  } catch (err) {
    console.error("[phonepe-callback] Error:", err.response?.data || err.message);
    return res.redirect(`/paymentfailed?reason=${encodeURIComponent(err.message)}`);
  }
});



app.get("/enroll/:contestId", requireLogin, async (req, res) => {
  const { contestId: rawContestId } = req.params;
  const contestId = (rawContestId || "").trim();

  console.log(`[enroll GET] URL: ${req.originalUrl} | method: ${req.method}`);
  console.log("[enroll GET] params:", req.params, "session.userId:", req.session?.userId);

  if (!req.session || !req.session.userId) {
    console.error("[enroll GET] User not logged in");
    return res.redirect("/login");
  }

  try {
    if (!contestId) {
      console.error("[enroll GET] Missing contestId in params");
      return res.status(400).send("Invalid contest id.");
    }

    // Single, consistent lookup
    const contest = await ContestCollection.findOne({ contestId }).lean();
    console.log("[enroll GET] contest lookup result for", contestId, ":", !!contest);

    if (!contest) {
      console.error("[enroll GET] Error: Contest not found for", contestId);
      // stack trace to know where this log originated
      console.trace();
      return res.status(404).send("Contest not found.");
    }

    const user = await LogInCollection.findById(req.session.userId);
    if (!user) {
      console.error("[enroll GET] User not found in DB for session id:", req.session.userId);
      return res.status(404).send("User not found.");
    }

    const existingEnrollment = await EnrollmentCollection.findOne({
      contestId: String(contestId),
      userName: user.name,
    }).lean();

    const alreadyEnrolled = !!(existingEnrollment && existingEnrollment.paid);

    return res.render("enrollment", {
      contest,
      userName: user.name,
      email: user.email,
      alreadyEnrolled,
    });
  } catch (err) {
    console.error("[enroll GET] Error fetching contest or user details:", err);
    return res.status(500).send("Error fetching contest details.");
  }
});



app.post("/like", requireLogin, async (req, res) => {
  const { username, postNo } = req.body;
  const userId = req.session.userId; // ✅ Get logged-in user ID

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }

  try {
    console.log(`🔍 Searching Post - Username: ${username}, Post No: ${postNo}`);

    // ✅ Find the post by `postNo` & `username`
    const post = await CompetitionPostCollection.findOne({ username, postNo });

    if (!post) {
      console.error("❌ Post not found.");
      return res.status(404).json({ error: "Post not found." });
    }

    console.log(`✅ Post Found - ID: ${post._id}, Likes: ${post.likes.length}`);

    // ✅ Check if the user already liked the post
    const userIndex = post.likes.indexOf(userId);
    let updatedLikes;

    if (userIndex === -1) {
      updatedLikes = [...post.likes, userId]; // ✅ Add like
    } else {
      updatedLikes = post.likes.filter((id) => id !== userId); // ✅ Remove like
    }

    // ✅ Use `findOneAndUpdate()` to prevent `VersionError`
    const updatedPost = await CompetitionPostCollection.findOneAndUpdate(
      { _id: post._id },
      { $set: { likes: updatedLikes } },
      { new: true, runValidators: true }
    );

    res.json({
      likes: updatedPost.likes.length,
      isLiked: updatedPost.likes.includes(userId),
    });
  } catch (err) {
    console.error("❌ Error liking post:", err);
    res.status(500).json({ error: "Server error while liking post." });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});
// PhonePe Integration

// Helper: Get PhonePe access token
async function getPhonePeAccessToken() {
  try {
    const tokenUrl = process.env.PHONEPE_TOKEN_URL || 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token';
    console.log("[getPhonePeAccessToken] tokenUrl (from env):", process.env.PHONEPE_TOKEN_URL);
    const requestHeaders = {
      "Content-Type": "application/x-www-form-urlencoded"
    };
    const requestBody = new URLSearchParams({
      client_version: 1,
      grant_type: "client_credentials",
      client_id: process.env.PHONEPE_MERCHANT_ID,
      client_secret: process.env.PHONEPE_MERCHANT_KEY
    }).toString();


    const response = await axios.post(tokenUrl, requestBody, { headers: requestHeaders });
    return response.data.access_token;
  } catch (err) {
    console.error("[getPhonePeAccessToken] Error:", err.response?.data || err.message);
    throw new Error("Failed to get access token from PhonePe.");
  }
}

// Create PhonePe order using PG Checkout API
// Create PhonePe order using PG Checkout API
app.post("/api/create-phonepe-order", requireLogin, upload.single("file"), async (req, res) => {
  try {
    console.log("[create-phonepe-order] URL:", req.originalUrl, "| method:", req.method);
    console.log("[create-phonepe-order] req.body keys:", Object.keys(req.body));
    console.log("[create-phonepe-order] req.file:", req.file ? req.file.originalname : "No file uploaded");

    const contestId = (req.body.contestId || req.query.contestId || "").trim();
    const phone = req.body.phone;
    console.log("[create-phonepe-order] contestId extracted:", JSON.stringify(contestId));

    // Validate contest
    const contest = await ContestCollection.findOne({ contestId }).lean();
    console.log("[create-phonepe-order] contest lookup result for", contestId, ":", !!contest);
    if (!contest) return res.status(404).json({ error: "Contest not found" });

    // Validate user
    const user = await LogInCollection.findById(req.session.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Validate file
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded." });

    // Validate phone
    let mobileNumber = phone;
    if (!/^\d{10}$/.test(mobileNumber)) {
      return res.status(400).json({ error: "Invalid phone number." });
    }

    const orderId = `ARTENDER_${contestId}_${user._id}_${Date.now()}`;
    console.log(`[create-phonepe-order] Generated orderId: ${orderId}`);


    // Save enrollment with paid: false
    await EnrollmentCollection.findOneAndUpdate(
      { userName: user.name, contestId: String(contestId) },
      {
        userName: user.name,
        email: user.email,
        contestId: String(contestId),
        file: file.buffer.toString("base64"),
        fileType: file.mimetype,
        paid: false,
        phone: mobileNumber,
        paymentId: orderId,
      },
      { upsert: true, new: true }
    );

    // ✅ Step 1: Get access token
    const accessToken = await getPhonePeAccessToken();

    // ✅ Step 2: Create order using env
    const base = (process.env.PHONEPE_BASE_URL || "https://api.phonepe.com/apis/pg").replace(/\/+$/,'');
    console.log("[create-phonepe-order] PHONEPE_BASE_URL (from env):", process.env.PHONEPE_BASE_URL);
    console.log("[create-phonepe-order] payUrl:", `${base}/checkout/v2/pay`);
    const payUrl = `${base}/checkout/v2/pay`;
    const requestHeaders = {
      "Content-Type": "application/json",
      Authorization: `O-Bearer ${accessToken}`,
    };
    const amount = Number(contest.price) * 100; // amount in paise

    const requestBody = {
      amount: amount,
      expireAfter: 1200,
      metaInfo: {
        udf1: user.name,
        udf2: contestId,
        udf3: mobileNumber,
        udf4: user.email,
        udf5: "Artender",
      },
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: "Payment for contest enrollment",
        merchantUrls: {
          // Use exact whitelisted callback (no dynamic query params). PhonePe will append params.
          redirectUrl: (process.env.PHONEPE_CALLBACK_URL || "https://www.artender.in/enroll/phonepe-callback"),
        },
      },
      merchantOrderId: orderId,
    };

    const response = await axios.post(payUrl, requestBody, { headers: requestHeaders });
    const data = response.data;

    // Save PhonePe orderId and redirectUrl for reconciliation
    if (data?.orderId || data?.redirectUrl) {
      await EnrollmentCollection.findOneAndUpdate(
        { userName: user.name, contestId: String(contestId) },
        { $set: { phonepeOrderId: data.orderId || null, phonepeRedirectUrl: data.redirectUrl || null } },
        { new: true }
      );
    }

    let redirectUrl = data?.redirectUrl;

    if (redirectUrl) {
      return res.json({ redirectUrl, orderId });
    } else {
      console.error("[create-phonepe-order] Could not find redirectUrl in response:", data);
      return res.status(500).json({ error: "Failed to create PhonePe order", details: data });
    }
  } catch (err) {
    console.error("[create-phonepe-order] Error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Failed to create PhonePe order",
      details: err.response?.data || err.message,
    });
  }
});




// --- Forgot Password Logic ---

// Show forgot password form
app.get("/forgot-password", (req, res) => {
  res.render("forgotPassword");
});

// Handle forgot password form (send OTP)
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await LogInCollection.findOne({ email });
  if (!user) {
    return res.render("forgotPassword", { error: "No account found with this email." });
  }

  // Generate OTP and store in session (expires in 5 min)
  const otp = Math.floor(100000 + Math.random() * 900000);
  req.session.forgotPassword = { email, otp, expires: Date.now() + 5 * 60 * 1000 };

  // Send OTP via email
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Artender Password Reset OTP",
    text: `Your OTP for password reset is ${otp}. This OTP is valid for 5 minutes.`,
  });

  res.render("verifyForgotOTP", { email });
});

// Show OTP verification form (optional, can be combined with above)
app.get("/verify-forgot-otp", (req, res) => {
  res.render("verifyForgotOTP", { email: req.session.forgotPassword?.email });
});

// Handle OTP verification and show reset form
app.post("/verify-forgot-otp", (req, res) => {
  const { email, otp } = req.body;
  const sessionData = req.session.forgotPassword;
  if (
    !sessionData ||
    sessionData.email !== email ||
    sessionData.otp != otp ||
    Date.now() > sessionData.expires
  ) {
    return res.render("verifyForgotOTP", { email, error: "Invalid or expired OTP." });
  }
  // OTP valid, allow password reset
  req.session.forgotPassword.verified = true;
  res.render("resetPassword", { email });
});

// Handle password reset
app.post("/reset-password", async (req, res) => {
  const { email, password } = req.body;
  const sessionData = req.session.forgotPassword;
  if (
    !sessionData ||
    sessionData.email !== email ||
    !sessionData.verified
  ) {
    return res.render("resetPassword", { email, error: "Session expired or unauthorized." });
  }
  if (!password || password.length < 8) {
    return res.render("resetPassword", { email, error: "Password must be at least 8 characters." });
  }

  // Update password securely
  await LogInCollection.findOneAndUpdate({ email }, { password });

  // Clear session
  delete req.session.forgotPassword;

  res.render("login", { error: "Password reset successful. Please log in." });
});



// Start the server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});