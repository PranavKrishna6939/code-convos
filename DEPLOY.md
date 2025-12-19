# Deployment Guide for EC2 (Simple / No Nginx)

This guide assumes you have a fresh Ubuntu EC2 instance. We will serve the frontend directly from the Node.js backend.

## 1. System Setup

Update the system and install Node.js (v18+).

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

## 2. Project Setup

Clone your repository or copy your project files to the server.

```bash
# Example
git clone <your-repo-url> /home/ubuntu/code-convos
cd /home/ubuntu/code-convos
```

## 3. Install & Build

1.  **Install Dependencies**:
    ```bash
    npm install
    cd server
    npm install
    cd ..
    ```

2.  **Build Frontend**:
    ```bash
    npm run build
    ```
    *This creates a `dist` folder which the backend will serve.*

## 4. Start the Server

Start the backend using PM2. It is configured to serve the API on `/api` and the frontend on `/`.

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 5. Security Group (Firewall)

Ensure your EC2 Security Group allows inbound traffic on port **4001**.
- Type: Custom TCP
- Port Range: 4001
- Source: 0.0.0.0/0 (Anywhere)

## 6. Access the App

Open your browser and go to:
`http://<your-ec2-public-ip>:4001`
