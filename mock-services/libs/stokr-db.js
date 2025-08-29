const { ObjectId } = require('mongodb');

// Mock database
const mockUsers = {
  'user123': { 
    _id: 'user123', 
    user_type: 'SA',
    email: 'admin@stokr.io' 
  }
};

module.exports = (collection) => {
  return {
    findOne: async (query) => {
      if (collection === 'users' && query._id) {
        return mockUsers[query._id.toString()] || null;
      }
      return null;
    }
  };
};
