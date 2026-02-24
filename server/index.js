const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { handleSocketEvents } = require('./handlers/socketHandler');

const app = express();
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Serve static images for custom characters
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve character data
app.get('/presets', (req, res) => {
    const presets = require('./presets.json');
    res.json(presets);
});

// Serve default characters and other static files
app.use(express.static(__dirname));

// Serve built client in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/dist')));

    // Handle SPA routing
    app.get('*splat', (req, res) => {
        // Exclude /presets and /uploads as they are handled above
        if (!req.url.startsWith('/presets') && !req.url.startsWith('/uploads')) {
            res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
        }
    });
}

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // In production, specify the client origin
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    handleSocketEvents(io, socket);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
