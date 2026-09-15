# Workspace Rules & Instructions

## Testing Rule
- **NO AUTOMATED TESTING**: Do NOT run automated tests, browser tests, or browser subagents (`browser_subagent`).
- The user will perform all testing manually from here on.
- When changes are implemented, validate with syntax checks (`node -c`), explain the changes clearly, and let the user test manually.

## Git & Deployment Rule
- Automatically commit and push all completed changes to GitHub `origin main` and `origin master` for Netlify auto-deployment.
- Maintain visible application version codes on every release (`config.js`, `service-worker.js`, `README.md`).
