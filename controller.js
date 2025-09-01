// Exported controller functions
const getUsers = (req, res) => {
    res.json({ users: [] });
};

const createUser = (req, res) => {
    res.json({ created: true });
};

const updateUser = (req, res) => {
    res.json({ updated: true });
};

module.exports = {
    getUsers,
    createUser,
    updateUser
};
