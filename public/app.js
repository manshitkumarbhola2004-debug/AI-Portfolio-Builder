// ==========================================
// PORTFOLIA AI - FRONTEND JAVASCRIPT
// ==========================================

const $ = id => document.getElementById(id);

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

  // Name
  $("navName").innerHTML =
    `${escapeHtml(d.name || "Your Name")}<span>.</span>`;

  $("previewName").innerHTML =
    `${escapeHtml(d.name || "Your Name")}<span>.</span>`;

  // Avatar
  $("avatar").textContent =
    (d.name || "Y").charAt(0).toUpperCase();

  // Headline
  $("previewHeadline").textContent =
    d.headline || "Your professional headline";

  // About
  $("previewAbout").textContent =
    d.about ||
    "Your introduction will appear here. Create your profile and generate your introduction using AI.";

  // Email
  $("previewEmail").href =
    d.email
      ? `mailto:${encodeURIComponent(d.email)}`
      : "mailto:";

  $("previewEmail").style.display =
    d.email ? "inline-block" : "none";

  // Location
  $("previewLocation").textContent =
    d.location || "India";

  // Skills
  $("previewSkills").innerHTML =
    d.skills.length
      ? d.skills.map(skill =>
          `<span class="skill">${escapeHtml(skill)}</span>`
        ).join("")
      : '<span class="skill">Your skills</span>';

  // Projects
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

  $("message").textContent = "Saving profile...";

  try {
    const response = await fetch("/api/profile", {
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
      "✓ " + (data.message || "Profile saved successfully!");

  } catch (error) {
    $("message").textContent =
      "⚠ " + error.message;
  }
});


// ==========================================
// LOAD PROFILE
// ==========================================

$("loadBtn").addEventListener("click", async () => {

  $("message").textContent =
    "Loading saved profile...";

  try {
    const response = await fetch("/api/profile");

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Profile loading failed");
    }

    if (!data.name) {
      $("message").textContent =
        "No saved profile found yet.";

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
      (data.skills || []).join(", ");

    $("projects").value =
      (data.projects || [])
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
});


// ==========================================
// AI FEATURE 1
// ABOUT ME GENERATOR
// ==========================================

$("generateBtn").addEventListener("click", async () => {

  const button = $("generateBtn");

  const status = $("aiStatus");

  button.disabled = true;

  button.innerHTML = "Generating...";

  status.textContent =
    "✦ AI is creating your professional introduction...";

  try {
    const response = await fetch("/api/ai/generate-about", {
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

  button.innerHTML =
    "Improving Text...";

  result.hidden = false;

  result.textContent =
    "✦ AI is polishing your content...";

  try {
    const response = await fetch("/api/ai/improve", {
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

    result.textContent =
      data.text;

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

  button.innerHTML =
    "Generating Project...";

  result.hidden = false;

  result.textContent =
    "✦ AI is generating a creative project idea...";

  try {
    const response = await fetch("/api/ai/generate-project", {
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
// INITIALIZE LIVE PREVIEW
// ==========================================

render();


// ==========================================
// DATABASE HEALTH CHECK
// ==========================================

fetch("/api/health")

  .then(response => response.json())

  .then(data => {

    if (data.database === "connected") {

      $("message").textContent =
        "✓ SQLite database connected successfully.";

    } else {

      $("message").textContent =
        "⚠ Database connection unavailable. Check your server.";

    }

  })

  .catch(() => {

    $("message").textContent =
      "⚠ Server is not running. Start server.js and refresh the page.";

  });