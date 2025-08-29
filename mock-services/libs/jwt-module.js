exports.verify = async (token, options) => {
  // Mock JWT verification
  if (token === 'valid-token') {
    return { userId: 'mock-user-123', role: 'admin' };
  }
  throw new Error('Invalid token');
};
