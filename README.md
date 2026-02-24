# Guess Who Online

A real-time, web-based version of the classic "Guess Who?" game.

## Project Structure

- `client/`: React + Vite frontend application.
- `server/`: Express + Socket.io backend server.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Installation

1. Clone the repository
2. Install dependencies for the server:
   ```bash
   cd server
   npm install
   ```
3. Install dependencies for the client:
   ```bash
   cd ../client
   npm install
   ```

## Running the Application

To run the full application, you need to start both the server and the client.

### 1. Start the Server

From the root directory:
```bash
cd server
node index.js
```
The server will start on [http://localhost:3001](http://localhost:3001).

### 2. Start the Client

From the root directory:
```bash
cd client
npm run dev
```
The client will start on [http://localhost:5173](http://localhost:5173).

## Features

- Real-time multiplayer interaction via Socket.io.
- Character selection and board management.
- Custom character support (via uploads).
