const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ─── TEST ROUTE ───
app.post('/api/auth/login', (req, res) => {
    res.json({ 
        message: 'Login route is WORKING!', 
        body: req.body 
    });
});

app.get('/', (req, res) => {
    res.json({ message: 'Server is running!' });
});

app.listen(PORT, () => {
    console.log(`✅ Test server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
});