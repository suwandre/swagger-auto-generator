const express = require('express');
const router = express.Router();

// Exported function example
const validateUser = (req, res, next) => {
    // Validation logic
    next();
};

const authenticateUser = (req, res, next) => {
    // Auth logic
    next();
};

router.get('/profile', authenticateUser, (req, res) => {
    res.json({ profile: 'user data' });
});

router.post('/validate', validateUser, (req, res) => {
    res.json({ valid: true });
});

module.exports = { router, validateUser, authenticateUser };
