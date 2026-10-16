# Cursor cloud agent environment

Cursor cloud agents read `.cursor/environment.json` from the repo's **default branch**
(https://cursor.com/docs/cloud-agent/setup). Pick one:

- `environment.node.json` — plain Node project: just an install command on Cursor's default image.
- `environment.dockerfile.json` + `Dockerfile.example` — anything else (.NET, Java, Python…): build your own image.

Copy the chosen JSON to `<target>/.cursor/environment.json` (and the Dockerfile to `<target>/.cursor/Dockerfile`),
merge to the default branch, then start a cloud agent. Secrets (e.g. `ANTHROPIC_API_KEY` for evals) go in
cursor.com/dashboard → Cloud Agents → Secrets, never in the repo.
