require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db"); // Ensure you have a database connection setup


console.log("Database instance:", db);  // ✅ Check what is being imported

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// API Keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'No token provided' });
    }
  
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };



// **New Route for Flight Search**

  
  // Save Itinerary Endpoint
  app.post("/api/save-itinerary", verifyToken, (req, res) => {
    try {
      const { city, arrival, departure, itinerary, preferences } = req.body;
      const userId = req.userId;
  
      // Validate required fields
      if (!city || !arrival || !departure || !itinerary) {
        return res.status(400).json({ 
          message: 'Missing required fields. City, arrival, departure, and itinerary are required.' 
        });
      }
  
      const itineraryJSON = JSON.stringify(itinerary);
      const preferencesJSON = JSON.stringify(preferences || []);
  
      const result = db.prepare(`
        INSERT INTO saved_itineraries (
          user_id, 
          city, 
          arrival_date, 
          departure_date, 
          preferences, 
          itinerary_items
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        city,
        arrival,
        departure,
        preferencesJSON,
        itineraryJSON
      );
  
      if (result.changes > 0) {
        res.json({ message: 'Itinerary saved successfully' });
      } else {
        throw new Error('Failed to save itinerary');
      }
    } catch (error) {
      console.error('Error saving itinerary:', error);
      res.status(500).json({ message: 'Failed to save itinerary' });
    }
  });
  
  // Get User's Saved Itineraries Endpoint
  app.get("/api/saved-itineraries", verifyToken, (req, res) => {
    console.log("Fetching saved itineraries for user ID:", req.userId);
    try {
      const userId = req.userId;
      
      const savedItineraries = db.prepare(`
        SELECT * FROM saved_itineraries 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `).all(userId);
      // Parse JSON strings back to arrays
      const formattedItineraries = savedItineraries.map(itinerary => ({
        ...itinerary,
        itinerary_items: JSON.parse(itinerary.itinerary_items)
      }));
      console.log("Formatted itineraries:", formattedItineraries);
      res.json(formattedItineraries);
    } catch (error) {
      console.error('Error fetching saved itineraries:', error);
      res.status(500).json({ message: 'Failed to fetch saved itineraries' });
    }
  });

// **User Signup**
app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    console.log ("Signup request received:", { username, email });
    // Check if username or email already exists
    const existingUser = db.prepare("SELECT * FROM users WHERE username = ? OR email = ?").get(username, email);
    if (existingUser) {
        console.log("User already exists:", existingUser);
      return res.status(400).json({ message: "Username or email already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user
    const result = db.prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)").run(username, email, hashedPassword);
    const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: "24h" });
    console.log("New user created:", { username, email, id: result.lastInsertRowid });
    res.json({ token });
  } catch (error) {
    console.log("Error during signup:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// **User Login**
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user in database
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Validate password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT Token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// **Generate Itinerary**
app.post("/generate-itinerary", async (req, res) => {
  const { city, arrival, departure, preferences } = req.body;
  console.log("Itinerary request received:", { city, arrival, departure, preferences });

  try {
    const prompt = `Create an hour-by-hour travel itinerary for ${city} from ${arrival} to ${departure}. Prioritize ${preferences}. Make sure the plan is well-balanced.`;

    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4",
      messages: [{ role: "system", content: "You are a helpful assistant." }, { role: "user", content: prompt }],
      max_tokens: 900,
    }, {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    });

    const itinerary = response.data.choices[0].message.content.trim().split("\n");
    console.log("Generated itinerary:", itinerary);
    res.json({ itinerary });

  } catch (error) {
    console.error("AI error:", error.response?.data || error.message);
    res.status(500).json({ error: "Error generating itinerary" });
  }
});

// **Get City Image**
app.post("/get-city-image", async (req, res) => {
  const { city } = req.body;
  console.log("City image request received:", city);

  try {
    console.log("The api key is " +UNSPLASH_ACCESS_KEY);
    const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(city)}&client_id=${UNSPLASH_ACCESS_KEY}&per_page=1`;
    const response = await axios.get(unsplashUrl);
    console.log("Unsplash response:", response);
    const data = response.data;
    console.log(data);
    if (!data.results || data.results.length === 0) {
      return res.status(404).json({ error: "City image not found" });
    }

    const imageUrl = data.results[0].urls.regular;
    res.json({ city, imageUrl });

  } catch (error) {
    console.error("Error fetching city image:", error);
    res.status(500).json({ error: "Failed to fetch city image" });
  }
});

// **Fetch Weather Data**
app.post("/get-weather", async (req, res) => {
  const { city } = req.body;
  console.log  ("Weather request received:", city);

  try {
    const response = await axios.get("https://api.openweathermap.org/data/2.5/forecast", {
      params: { q: city, units: "metric", appid: OPENWEATHER_API_KEY }
    });

    const forecast = response.data.list.filter(item => item.dt_txt.includes("12:00:00")).map(item => ({
      date: item.dt_txt.split(" ")[0],
      description: item.weather[0].description,
      temperature: item.main.temp,
      icon: `https://openweathermap.org/img/wn/${item.weather[0].icon}.png`
    }));

    res.json({ forecast });
  } catch (error) {
    console.error("Error fetching weather forecast:", error);
    res.status(500).json({ error: "Failed to fetch weather forecast" });
  }
});

// **Start Server**
app.listen(5000, () => console.log("Server running on port 5000"));
