# Deployment Guide for Render (Free Tier)

This guide will walk you through hosting "Guess Who Online" for free on [Render](https://render.com/).

## 1. Prepare your GitHub Repository

1.  Make sure all your changes are pushed to a public (or private) GitHub repository.

## 2. Create a Web Service on Render

1.  Log in to [Render](https://dashboard.render.com/).
2.  Click **New +** and select **Web Service**.
3.  Connect your GitHub repository.
4.  Configure the service with these settings:
    *   **Name**: `guess-who-online` (or any name you like)
    *   **Region**: Select the one closest to you.
    *   **Branch**: `main`
    *   **Root Directory**: (Leave blank)
    *   **Runtime**: `Node`
    *   **Build Command**: `npm install && npm run build`
    *   **Start Command**: `npm start`
    *   **Instance Type**: `Free`

## 3. Set Environment Variables

Before clicking create, click on **Advanced** and then **Add Environment Variable**:

| Key | Value | Note |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Tells the server to serve the client files. |
| `VITE_SERVER_URL` | `https://your-service-name.onrender.com` | Use your Render URL here. |

## 4. Deploy!

1.  Click **Create Web Service**.
2.  Render will now clone your repo, install both the server and client dependencies, build the React app, and start your Node.js server.
3.  Once the status is "Live", your game is accessible at the URL provided by Render!

---

### Why this works:
- **Consolidated Deployment**: The server is configured to serve the `client/dist` folder once it's built. This means you only need to host **one** service for both parts of your app.
- **Dynamic URLs**: The `VITE_SERVER_URL` variable ensures that players connect through the internet instead of looking for a server on their own computer.
