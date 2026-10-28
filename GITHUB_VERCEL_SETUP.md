# MREM Digital Library — GitHub and Vercel link

Vercel project has been created in the `thinkbulbs-projects` team as `mrem-digital-library`.
Project: https://vercel.com/thinkbulbs-projects/mrem-digital-library

## Create the new GitHub repository

1. Sign into GitHub as `thinkbulb9-cmd` and go to https://github.com/new.
2. Repository name: `mrem-digital-library`; visibility: **Private**.
3. Create the repository. If you will push via Git terminal, leave Initialize with README unchecked.
4. Extract this archive, open a terminal in this directory, and run:

```bash
git init
git branch -M main
git add .
git commit -m "Initial MREM Digital Library pilot"
git remote add origin https://github.com/thinkbulb9-cmd/mrem-digital-library.git
git push -u origin main
```

Log into GitHub using your normal credential manager (or GitHub CLI). Do not paste personal access tokens into chat or source files.

## Connect on Vercel

In https://vercel.com/thinkbulbs-projects/mrem-digital-library/settings/git choose Connect Git Repository, select `thinkbulb9-cmd/mrem-digital-library`, and verify branch `main`. Do not activate a public production deployment until environment variables and access controls are configured.

The code is a LOCAL PILOT, not production ready. It requires a PostgreSQL `DATABASE_URL`, `LOGIN_PASSWORD`, and `SESSION_SECRET` as described in README.md. A Vercel deployment cannot access the college's 90 TB local disks. The scanner and file-serving service must be installed and secured on an on-premises server, with an approved connection architecture if a cloud-hosted UI is needed.

**Security warning**: Do not enter local disk paths as public URLs or expose the local scanner or database to the open internet. Protect the production app with institutional login and permissions, not the pilot's shared password.