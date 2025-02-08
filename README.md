# Artender: Where Creativity Blooms and Art Shines Bright

![Artender Homepage](gitimage\home.png)

Artender is a platform designed to unleash creativity and celebrate talent. It provides a space where artists can showcase their work, participate in competitions, and connect with other creatives. Whether you're an artist, photographer, musician, or just someone who appreciates art, Artender is the place for you.

## Features

- **Explore Artworks**: Browse through a collection of artworks submitted by users from around the world.
- **Participate in Competitions**: Join various art competitions and showcase your talent.
- **User Profiles**: Create and customize your profile, upload your works, and gain followers.
- **Search Users**: Find and follow other users to stay updated with their latest creations.
- **Enroll in Contests**: Participate in contests by submitting your work and competing for prizes.

## Screenshots

### Explore Artworks
![Explore Artworks](gitimage\explore artworks.png)

### Participate in Competitions
![Participate in Competitions](Sgitimage\participate.png)

### Error in Enrollment
![Error in Enrollment](gitimage\enrollment.png)

## How to Run the Project

### Prerequisites

- Node.js installed on your machine.
- MongoDB installed and running locally.

### Installation

# Artender

## Install Dependencies
```bash
npm install
```

## Set Up MongoDB
Ensure MongoDB is running on your local machine. The application connects to a database named **LoginSignup** by default.

## Run the Application
```bash
node app.js
```
The server will start running on [http://localhost:3000](http://localhost:3000).

## Usage

### Sign Up/Log In
- Visit [http://localhost:3000/signup](http://localhost:3000/signup) to create a new account.
- Visit [http://localhost:3000/login](http://localhost:3000/login) to log in to your existing account.

### Explore Artworks
After logging in, you can explore artworks submitted by other users by visiting [http://localhost:3000/explorecompetitions](http://localhost:3000/explorecompetitions).

### Post Your Work
You can post your own work by navigating to the **Post Your Work** section and uploading your file along with a description.

### Participate in Competitions
- Visit [http://localhost:3000/competitions](http://localhost:3000/competitions) to view ongoing competitions.
- Click on **Enroll** to participate in a competition by submitting your work.

### Update Your Profile
Customize your profile by adding a bio, location, and profile picture. Visit [http://localhost:3000/profile](http://localhost:3000/profile) to update your profile.

### Search Users
Use the search functionality to find and follow other users. Visit [http://localhost:3000/search](http://localhost:3000/search) to search for users by name.

## Project Structure
```
├── app.js            # Main entry point, sets up Express server and routes
├── mongodb.js        # MongoDB connection and schema definitions
├── public/           # Contains static files like images and CSS
├── templates/        # Handlebars templates for rendering views
```

## Dependencies
- **Express**: Web framework for Node.js.
- **Mongoose**: MongoDB object modeling for Node.js.
- **Handlebars**: Templating engine for rendering views.
- **Multer**: Middleware for handling file uploads.
- **Express-session**: Middleware for managing user sessions.

## Contributing
Contributions are welcome! If you have any suggestions or improvements, feel free to open an issue or submit a pull request.

## License
This project is licensed under the **MIT License**. See the `LICENSE` file for more details.

## Acknowledgments
Thanks to all the artists and creators who inspire us every day.

Special thanks to the open-source community for providing the tools and libraries that made this project possible.

**Artender** is more than just a platform; it's a community where creativity knows no bounds. Join us today and let your art shine! 🎨✨
