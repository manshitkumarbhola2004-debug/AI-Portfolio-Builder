require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in .env file");
}

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// SQLITE DATABASE
// ==========================================

const db = new Database("portfolio.db");

db.pragma("journal_mode = WAL");

db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        headline TEXT,
        email TEXT,
        location TEXT,
        education TEXT,
        skills TEXT,
        projects TEXT,
        about TEXT
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Add user_id to existing profile table if needed
const profileColumns = db.prepare(
    "PRAGMA table_info(profile)"
).all();

if (!profileColumns.some(column => column.name === "user_id")) {
    db.exec("ALTER TABLE profile ADD COLUMN user_id INTEGER");
}

// One profile per user
db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_user
    ON profile(user_id)
    WHERE user_id IS NOT NULL
`);

console.log("SQLite database connected successfully!");

// ==========================================
// JWT AUTHENTICATION MIDDLEWARE
// ==========================================

function authenticateToken(req, res, next) {

    const authHeader = req.headers.authorization;

    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: "Authentication required. Please login."
        });
    }

    jwt.verify(token, JWT_SECRET, (error, user) => {

        if (error) {
            return res.status(403).json({
                success: false,
                error: "Invalid or expired token. Please login again."
            });
        }

        req.user = user;

        next();
    });
}

// ==========================================
// TOKEN GENERATOR
// ==========================================

function generateToken(user) {

    return jwt.sign(
        {
            id: user.id,
            email: user.email
        },
        JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
}

// ==========================================
// SIGNUP API
// ==========================================

app.post("/api/auth/signup", async (req, res) => {

    try {

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: "Name, email and password are required."
            });
        }

        if (!email.includes("@")) {
            return res.status(400).json({
                success: false,
                error: "Please enter a valid email."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: "Password must be at least 8 characters."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = db.prepare(
            "SELECT id FROM users WHERE email = ?"
        ).get(normalizedEmail);

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: "Email is already registered."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = db.prepare(`
            INSERT INTO users (name, email, password)
            VALUES (?, ?, ?)
        `).run(
            name.trim(),
            normalizedEmail,
            hashedPassword
        );

        const user = {
            id: result.lastInsertRowid,
            name: name.trim(),
            email: normalizedEmail
        };

        const token = generateToken(user);

        res.status(201).json({
            success: true,
            message: "Account created successfully!",
            token,
            user
        });

    } catch (error) {

        console.error("Signup Error:", error);

        res.status(500).json({
            success: false,
            error: "Signup failed."
        });

    }

});

// ==========================================
// LOGIN API
// ==========================================

app.post("/api/auth/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: "Email and password are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = db.prepare(
            "SELECT * FROM users WHERE email = ?"
        ).get(normalizedEmail);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password."
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password."
            });
        }

        const token = generateToken(user);

        res.json({
            success: true,
            message: "Login successful!",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {

        console.error("Login Error:", error);

        res.status(500).json({
            success: false,
            error: "Login failed."
        });

    }

});

// ==========================================
// GET LOGGED-IN USER
// ==========================================

app.get(
    "/api/auth/me",
    authenticateToken,
    (req, res) => {

        const user = db.prepare(`
            SELECT id, name, email, created_at
            FROM users
            WHERE id = ?
        `).get(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found."
            });
        }

        res.json({
            success: true,
            user
        });

    }
);

// ==========================================
// WAIT HELPER
// ==========================================

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// GEMINI AI HELPER WITH AUTO RETRY
// ==========================================

async function generateAI(prompt, maxTokens = 200) {

    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing in .env file");
    }

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

        try {

            console.log(`AI Request Attempt: ${attempt}/${maxAttempts}`);

            const response = await fetch(url, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],

                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: maxTokens
                    }

                }),

                signal: AbortSignal.timeout(20000)

            });

            const data = await response.json();

            if (response.ok) {

                const generatedText =
                    data.candidates?.[0]?.content?.parts
                        ?.map(part => part.text || "")
                        .join("")
                        .trim();

                if (!generatedText) {
                    throw new Error("AI returned an empty response");
                }

                console.log("AI Response Generated Successfully!");

                return generatedText;

            }

            const errorMessage =
                data.error?.message || "Unknown Gemini API error";

            const retryableErrors = [
                429,
                500,
                502,
                503,
                504
            ];

            const isRetryable =
                retryableErrors.includes(response.status) ||
                errorMessage.toLowerCase().includes("high demand") ||
                errorMessage.toLowerCase().includes("overloaded") ||
                errorMessage.toLowerCase().includes("temporarily");

            console.error("Gemini API Error:", errorMessage);

            if (!isRetryable) {
                throw new Error(errorMessage);
            }

            if (attempt === maxAttempts) {
                throw new Error(
                    "AI is currently busy. Please try again in a few moments."
                );
            }

            const delay = attempt * 3000;

            console.log(
                `AI busy. Retrying in ${delay / 1000} seconds...`
            );

            await wait(delay);

        } catch (error) {

            const isNetworkError =
                error.name === "TimeoutError" ||
                error.name === "AbortError" ||
                error.message.toLowerCase().includes("fetch");

            if (isNetworkError && attempt < maxAttempts) {

                const delay = attempt * 3000;

                console.log(
                    `Network error. Retrying in ${delay / 1000} seconds...`
                );

                await wait(delay);

                continue;

            }

            throw error;

        }

    }

    throw new Error("AI request failed after multiple attempts");

}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {

    res.json({

        status: "Server is running",

        database: "SQLite connected",

        ai: "Gemini configured",

        authentication: "JWT enabled",

        model: GEMINI_MODEL

    });

});

// ==========================================
// GET PROFILE
// ==========================================

app.get(
    "/api/profile",
    authenticateToken,
    (req, res) => {

        try {

            const profile = db.prepare(`
                SELECT * FROM profile
                WHERE user_id = ?
            `).get(req.user.id);

            if (!profile) {
                return res.json({});
            }

            res.json(profile);

        } catch (error) {

            console.error("Profile Error:", error);

            res.status(500).json({
                error: "Failed to fetch profile"
            });

        }

    }
);

// ==========================================
// SAVE PROFILE
// ==========================================

app.post(
    "/api/profile",
    authenticateToken,
    (req, res) => {

        try {

            const {
                name,
                headline,
                email,
                location,
                education,
                skills,
                projects,
                about
            } = req.body;

            const userId = req.user.id;

            const skillsData =
                typeof skills === "string"
                    ? skills
                    : JSON.stringify(skills || []);

            const projectsData =
                typeof projects === "string"
                    ? projects
                    : JSON.stringify(projects || []);

            const existingProfile = db.prepare(`
                SELECT id FROM profile
                WHERE user_id = ?
            `).get(userId);

            if (existingProfile) {

                db.prepare(`
                    UPDATE profile
                    SET name = ?,
                        headline = ?,
                        email = ?,
                        location = ?,
                        education = ?,
                        skills = ?,
                        projects = ?,
                        about = ?
                    WHERE user_id = ?
                `).run(
                    name || "",
                    headline || "",
                    email || "",
                    location || "",
                    education || "",
                    skillsData,
                    projectsData,
                    about || "",
                    userId
                );

            } else {

                db.prepare(`
                    INSERT INTO profile (
                        name,
                        headline,
                        email,
                        location,
                        education,
                        skills,
                        projects,
                        about,
                        user_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    name || "",
                    headline || "",
                    email || "",
                    location || "",
                    education || "",
                    skillsData,
                    projectsData,
                    about || "",
                    userId
                );

            }

            res.json({

                success: true,

                message: "Profile saved successfully!"

            });

        } catch (error) {

            console.error("Save Profile Error:", error);

            res.status(500).json({
                error: "Failed to save profile"
            });

        }

    }
);

// ==========================================
// AI 1: ABOUT ME GENERATOR
// ==========================================

app.post(
    "/api/ai/generate-about",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                name,
                headline,
                education,
                skills,
                projects
            } = req.body;

            const prompt = `
Write a professional portfolio About Me section.

Name: ${name || "Developer"}
Headline: ${headline || "Student and Developer"}
Education: ${education || "Not provided"}
Skills: ${skills || "Not provided"}
Projects: ${projects || "Not provided"}

Instructions:
- Maximum 100 words.
- Use professional but natural English.
- Make it suitable for a personal portfolio.
- Highlight technical skills and career interests.
- Do not invent qualifications.
- Do not use bullet points.
- Return ONLY the paragraph.
`;

            const result = await generateAI(prompt, 150);

            res.json({
                success: true,
                text: result
            });

        } catch (error) {

            console.error("About Me Generator Error:", error);

            res.status(500).json({
                error: error.message
            });

        }

    }
);

// ==========================================
// AI 2: CONTENT IMPROVER
// ==========================================

app.post(
    "/api/ai/improve",
    authenticateToken,
    async (req, res) => {

        try {

            const text =
                req.body.text ||
                req.body.rawText ||
                req.body.content ||
                "";

            if (!text.trim()) {

                return res.status(400).json({
                    error: "Please enter some text to improve"
                });

            }

            const prompt = `
Improve the following text for a professional portfolio.

Original text:
${text}

Instructions:
- Correct grammar.
- Improve clarity.
- Make it professional.
- Keep the original meaning.
- Do not make it unnecessarily long.
- Return ONLY the improved text.
`;

            const result = await generateAI(prompt, 200);

            res.json({
                success: true,
                text: result
            });

        } catch (error) {

            console.error("Content Improver Error:", error);

            res.status(500).json({
                error: error.message
            });

        }

    }
);

// ==========================================
// AI 3: PROJECT GENERATOR
// ==========================================

app.post(
    "/api/ai/generate-project",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                topic,
                technologies,
                name,
                features,
                purpose
            } = req.body;

            const projectTopic =
                topic || name || "Web Development Project";

            const techStack =
                technologies || "JavaScript, HTML, CSS";

            const projectFeatures =
                features || "Modern user interface";

            const projectPurpose =
                purpose || "Portfolio project";

            const prompt = `
Generate a professional portfolio project description.

Project Topic: ${projectTopic}
Technologies: ${techStack}
Features: ${projectFeatures}
Purpose: ${projectPurpose}

Instructions:
- Write a project title.
- Write a short professional description.
- Mention key features.
- Mention technologies used.
- Keep the description concise.
- Do not invent features that are not provided.
- Format the response clearly.
`;

            const result = await generateAI(prompt, 250);

            res.json({
                success: true,
                text: result
            });

        } catch (error) {

            console.error("Project Generator Error:", error);

            res.status(500).json({
                error: error.message
            });

        }

    }
);

// ==========================================
// FRONTEND
// ==========================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );

});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {

    console.log("");
    console.log("==================================");
    console.log("AI PORTFOLIO BUILDER STARTED");
    console.log("==================================");
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Model: ${GEMINI_MODEL}`);
    console.log("Database: SQLite");
    console.log("Authentication: JWT");
    console.log("AI: Gemini");
    console.log("==================================");
    console.log("");

});