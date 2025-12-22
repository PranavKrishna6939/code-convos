# Deployment Guide for EC2 (Simple / No Nginx)

This guide assumes you have a fresh Ubuntu EC2 instance. We will serve the frontend directly from the Node.js backend.

## 1. System Prerequisites

SSH into your EC2 instance and update the system.

```bash
sudo apt update && sudo apt upgrade -y
```

## 2. Install Dependencies

### Node.js (v18+)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### Python (3.10+) & venv
Required for the Prompt Optimizer feature. **Note: Python 3.10 or higher is required.**
```bash
# For Ubuntu
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev

# For Amazon Linux 2023
sudo yum install -y python3.11 python3.11-pip python3.11-devel
```

### Git
```bash
sudo apt install -y git
```

## 3. Project Setup

Clone your repository.
```bash
cd /home/ubuntu
git clone <your-repo-url> code-convos
cd code-convos
```

### Frontend Setup
Install dependencies and build the React app.
```bash
npm install
npm run build
```
*This creates a `dist` folder containing the static assets.*

### Backend Setup
Install Node.js dependencies.
```bash
cd server
npm install
```

### Python Environment Setup
Create a virtual environment and install required packages.
```bash
# Inside server/ directory
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate
```

### Environment Variables
Create a `.env` file in the `server/` directory.
```bash
nano .env
```
Add your API keys:
```env
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
PORT=4001
```

## 4. Process Management (PM2)

Install PM2 globally to manage the Node.js process.
```bash
sudo npm install -g pm2
```

Start the application using the ecosystem file.
```bash
cd /home/ubuntu/code-convos
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```
*Follow the command output from `pm2 startup` to enable auto-start on boot.*

## 5. Security Groups (AWS)

Ensure your EC2 Security Group allows inbound traffic on port **4001**.
- **Type**: Custom TCP
- **Port Range**: 4001
- **Source**: 0.0.0.0/0 (Anywhere)

## 6. Access the App

Open your browser and go to:
`http://<your-ec2-public-ip>:4001`

## Troubleshooting

- **Check Backend Logs**: `pm2 logs code-convos-server`
- **Python Errors**: Ensure the `.venv` exists in `server/` and `requirements.txt` packages are installed.
