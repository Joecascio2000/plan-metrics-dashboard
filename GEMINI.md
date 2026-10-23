# Tool Discipline
- NEVER use terminal commands (Select-String, Get-Content, grep, cat, sed) to read, search, or edit files inside this workspace.
- ALWAYS use your native internal workspace tools (file read, edit, search, glob) for all in-folder inspection and modifications.
- Reserve terminal execution strictly for project runtime tasks (e.g., executing scripts, running dev servers).

# GitHub Publishing Rules & Workflow
- **Target Repository**: `Joecascio2000/plan-metrics-dashboard` (Branch: `main`).
- **NEVER use `git.exe`** and **NEVER scan the local disk / `C:\`** to locate Git or repositories. Git CLI is not used in this workspace.
- **Fast Publishing Method**:
  1. Retrieve the GitHub Personal Access Token from `~/.gemini/config/mcp_config.json` (`mcpServers.github.env.GITHUB_PERSONAL_ACCESS_TOKEN`).
  2. For any changed files, get the current file SHA via GitHub REST API:
     `GET https://api.github.com/repos/Joecascio2000/plan-metrics-dashboard/contents/<file_path>`
  3. Update/commit the base64-encoded file content directly via:
     `PUT https://api.github.com/repos/Joecascio2000/plan-metrics-dashboard/contents/<file_path>`
     Payload: `{ "message": "<commit_message>", "content": "<base64_content>", "sha": "<current_sha>", "branch": "main" }`
  4. Execute the calls via standard Python (`python`) to push updates instantly without searching the system or relying on local Git installations.
