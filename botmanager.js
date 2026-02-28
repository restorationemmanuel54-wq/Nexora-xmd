import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";

const activeBots = new Map();

export async function startBot(userId, phoneNumber, io){
     if (activeBots.has(userId)) return; // prevent duplicate bots

     const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${userId}`);
     const sock = makeWASocket({
         auth: state,
         printQRInTerminal: false,
     });

     sock.ev.on("creds.update", saveCreds);

     // If users wants pairing code login
     if (phoneNumber) {
        const code = await sock.requestPhoneNumber(phoneNumber);
        io.to(userId).emit("pairing-code", code);
     }

     sock.ev.on("connection.update", (update) => {
        if (update.qr) io.to(userId).emit("qr-code", update.qr);
        if (update.connection === "open") {
            activeBots.set(userId, sock);
            io.to(userId).emit("bot-status", "connected");
        }
        if (update.connection === "close") {
            activeBots.delete(userId);
            io.to(userId).emit("bot-status", "disconnected");
        }
        });

        activeBots.set(userId, sock);

        return sock;
}

export function stopBot(userId) {
    const bot = activeBots.get(userId);
    if (bot) {
        bot.disconnect();
        activeBots.delete(userId);
    }
}

export function getActiveBots() {
    return Array.from(activeBots.keys());
}