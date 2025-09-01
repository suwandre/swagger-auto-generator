const express = require('express');
const app = express();
const cors = require('cors');

// Enable CORS for all routes - for development
app.use(cors({
    origin: '*', // In production, specify your actual domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

app.use(express.json());

// Sample routes for testing
app.get('/api/users', (req, res) => {
    res.json({ message: 'Get all users' });
});

app.post('/api/users', (req, res) => {
    res.json({ message: 'Create user', data: req.body });
});

app.get('/api/users/:id', (req, res) => {
    res.json({ message: `Get user ${req.params.id}` });
});

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
