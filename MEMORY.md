# Project Memory: LearnSrinagar.in

This file contains critical infrastructure, deployment, and database information for future reference.

## 🚀 Infrastructure & Deployment

| Resource | Value |
| :--- | :--- |
| **VPS IP Address** | `187.127.130.18` |
| **SSH Username** | `root` |
| **SSH Password** | `Acxak@7006774383` |
| **Project Root (VPS)** | `/var/www/learnsrinagar.in` |
| **Nginx Config** | `/etc/nginx/sites-available/learnsrinagar` |
| **PM2 Process Name** | `learnsrinagar` |
| **Port** | `3000` |
| **Domain** | `learnsrinagar.in` |

## 🗄️ Database (MySQL)

These credentials are used in the production environment.

| Field | Value |
| :--- | :--- |
| **Database Host** | `127.0.0.1` (Local to VPS) |
| **Database Name** | `learnsrinagar` |
| **Database User** | `learnsrinagar` |
| **Database Password** | `e3iWzvZnZifgN38OiM2Q` |

> [!NOTE]
> Database migrations can be run using the `scratch_db_migrate_vps.js` script from the local repository.

## 🔑 Application Secrets

| Key | Value |
| :--- | :--- |
| **Session Secret** | `41ace3eceb72546edbe8accade89a026cbb276dc3562ce4409dadfeafe1f9cef` |
| **Firebase Config** | Stored in `service-account.json` |

## 👤 Default User Accounts (for Reference)

| Email | Role |
| :--- | :--- |
| `super_admin@gmail.com` | Super Admin |
| `bmsnoorbagh@learnsrinagar.in` | School Admin |
| `ajazguchay@learnsrinagar.in` | Teacher |
| `student@gmail.com` | Student |

> [!WARNING]
> Default passwords for these accounts are hashed in the database. 

## 🛠️ Common Commands (on VPS)

- **View Logs**: `pm2 logs learnsrinagar`
- **Restart App**: `pm2 restart learnsrinagar`
- **Check Nginx Status**: `sudo systemctl status nginx`
- **Update Application**: Run `node vps-deploy.js` from your local machine.
