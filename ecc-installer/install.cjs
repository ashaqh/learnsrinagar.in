#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TEMP = path.join(ROOT, "__ecc_temp__");

console.log("\n🚀 ECC Installer starting...\n");

// ---------- CLONE ----------
console.log("📦 Cloning ECC...");
execSync(
  `git clone https://github.com/affaan-m/everything-claude-code.git "${TEMP}"`,
  { stdio: "inherit" }
);

// ---------- COPY FUNCTION ----------
function copyFolder(src, dest) {
  if (!fs.existsSync(src)) return;

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const items = fs.readdirSync(src);

  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

    if (fs.lstatSync(srcPath).isDirectory()) {
      copyFolder(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ---------- COPY CORE ----------
const folders = ["agents", "skills", "rules"];

folders.forEach(folder => {
  const src = path.join(TEMP, folder);
  const dest = path.join(ROOT, folder);

  console.log(`📂 Installing ${folder}...`);
  copyFolder(src, dest);
});

// ---------- CONFIG ----------
const config = {
  ecc: true,
  mode: "multi-agent",
  engine: "external-ai-tool",
  agents: ["planner", "architect", "developer", "reviewer"]
};

fs.writeFileSync(
  path.join(ROOT, ".ecc.json"),
  JSON.stringify(config, null, 2)
);

console.log("✅ Created .ecc.json");

// ---------- SYSTEM ----------
const systemPrompt = `
Follow ECC multi-agent workflow:

1. Planner → break task
2. Architect → design
3. Developer → implement
4. Reviewer → validate

Rules:
- Use project files
- Avoid generic answers
`;

fs.writeFileSync(path.join(ROOT, "SYSTEM.md"), systemPrompt.trim());

console.log("✅ Created SYSTEM.md");

// ---------- TOOL INSTRUCTIONS ----------
fs.writeFileSync(
  path.join(ROOT, "ECC_INSTRUCTIONS.md"),
  `
ECC ENABLED PROJECT

Use:
/plan
/build
/review

Follow SYSTEM.md strictly.
`.trim()
);

// ---------- CLEANUP ----------
fs.rmSync(TEMP, { recursive: true, force: true });

console.log("\n🎉 ECC INSTALLED SUCCESSFULLY!\n");