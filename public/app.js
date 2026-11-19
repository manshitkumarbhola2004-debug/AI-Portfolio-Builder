// ==========================================
// PORTFOLIA AI - AUTHENTICATED FRONTEND
// ==========================================

const $ = id => document.getElementById(id);

const TOKEN_KEY = "portfolia_token";

const fields = [
    "name",
    "headline",
    "email",
    "location",
    "education",
    "skills",
    "projects",
    "about"
];


// ==========================================
// AUTHENTICATION HELPERS
// ==========================================

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(url, options = {}) {

    const headers = {
        ...(options.headers || {})
    };

    const token = getToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401 || response.status === 403) {
        clearToken();
        showAuthScreen();
        throw new Error("Session expired. Please login again.");
    }

    return response;
}


// ==========================================
// SHOW LOGIN / SIGNUP
// ==========================================

function showAuthScreen() {

    $("authScreen").hidden = false;
    $("appNavbar").hidden = true;
    $("dashboard").hidden = true;

    $("loginForm").hidden = false;
    $("signupForm").hidden = true;

    $("authMessage").textContent = "";

}

function showDashboard(user) {

    $("authScreen").hidden = true;
    $("appNavbar").hidden = false;
    $("dashboard").hidden = false;

    $("loggedUserName").textContent =
        user.name || user.email;

    render();

}

$("showSignup").addEventListener("click", () => {

    $("loginForm").hidden = true;
    $("signupForm").hidden = false;

    $("authMessage").textContent = "";

});

$("showLogin").addEventListener("click", () => {

    $("signupForm").hidden = true;
    $("loginForm").hidden = false;

    $("authMessage").textContent = "";

});


// ==========================================
// SIGNUP
// ==========================================

$("signupForm").addEventListener("submit", async event => {

    event.preventDefault();

    const button = $("signupButton");

    const name = $("signupName").value.trim();
    const email = $("signupEmail").value.trim();
    const password = $("signupPassword").value;

    button.disabled = true;
    button.textContent = "Creating Account...";

    $("authMessage").textContent = "";

    try {

        const response = await fetch("/api/auth/signup", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name,
                email,
                password
            })

        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Signup failed");
        }

        saveToken(data.token);

        $("signupForm").reset();

        showDashboard(data.user);

        $("message").textContent =
            "✓ Account created successfully!";

        await loadProfile();

    } catch (error) {

        $("authMessage").textContent =
            error.message;

    } finally {

        button.disabled = false;
        button.textContent = "Create Account";

    }

});


// ==========================================
// LOGIN
// ==========================================

$("loginForm").addEventListener("submit", async event => {

    event.preventDefault();

    const button = $("loginButton");

    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    button.disabled = true;
    button.textContent = "Logging in...";

    $("authMessage").textContent = "";

    try {

        const response = await fetch("/api/auth/login", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                password
            })

        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Login failed");
        }

        saveToken(data.token);

        $("loginForm").reset();

        showDashboard(data.user);

        $("message").textContent =
            "✓ Login successful!";

        await loadProfile();

    } catch (error) {

        $("authMessage").textContent =
            error.message;

    } finally {

        button.disabled = false;
        button.textContent = "Login";

    }

});


// ==========================================
// LOGOUT
// ==========================================

$("logoutButton").addEventListener("click", () => {

    clearToken();

    $("profileForm").reset();

    $("message").textContent = "";

    $("aiStatus").textContent = "";

    $("improveResult").hidden = true;
    $("projectResult").hidden = true;

    showAuthScreen();

});


// ==========================================
// HTML SECURITY
// ==========================================

function escapeHtml(value) {

    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[character]));

}

function escapeAttr(value) {
    return escapeHtml(value);
}


// ==========================================
// PROJECT PARSER
// ==========================================

function parseProjects(value) {

    return value
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {

            const [name = "", description = "", link = ""] =
                line.split("|").map(x => x.trim());

            return {
                name,
                description,
                link
            };

        });

}


// ==========================================
// GET PROFILE DATA
// ==========================================

function getData() {

    return {

        name: $("name").value.trim(),

        headline: $("headline").value.trim(),

        email: $("email").value.trim(),

        location: $("location").value.trim(),

        education: $("education").value.trim(),

        skills: $("skills").value
            .split(",")
            .map(s => s.trim())
            .filter(Boolean),

        projects: parseProjects($("projects").value),

        about: $("about").value.trim()

    };

}


// ==========================================
// LIVE PORTFOLIO PREVIEW
// ==========================================

function render() {

    const d = getData();

    $("navName").innerHTML =
        `${escapeHtml(d.name || "Your Name")}<span>.</span>`;

    $("previewName").innerHTML =
        `${escapeHtml(d.name || "Your Name")}<span>.</span>`;

    $("avatar").textContent =
        (d.name || "Y").charAt(0).toUpperCase();

    $("previewHeadline").textContent =
        d.headline || "Your professional headline";

    $("previewAbout").textContent =
        d.about ||
        "Your introduction will appear here. Create your profile and generate your introduction using AI.";

    $("previewEmail").href =
        d.email
            ? `mailto:${encodeURIComponent(d.email)}`
            : "mailto:";

    $("previewEmail").style.display =
        d.email ? "inline-block" : "none";

    $("previewLocation").textContent =
        d.location || "India";

    $("previewSkills").innerHTML =
        d.skills.length
            ? d.skills.map(skill =>
                `<span class="skill">${escapeHtml(skill)}</span>`
            ).join("")
            : '<span class="skill">Your skills</span>';

    $("previewProjects").innerHTML =
        d.projects.length
            ? d.projects.map(project => `

                <div class="project-card">

                    <b>${escapeHtml(project.name || "Project")}</b>

                    <p>${escapeHtml(project.description)}</p>

                    ${
                        project.link
                            ? `<a href="${escapeAttr(project.link)}"
                                 target="_blank"
                                 rel="noopener noreferrer">
                                 View project ↗
                               </a>`
                            : ""
                    }

                </div>

            `).join("")
            : '<p class="muted">Your projects will appear here.</p>';

}


// ==========================================
// LIVE INPUT EVENTS
// ==========================================

fields.forEach(id => {

    $(id).addEventListener("input", render);

});


// ==========================================
// SAVE PROFILE
// ==========================================

$("profileForm").addEventListener("submit", async event => {

    event.preventDefault();

    $("message").textContent =
        "Saving profile...";

    try {

        const response = await apiFetch("/api/profile", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(getData())

        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Profile save failed");
        }

        $("message").textContent =
            "✓ " + data.message;

    } catch (error) {

        $("message").textContent =
            "⚠ " + error.message;

    }

});


// ==========================================
// LOAD PROFILE
// ==========================================

async function loadProfile() {

    $("message").textContent =
        "Loading saved profile...";

    try {

        const response = await apiFetch("/api/profile");

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Profile loading failed");
        }

        if (!data.name) {

            $("message").textContent =
                "Welcome! Create your portfolio profile.";

            return;

        }

        $("name").value =
            data.name || "";

        $("headline").value =
            data.headline || "";

        $("email").value =
            data.email || "";

        $("location").value =
            data.location || "";

        $("education").value =
            data.education || "";

        $("skills").value =
            parseStoredArray(data.skills).join(", ");

        $("projects").value =
            parseStoredArray(data.projects)
                .map(project =>
                    [
                        project.name,
                        project.description,
                        project.link
                    ].join(" | ")
                )
                .join("\n");

        $("about").value =
            data.about || "";

        render();

        $("message").textContent =
            "✓ Saved profile loaded successfully.";

    } catch (error) {

        $("message").textContent =
            "⚠ " + error.message;

    }

}

function parseStoredArray(value) {

    if (Array.isArray(value)) {
        return value;
    }

    try {
        return JSON.parse(value || "[]");
    } catch {
        return [];
    }

}

$("loadBtn").addEventListener("click", loadProfile);


// ==========================================
// AI FEATURE 1
// ABOUT ME GENERATOR
// ==========================================

$("generateBtn").addEventListener("click", async () => {

    const button = $("generateBtn");
    const status = $("aiStatus");

    button.disabled = true;
    button.textContent = "Generating...";

    status.textContent =
        "✦ AI is creating your professional introduction...";

    try {

        const response = await apiFetch("/api/ai/generate-about", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(getData())

        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "AI generation failed");
        }

        $("about").value = data.text;

        render();

        status.textContent =
            "✓ Introduction generated successfully! Save your profile to store it.";

    } catch (error) {

        status.textContent =
            "⚠ " + error.message;

    } finally {

        button.disabled = false;

        button.innerHTML =
            'Generate Introduction <span>↗</span>';

    }

});


// ==========================================
// AI FEATURE 2
// CONTENT IMPROVER
// ==========================================

$("improveBtn").addEventListener("click", async () => {

    const button = $("improveBtn");
    const result = $("improveResult");

    const text = $("rawText").value.trim();

    if (!text) {

        result.hidden = false;

        result.textContent =
            "Please enter some text first.";

        return;

    }

    button.disabled = true;
    button.textContent = "Improving Text...";

    result.hidden = false;

    result.textContent =
        "✦ AI is polishing your content...";

    try {

        const response = await apiFetch("/api/ai/improve", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                text
            })

        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Content improvement failed");
        }

        result.textContent = data.text;

    } catch (error) {

        result.textContent =
            "⚠ " + error.message;

    } finally {

        button.disabled = false;

        button.innerHTML =
            'Improve My Text <span>↗</span>';

    }

});


// ==========================================
// AI FEATURE 3
// PROJECT GENERATOR
// ==========================================

$("generateProjectBtn").addEventListener("click", async () => {

    const button = $("generateProjectBtn");
    const result = $("projectResult");

    const topic = $("projectTopic").value.trim();
    const technologies = $("projectTech").value.trim();

    if (!topic) {

        result.hidden = false;

        result.textContent =
            "Please enter a project topic first.";

        return;

    }

    button.disabled = true;
    button.textContent = "Generating Project...";

    result.hidden = false;

    result.textContent =
        "✦ AI is generating a creative project idea...";

    try {

        const response = await apiFetch("/api/ai/generate-project", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                topic,
                technologies
            })

        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Project generation failed");
        }

        result.textContent =
            data.text || JSON.stringify(data, null, 2);

    } catch (error) {

        result.textContent =
            "⚠ " + error.message;

    } finally {

        button.disabled = false;

        button.innerHTML =
            'Generate Project <span>↗</span>';

    }

});


// ==========================================
// INITIALIZE APPLICATION
// ==========================================

async function initializeApp() {

    const token = getToken();

    if (!token) {
        showAuthScreen();
        return;
    }

    try {

        const response = await apiFetch("/api/auth/me");

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Session verification failed");
        }

        showDashboard(data.user);

        await loadProfile();

    } catch (error) {

        clearToken();

        showAuthScreen();

        $("authMessage").textContent =
            "Please login to continue.";

    }

}


// ==========================================
// DATABASE HEALTH CHECK
// ==========================================

async function checkServer() {

    try {

        const response = await fetch("/api/health");

        const data = await response.json();

        console.log("Server Health:", data);

    } catch (error) {

        console.error("Server health check failed:", error);

    }

}


// ==========================================
// START APPLICATION
// ==========================================

checkServer();

initializeApp();