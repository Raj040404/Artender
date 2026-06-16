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
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProductCollection' }]
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
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "LogInCollection", required: true, unique: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  address: { type: String, required: true },
  mobileNumber: { type: String, required: true, unique: true },
  artworkCategory: [{ type: String, required: true }],
  paid: { type: Boolean, default: false },

  status: {
    type: String,
    enum: ["pending", "paid", "rejected"],
    default: "pending"
  },

  paymentId: { type: String },
  merchantOrderId: { type: String },
  phonepeOrderId: { type: String },
  phonepeRedirectUrl: { type: String },

}, { timestamps: true });

// Schema for Shop Products
const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  originalPrice: { type: Number }, // For strikethrough logic
  discountPercentage: { type: Number },
  rating: { type: Number, default: 0 },
  reviewsCount: { type: Number, default: 0 },
  imageUrl: { type: String, required: true },
  isNewItem: { type: Boolean, default: false },

  // New field
  type: {
    type: String,
    required: true,
    enum: [
      "Resin Art",
      "Paintings",
      "Home Decor",
      "Jewelry",
      "Accessories",
      "Craft Supplies",
      "Others"
    ]
  }
});

// Schema for Orders (Purchased Items)
const OrderSchema = new mongoose.Schema({

  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "LogInCollection", 
    required: true 
  },

  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductCollection",
        required: true
      },
      quantity: {
        type: Number,
        default: 1
      },
      price: {
        type: Number,
        required: true
      }
    }
  ],

  amount: { 
    type: Number, 
    required: true 
  },
  shippingAddress:{
addressLine:String,
phone:String,
pincode:String
},

  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending"
  },

  merchantOrderId: { type: String },
  phonepeOrderId: { type: String }

}, { timestamps: true });

const CertificateSchema = new mongoose.Schema({
  certificateId: String,
  name: String,
  event: String,
  rank: String,
  date: String
});
// Schema for Cart
const CartSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LogInCollection",
    required: true
  },

  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductCollection",
        required: true
      },
      quantity: {
        type: Number,
        default: 1
      }
    }
  ]

}, { timestamps: true });
const AddressSchema = new mongoose.Schema({

    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"LogInCollection",
        required:true
    },

    addressLine:{
        type:String,
        required:true
    },

    phone:{
        type:String,
        required:true
    },

    pincode:{
        type:String,
        required:true
    }

});
// Schema for Contest Reviews
const ReviewSchema = new mongoose.Schema({
  contestId: { type: String, required: true },
  username: { type: String, required: true },
  review: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 }, // optional
}, { timestamps: true });

const ReviewCollection = mongoose.model("ReviewCollection", ReviewSchema);

const CartCollection = mongoose.model("CartCollection", CartSchema);

const LogInCollection = mongoose.model("LogInCollection", LogInSchema);
const CompetitionPostCollection = mongoose.model("CompetitionPostCollection", CompetitionPostSchema);
const ProfileCollection = mongoose.model("ProfileCollection", ProfileSchema);
const EnrollmentCollection = mongoose.model("EnrollmentCollection", EnrollmentSchema);
const SellerRegistrationCollection = mongoose.model("SellerRegistrationCollection", SellerRegistrationSchema);
const ProductCollection = mongoose.model("ProductCollection", ProductSchema);
const OrderCollection = mongoose.model("OrderCollection", OrderSchema);
const CertificateCollection = mongoose.model("certificates", CertificateSchema);
const AddressCollection = mongoose.model("Address",AddressSchema);


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
  ProductCollection,
  OrderCollection,
  CertificateCollection,
  CartCollection,
  AddressCollection,
   ReviewCollection
};
