const express = require("express"); 
const http = require("http"); 
const { Server } = require("socket.io"); 
const fs = require("fs"); 
const path = require("path"); 
const QRCode = require("qrcode"); 
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys"); 
 
const app = express(); 
const server = http.createServer(app); 
const io = new Server(server); 
 
app.use(express.json()); 
 
const PORT = process.env.PORT || 3000; 
const keysPath = path.join(__dirname, "keys.json"); 
const activeBots = new Map(); 
 
if (!fs.existsSync("./sessions")) { 
    fs.mkdirSync("./sessions"); 
} 
 
function validateKey(inputKey) { 
    const keys = JSON.parse(fs.readFileSync(keysPath)); 
    const keyObj = keys.find(k => k.key === inputKey); 
 
    if (!keyObj) return { valid: false, message: "Invalid key" }; 
    if (keyObj.used) return { valid: false, message: "Key already used" }; 
 
    if (new Date() > new Date(keyObj.expires)) 
        return { valid: false, message: "Key expired" }; 
 
    return { valid: true }; 
} 
 
async function startBot(userId) { 
    const { state, saveCreds } = await useMultiFileAuthState(`sessions/${userId}`); 
 
    const sock = makeWASocket({ 
        auth: state, 
        printQRInTerminal: false 
    }); 
 
    activeBots.set(userId, sock); 
 
    sock.ev.on("creds.update", saveCreds); 
 
    sock.ev.on("connection.update", async (update) => { 
        const { qr, connection } = update; 
 
        if (qr) { 
            const qrImage = await QRCode.toDataURL(qr); 
            io.to(userId).emit("qr", qrImage); 
        } 
 
        if (connection === "open") { 
            io.to(userId).emit("status", "connected"); 
        } 
 
        if (connection === "close") { 
            activeBots.delete(userId); 
        } 
    }); 
} 
 
app.post("/deploy", async (req, res) => { 
    const { userId, key } = req.body; 
 
    if (!validateKey(key).valid) 
        return res.json({ message: "Invalid or expired key" }); 
 
    if (activeBots.has(userId)) 
        return res.json({ message: "Bot already running" }); 
 
    await startBot(userId); 
 
    const keys = JSON.parse(fs.readFileSync(keysPath)); 
    const index = keys.findIndex(k => k.key === key); 
    keys[index].used = true; 
    fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2)); 
 
    res.json({ message: "Bot deploying..." }); 
}); 
 
app.post("/restart", async (req, res) => { 
    const { userId } = req.body; 
 
    const sock = activeBots.get(userId); 
    if (!sock) return res.json({ message: "Bot not running" }); 
 
    await sock.logout(); 
    activeBots.delete(userId); 
 
    await startBot(userId); 
 
    res.json({ message: "Bot restarted" }); 
}); 
 
app.post("/shutdown", async (req, res) => { 
    const { userId } = req.body; 
 
    const sock = activeBots.get(userId); 
    if (!sock) return res.json({ message: "Bot not running" }); 
 
    await sock.logout(); 
    activeBots.delete(userId); 
 
    res.json({ message: "Bot stopped" }); 
}); 
 
io.on("connection", (socket) => { 
    socket.on("join", (userId) => { 
        socket.join(userId); 
    }); 
}); 
 
server.listen(PORT, () => { 
    console.log("Nexora SaaS running on port " + PORT); 
});