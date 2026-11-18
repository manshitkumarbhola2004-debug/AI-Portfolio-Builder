require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 5000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

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

console.log("SQLite database connected successfully!");

// ==========================================
// DATABASE HELPER
// ==========================================

function getProfile() {
    return db.prepare(
        "SELECT * FROM profile ORDER BY id DESC LIMIT 1"
    ).get();
}

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

            // ==========================================
            // SUCCESS
            // ==========================================

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

            // ==========================================
            // TEMPORARY ERRORS
            // ==========================================

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

            // Permanent error: do not retry
            if (!isRetryable) {

                throw new Error(errorMessage);

            }

            // Last attempt: stop retrying
            if (attempt === maxAttempts) {

                throw new Error(
                    "AI is currently busy. Please try again in a few moments."
                );

            }

            // ==========================================
            // RETRY WAITING
            // ==========================================

            const delay = attempt * 3000;

            console.log(
                `AI busy. Retrying in ${delay / 1000} seconds...`
            );

            await wait(delay);

        } catch (error) {

            // Timeout/network errors
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

        model: GEMINI_MODEL

    });

});

// ==========================================
// GET PROFILE
// ==========================================

app.get("/api/profile", (req, res) => {

    try {

        const profile = getProfile();

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

});

// ==========================================
// SAVE PROFILE
// ==========================================

app.post("/api/profile", (req, res) => {

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

        const existingProfile = getProfile();

        const skillsData =
            typeof skills === "string"
                ? skills
                : JSON.stringify(skills || []);

        const projectsData =
            typeof projects === "string"
                ? projects
                : JSON.stringify(projects || []);

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
                WHERE id = ?
            `).run(

                name || "",
                headline || "",
                email || "",
                location || "",
                education || "",
                skillsData,
                projectsData,
                about || "",
                existingProfile.id

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
                    about
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(

                name || "",
                headline || "",
                email || "",
                location || "",
                education || "",
                skillsData,
                projectsData,
                about || ""

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

});

// ==========================================
// AI 1: ABOUT ME GENERATOR
// ==========================================

app.post("/api/ai/generate-about", async (req, res) => {

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

});

// ==========================================
// AI 2: CONTENT IMPROVER
// ==========================================

app.post("/api/ai/improve", async (req, res) => {

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

});

// ==========================================
// AI 3: PROJECT GENERATOR
// ==========================================

app.post("/api/ai/generate-project", async (req, res) => {

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

});

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
    console.log("AI: Gemini");
    console.log("==================================");
    console.log("");

});