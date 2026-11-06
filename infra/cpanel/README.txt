Pegah — cPanel bundle (ADR-0040)
=================================

Full steps: docs/operations/CPANEL_DEPLOYMENT.md in the repository.

Folders
  api/      Node.js app "API"      Application URL: <domain>/api    Startup file: dist/main.js
  web/      Node.js app "Website"  Application URL: <domain>        Startup file: server.js
  admin/    Node.js app "Console"  Application URL: <domain>/admin  Startup file: server.js
  migrate/  Database migrations: npm install && npx prisma migrate deploy

Never put passwords or keys in files here. Enter them as environment
variables in cPanel → Setup Node.js App, which keeps them out of the web root.

Background jobs (cron, every minute):
  cd ~/pegah/api && <node path shown by Setup Node.js App> dist/cli/run-jobs.js >> ~/pegah/logs/jobs.log 2>&1
