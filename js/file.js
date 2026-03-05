const bgm = new Audio('./assets/noswimming.mp3');
const jumpSound = new Audio('./assets/jumpshort.wav');
bgm.loop = true;
bgm.volume = 0.5;

let dino = document.querySelector("#dino");
let road = document.querySelector("#road");
let cloud = document.querySelector("#cloud");
let score = document.querySelector("#score");
let gameOver = document.querySelector("#gameOver");
let container = document.querySelector("#container");

let isGameStarted = false;
let playerScore = 0;
let scoreInterval = null;
let lastBeatSpawned = -1; 
let lastSubBeatSpawned = -1; // 追蹤 16 分音符

// --- 核心物理參數 (優化弧度) ---
const groundLevel = 10;
let posY = groundLevel;
let velocityY = 0;
let isJumping = false;
let isKeyDown = false;

const gravityNormal = -1.0; 
const gravityLight = -0.3;  
const jumpForce = 10;       

// --- 節奏與障礙物定義 ---
const bpm = 140;
const beatDuration = 60 / bpm; 
const subBeatDuration = beatDuration / 4; // 16 分音符的時間
const audioOffset = 0.18; 
let activeBlocks = [];

// 定義不同類型的障礙物
const BLOCK_TYPES = {
    CAMEL: { 
        name: 'camel',
        width: "80px", height: "80px", 
        img1: "./assets/camel1.png", img2: "./assets/camel2.png",
        travelBeats: 6 // 慢：6 拍抵達
    },
    SHEEP: { 
        name: 'sheep',
        width: "80px", height: "80px", 
        img1: "./assets/sheep1.png", img2: "./assets/sheep2.png",
        travelBeats: 4 // 快：4 拍抵達
    }
};

function spawnBlock(type) {
    let currentTime = bgm.currentTime;
    let exactCurrentBeat = (currentTime - audioOffset) / beatDuration;
    
    // 計算目標擊中時間 (基於類型定義的速度)
    let targetTime = (Math.ceil(exactCurrentBeat) + type.travelBeats) * beatDuration + audioOffset;

    const blockEl = document.createElement("div");
    blockEl.className = "spawned-block";
    blockEl.style.width = type.width;
    blockEl.style.height = type.height;
    blockEl.style.position = "absolute";
    blockEl.style.bottom = "20px";
    blockEl.style.zIndex = "5";
    blockEl.innerHTML = `<img src="${type.img1}" style="width:100%; height:100%; object-fit:contain;">`;
    container.appendChild(blockEl);

    activeBlocks.push({
        element: blockEl,
        imgTag: blockEl.querySelector("img"),
        type: type,
        targetTime: targetTime,
        totalDuration: type.travelBeats * beatDuration
    });
}

function gameLoop() {
    if (!isGameStarted) return;

    let currentTime = bgm.currentTime;
    let adjustedTime = currentTime - audioOffset;
    
    // 計算目前的節拍與 16 分音符位置
    let currentBeat = Math.floor((adjustedTime + 0.05) / beatDuration);
    let currentSubBeat = Math.floor((adjustedTime + 0.05) / subBeatDuration);

    // 1. 生成邏輯
    // 每 4 拍生成一隻駱駝 (1, 5, 9...)
    if (currentBeat % 4 === 0 && currentBeat !== lastBeatSpawned) {
        spawnBlock(BLOCK_TYPES.CAMEL);
        lastBeatSpawned = currentBeat;
    }
    
    // 在第 2.5 拍 (即第 10 個 16 分音符位置) 生成一隻 16 分音符綿羊
    if (currentSubBeat % 16 === 10 && currentSubBeat !== lastSubBeatSpawned) {
        spawnBlock(BLOCK_TYPES.SHEEP);
        lastSubBeatSpawned = currentSubBeat;
    }

    // 2. 物理跳躍 (平滑弧度邏輯)
    let currentGravity = (velocityY > 0) ? (isKeyDown ? gravityLight : gravityNormal) : gravityNormal;
    velocityY += currentGravity;
    posY += velocityY;

    if (posY <= groundLevel) {
        posY = groundLevel;
        velocityY = 0;
        if (isJumping) {
            isJumping = false;
            dino.classList.remove("dinoActive");
            dino.classList.add("dinoRunning");
        }
    }
    dino.style.bottom = posY + "px";

    // 3. 障礙物移動與動畫切換
    for (let i = activeBlocks.length - 1; i >= 0; i--) {
        let b = activeBlocks[i];
        let progress = 1 - (b.targetTime - currentTime) / b.totalDuration;

        // 位移計算
        b.x = 1200 - (progress * (1200 - 20));
        b.element.style.left = b.x + "px";

        // 動畫切換：每 0.15 秒換一次圖
        let animFrame = Math.floor(currentTime * 6) % 2; 
        b.imgTag.src = animFrame === 0 ? b.type.img1 : b.type.img2;

        // 碰撞偵測 (根據動物大小動態調整判定盒)
        let hitWidth = parseInt(b.type.width) * 0.5; // 判定範圍取寬度的 60%
        if (posY <= (parseInt(b.type.height) - 10) && b.x >= 30 && b.x <= (30 + hitWidth)) {
            handleGameOver();
            return;
        }

        if (progress > 1.2) {
            b.element.remove();
            activeBlocks.splice(i, 1);
        }
    }

    requestAnimationFrame(gameLoop);
}

function handleGameOver() {
    isGameStarted = false;
    bgm.pause();
    gameOver.style.display = "block";
    dino.classList.remove("dinoRunning");
    dino.classList.remove("dinoActive");
    posY = groundLevel;
    dino.style.bottom = posY + "px";
    velocityY = 0;
    isJumping = false;
    isKeyDown = false;
    if (road.firstElementChild) road.firstElementChild.style.animation = "none";
    if (cloud.firstElementChild) cloud.firstElementChild.style.animation = "none";
    clearInterval(scoreInterval);
    activeBlocks.forEach(b => { if (b.element) b.element.remove(); });
    activeBlocks = [];
    lastBeatSpawned = -1; 
    lastSubBeatSpawned = -1;
}

window.addEventListener("keydown", (e) => {
    if (e.code == "Space" || e.key == "ArrowUp") {
        isKeyDown = true;
        if (!isGameStarted && e.code == "Space") {
            isGameStarted = true;
            posY = groundLevel;
            velocityY = 0;
            isJumping = false;
            lastBeatSpawned = -1;
            lastSubBeatSpawned = -1;
            bgm.currentTime = 0;
            bgm.play().catch(err => console.log("互動後播放"));
            playerScore = 0;
            score.innerHTML = `Score <b>0</b>`;
            clearInterval(scoreInterval);
            scoreInterval = setInterval(() => {
                playerScore++;
                score.innerHTML = `Score <b>${playerScore}</b>`;
            }, 200);
            gameOver.style.display = "none";
            road.firstElementChild.style.animation = "roadAnimate 1.5s linear infinite";
            cloud.firstElementChild.style.animation = "cloudAnimate 50s linear infinite";
            dino.classList.add("dinoRunning");
            requestAnimationFrame(gameLoop);
        }
        if (isGameStarted && !isJumping) {
            isJumping = true;
            velocityY = jumpForce;
            jumpSound.currentTime = 0;
            jumpSound.play();
            dino.classList.remove("dinoRunning");
            dino.classList.add("dinoActive");
        }
    }
});

window.addEventListener("keyup", (e) => {
    if (e.code == "Space" || e.key == "ArrowUp") isKeyDown = false;
});