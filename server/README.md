# Guess Who Online - Server

The backend server for the "Guess Who Online" game, built with Express and Socket.io.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. (Optional) Configure environment variables in a `.env` file:
   ```
   PORT=3001
   ```

## Running the Server

### Development Mode

To run with automatic departures on file changes:
```bash
npx nodemon index.js
```

### Production Mode

```bash
node index.js
```

## API and Real-time Communication

- **Port**: 3001 (default)
- **Socket.io**: Used for game state synchronization and player events.
- **Static Files**: Serves custom character images from the `uploads/` directory.
