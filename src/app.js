const express = require("express");
const app = express();
const path = require("path");
const hbs = require("hbs");
const multer = require("multer");
const session = require("express-session");
const { LogInCollection, CompetitionPostCollection,ProfileCollection,ContestCollection, EnrollmentCollection } = require("./mongodb");
const handlebars = require("hbs");
const MongoStore = require("connect-mongo");



// Register the "startsWith" helper
handlebars.registerHelper("startsWith", (str, prefix) => {
  if (typeof str !== "string" || typeof prefix !== "string") {
    return false;
  }
  return str.startsWith(prefix);
});

// Set up paths
const templatePath = path.join(__dirname, "../templates");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public")); // For serving static files like images and videos

// Set up session management

app.use(
  session({
    secret: "your-secret-key", // Replace with a strong, random secret key
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: "mongodb://localhost:27017/LoginSignup", // Replace with your MongoDB connection string
    }),
    cookie: {maxAge: 24 * 60 * 60 * 1000 }, // Set to true only if using HTTPS
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
const upload = multer({ storage, fileFilter });

// Set up view engine
app.set("view engine", "hbs");
app.set("views", templatePath);

// Routes
app.get("/", (req, res) => {
  res.redirect("/home1");
});

app.get("/home", (req, res) => {
  res.render("home");
});
app.get("/home1", (req, res) => {
  res.render("home1");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (password.length < 7) {
    return res.render("signup", {
      error: "Password must be at least 7 characters long.",
    });
  }

  try {
    const existingUser = await LogInCollection.findOne({ email });
    if (existingUser) {
      return res.render("signup", { error: "Email is already registered." });
    }

    const newUser = new LogInCollection({ name, email, password });
    await newUser.save();

    // Set the session with userId and username after signup
    req.session.userId = newUser._id;
    req.session.username = newUser.name;  // Store the username in the session

    res.redirect("/home");  // Redirect to home after signup
  } catch (err) {
    res.status(500).send("Error signing up. Please try again later.");
  }
});
app.get("/login", (req, res) => {
  res.render("login"); // Render the login page
});


app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await LogInCollection.findOne({ email });

    if (!user) {
      return res.render("login", { error: "User not found. Please sign up." });
    }

    if (user.password === password) {
      req.session.userId = user._id; // Store the userId in session
      req.session.username = user.name; // Store the username in session

      res.render("home", { name: user.name });
    } else {
      res.render("login", { error: "Incorrect password." });
    }
  } catch (err) {
    res.status(500).send("Error logging in. Please try again later.");
  }
});


app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await LogInCollection.findOne({ email });

    if (!user) {
      return res.render("login", { error: "User not found. Please sign up." });
    }

    if (user.password === password) {
      req.session.userId = user._id;
      req.session.username = user.name;

      res.render("home", { name: user.name });
    } else {
      res.render("login", { error: "Incorrect password." });
    }
  } catch (err) {
    res.status(500).send("Error logging in. Please try again later.");
  }
});




app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Error logging out.");
    }
    res.redirect("/login");
  });
});

// Explore Competitions Route
app.get("/explorecompetitions", async (req, res) => {
  try {
    // Fetch posts from the database
    const posts = await CompetitionPostCollection.find().sort({ createdAt: -1 });

    // Format the posts to include Base64 conversion for the `file` field
    const formattedPosts = posts.map((post) => ({
      username: post.username,
      description: post.description,
      file: post.file ? post.file.toString("base64") : null, // Convert the Buffer to Base64
      fileType: post.fileType || "image/png", // Default MIME type
    }));

    // Render the Handlebars template with the formatted posts
    res.render("explorecompetitions", { posts: formattedPosts });
  } catch (err) {
    console.error("Error fetching competition posts:", err.message);
    res.status(500).send("Error loading competitions. Please try again later.");
  }
});


// Post Your Work Route
app.post("/publish", upload.single("file"), async (req, res) => {
  const { description } = req.body;
  const file = req.file; // Multer provides the uploaded file
  const userId = req.session.userId;

  if (!userId) {
    return res.redirect("/login");
  }

  if (!file || !description) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const user = await LogInCollection.findById(userId);
    if (!user) {
      return res.status(400).send("User not found.");
    }

    const newPost = new CompetitionPostCollection({
      username: user.name,
      description,
      file: file.buffer, // Store the binary content of the file
      fileType: file.mimetype,
    });

    await newPost.save();
    res.redirect("/explorecompetitions");
  } catch (err) {
    console.error("Error posting work:", err);
    res.status(500).send("Error posting work. Please try again later.");
  }
});

app.get("/explorecompetitions", async (req, res) => {
  try {
    // Fetch posts from the database
    const posts = await CompetitionPostCollection.find().sort({ createdAt: -1 });

    // Format the posts to include base64 conversion for the file
    const formattedPosts = posts.map((post) => ({
      username: post.username,
      description: post.description,
      file: post.file ? Buffer.from(post.file).toString("base64") : null, // Convert binary file to base64
      fileType: post.fileType || "image/png", // Default to image/png if fileType is missing
    }));

    // Render the explorecompetitions template with posts
    res.render("explorecompetitions", { posts: formattedPosts });
  } catch (err) {
    console.error("Error fetching competition posts:", err.message);
    res.status(500).send("Error loading competitions. Please try again later.");
  }
});


app.get("/profile", async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.redirect("/login"); // Redirect to login if not authenticated
  }

  try {
    // Fetch the user by ID
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

    const formattedPosts = posts.map((post) => ({
      description: post.description,
      file: post.file ? post.file.toString("base64") : null,
      fileType: post.fileType || "image/png",
      createdAt: post.createdAt,
    }));

    // Fetch enrolled contests for the user
    const enrolledContests = await EnrollmentCollection.find({ userName: user.name }).exec();

    // Convert contestId string (if it's stored as a string) to ObjectId
    const contestIds = enrolledContests.map((enrollment) => {
      // Check if contestId is a valid ObjectId, if not, just leave it as a string (we handle string conversion later)
      if (mongoose.Types.ObjectId.isValid(enrollment.contestId)) {
        return new mongoose.Types.ObjectId(enrollment.contestId);
      }
      // If it's a string like "C001", convert it into a valid ObjectId format (you may need to rethink how contestId is used)
      console.warn(`Invalid ObjectId format for contestId: ${enrollment.contestId}, attempting to convert.`);
      return enrollment.contestId; // Temporarily leave as string for debugging
    });

    // Fetch contest details using the contestIds (whether ObjectIds or strings)
    const populatedContests = await ContestCollection.find({ 
      contestId: { $in: contestIds } 
    });

    console.log("Populated Contests:", populatedContests);

    // Pass the results to the view
    res.render("profile", {
      name: profileData.username,
      email: profileData.email,
      bio: profileData.bio,
      followers: profileData.followers,
      location: profileData.location,
      posts: formattedPosts,
      enrolledContests: populatedContests, // Use the populated contests
      profilePicture: profileData.profilePicture ? profileData.profilePicture.toString("base64") : null,
    });
  } catch (err) {
    console.error("Error loading profile:", err.message);
    res.status(500).send("Error loading profile. Please try again later.");
  }
});



// Update Profile Route
app.post("/updateProfile", upload.single('profilePicture'), async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.redirect("/login");
  }

  const { bio, location } = req.body;

  try {
    const user = await LogInCollection.findById(userId);

    if (!user) {
      return res.status(404).send("User not found.");
    }

    const existingProfile = await ProfileCollection.findOne({ email: user.email });

    if (existingProfile) {
      // If a profile exists, update it
      await ProfileCollection.updateOne(
        { email: user.email },
        {
          $set: {
            bio,
            location,
            profilePicture: req.file ? req.file.buffer : existingProfile.profilePicture, // Store the new profile picture
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
        profilePicture: req.file ? req.file.buffer : null, // Store profile picture if uploaded
      });
    }

    res.redirect("/profile"); // Redirect to the profile page
  } catch (err) {
    console.error("Error updating profile:", err.message);
    res.status(500).send("Error updating profile. Please try again later.");
  }
});

app.get("/user/:username", async (req, res) => {
  const { username } = req.params;

  try {
    // Fetch the user from LogInCollection
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
      profilePicture: profile?.profilePicture ? profile.profilePicture.toString("base64") : null,
    };

    // Fetch user's posts from CompetitionPostCollection
    const posts = await CompetitionPostCollection.find({ username: user.name }).sort({ createdAt: -1 });

    // Format posts to include Base64 conversion for file
    const formattedPosts = posts.map((post) => ({
      description: post.description,
      file: post.file ? post.file.toString("base64") : null,
      fileType: post.fileType || "image/png",
      createdAt: post.createdAt,
    }));

    // Render user profile page
    res.render("userProfile", {
      name: profileData.username,
      email: profileData.email,
      bio: profileData.bio,
      followers: profileData.followers,
      location: profileData.location,
      profilePicture: profileData.profilePicture, // Send the profile picture data
      posts: formattedPosts,
    });
  } catch (err) {
    console.error("Error loading user profile:", err.message);
    res.status(500).send("Error loading profile. Please try again later.");
  }
});



app.get("/search", async (req, res) => {
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

    // Format user data with follow status
    const formattedUsers = users.map((user) => {
      const isFollowed = currentUserProfile.following.includes(user.username); // Check if logged-in user is following

      return {
        username: user.username,
        bio: user.bio || "No bio provided.",
        following: user.following || 0, // Ensure 'following' is defined
        isFollowed, // Add follow status
      };
    });

    // Render the template with the users and follow status
    res.render("searchResults", { users: formattedUsers });

  } catch (err) {
    console.error("Error searching users:", err.message);
    res.status(500).send("Error searching users. Please try again later.");
  }
});



app.post('/follow/:username', async (req, res) => {
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


app.get("/competitions", async (req, res) => {
  try {
    const contests = await ContestCollection.find({});
    // Clean up poster URLs if they have unwanted quotes
    contests.forEach(contest => {
      contest.poster = contest.poster.replace(/"/g, '');  // Remove all double quotes
    });
    res.render("competitions", { contests });
  } catch (err) {
    console.error("Error fetching contests:", err);
    res.status(500).send("Error fetching contests. Please try again later.");
  }
});

const mongoose = require("mongoose");
app.get("/enroll/:contestId", async (req, res) => {
  const { contestId } = req.params;

  // Check if the user is logged in
  if (!req.session || !req.session.userId) {
    console.error("Error: User not logged in");
    return res.redirect("/login");
  }

  try {
    // Fetch contest details
    console.log(`Fetching contest with contestId: ${contestId}`);
    const contest = await ContestCollection.findOne({ contestId });
    if (!contest) {
      console.error("Error: Contest not found");
      return res.status(404).send("Contest not found.");
    }
    console.log("Contest found:", contest);

    // Fetch the logged-in user's details
    const user = await LogInCollection.findById(req.session.userId);
    if (!user) {
      console.error("Error: User not found in the database");
      return res.status(404).send("User not found.");
    }
    console.log("User found:", user);

    // Convert contestId to ObjectId if needed
    const contestObjectId = mongoose.Types.ObjectId.isValid(contestId)
      ? mongoose.Types.ObjectId(contestId)
      : contestId;

    // Check if the user is already enrolled in the contest
    const existingEnrollment = await EnrollmentCollection.findOne({
      contestId: contestObjectId, // Use ObjectId for matching
      userName: user.name,
    });

    if (existingEnrollment) {
      console.log(`User ${user.name} is already enrolled in ${contest.name}.`);
      return res.render("enrollment", {
        contest,
        userName: user.name,
        email: user.email,
        alreadyEnrolled: true, // Pass this flag to the frontend
      });
    }

    // If not already enrolled, render the enrollment page with contest and user details
    res.render("enrollment", {
      contest,
      userName: user.name,
      email: user.email,
      alreadyEnrolled: false, // Pass this flag to the frontend
    });

  } catch (err) {
    console.error("Error fetching contest or user details:", err.message);
    res.status(500).send("Error fetching contest details.");
  }
});


// Enrollment Submission Route
app.post("/enroll/:contestId", upload.single("file"), async (req, res) => {
  const { userName, email } = req.body;
  const { contestId } = req.params;
  const file = req.file;

  // Check if the user is logged in (session validation)
  if (!req.session || !req.session.userId) {
    return res.status(403).send("User not logged in.");
  }

  // Check if a file was uploaded
  if (!file) {
    return res.status(400).send("No file uploaded. Please upload an image or video.");
  }

  // Check if the uploaded file is of a valid type
  if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) {
    return res.status(400).send("Invalid file type! Only images and videos are allowed.");
  }

  try {
    // Check if the user is already enrolled in the contest by checking contestId and userName
    const existingEnrollment = await EnrollmentCollection.findOne({ contestId, userName });

    if (existingEnrollment) {
      // If already enrolled, send a response message
      return res.status(400).send("You are already enrolled in this contest.");
    }

    // Convert the file buffer to a Base64 string
    const fileBase64 = file.buffer.toString('base64');

    // Create a new enrollment document
    const newEnrollment = new EnrollmentCollection({
      userName,
      email,
      contestId,
      file: fileBase64, // Store the Base64 string of the file
    });

    // Save the new enrollment to the database
    await newEnrollment.save();

    // Send a success response
    res.send("Enrollment successful!");
  } catch (err) {
    // Handle errors that occur during the save operation
    console.error("Error enrolling user:", err.message);
    res.status(500).send("Error enrolling user. Please try again.");
  }
});






// Start the server
app.listen(3000, () => {
  console.log("Server running at http://localhost:3000/");
});