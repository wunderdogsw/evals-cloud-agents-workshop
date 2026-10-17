# Cursor cloud agent environment

Cursor cloud agents read `.cursor/environment.json` from the repo's **default branch**
(https://cursor.com/docs/cloud-agent/setup). Pick one:

- `environment.node.json` — plain Node project: just an install command on Cursor's default image.
- `environment.dockerfile.json` + `Dockerfile.example` — anything else (.NET, Java, Python…): build your own image.

Copy the chosen JSON to `<target>/.cursor/environment.json` (and the Dockerfile to `<target>/.cursor/Dockerfile`).
On a real repo, don't merge it to the default branch: commit it on the workshop branch and start the cloud agent on that branch
(an agent started on a branch checks that branch out), or save a personal environment in Cursor. On the sample, a mirror or a
catch-up target you can commit it on the default branch. Secrets go in cursor.com/dashboard → Cloud Agents → Secrets, never in the repo.
The agent eval gate needs no secret in the VM.
