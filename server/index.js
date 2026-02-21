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
