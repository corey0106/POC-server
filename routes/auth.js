const express = require("express");
const router = express.Router();

const USERS = [
    { id: 1, username: "admin", password: "secret123" },
    { id: 2, username: "user", password: "password"}
];

router.post("/login", (req, res) => {
    const { username, password} = req.body;

    const user = USERS.find(
        u => u.username === username && u.password === password
    );

    if(!user) {
        return res.status(401).json({error: "Invalid username or password"});
    }

    res.json({message: "Login successful", user: {id: user.id, username: user.username}});
});

module.exports = router;