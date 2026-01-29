/**
 * 遊戲音效工具庫 - 適用於所有遊戲
 * 提供統一的音效管理功能
 */

class SoundManager {
    constructor(gameName = 'default') {
        this.gameName = gameName;
        this.sounds = {};
        this.muted = false;
        this.volume = 0.7;
        this.initialized = false;
        
        // 預設音效路徑
        this.basePath = 'assets/sounds/';
        
        // 音效類型定義
        this.soundTypes = {
            UI: ['click', 'hover', 'select', 'start', 'pause', 'resume', 'back'],
            GAME: ['score', 'combo', 'perfect', 'hit', 'miss', 'gameover', 'win', 'lose'],
            EFFECT: ['explosion', 'collect', 'powerup', 'shield', 'teleport', 'jump'],
            AMBIENT: ['background', 'menu', 'level']
        };
    }
    
    /**
     * 初始化音效管理器
     */
    async init() {
        if (this.initialized) return;
        
        try {
            // 檢查瀏覽器是否支援音效
            if (!window.AudioContext && !window.webkitAudioContext) {
                console.warn('瀏覽器不支援 Web Audio API，音效功能將被禁用');
                return;
            }
            
            // 創建音頻上下文
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // 創建主音量節點
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = this.volume;
            this.gainNode.connect(this.audioContext.destination);
            
            this.initialized = true;
            console.log(`音效管理器已初始化 - 遊戲: ${this.gameName}`);
        } catch (error) {
            console.error('音效管理器初始化失敗:', error);
        }
    }
    
    /**
     * 載入音效檔案
     * @param {string} name - 音效名稱
     * @param {string} path - 音效檔案路徑
     */
    async loadSound(name, path) {
        if (!this.initialized) await this.init();
        
        try {
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.sounds[name] = audioBuffer;
            console.log(`音效載入成功: ${name}`);
            return true;
        } catch (error) {
            console.error(`音效載入失敗: ${name}`, error);
            
            // 創建替代音效（簡單的蜂鳴聲）
            this.createFallbackSound(name);
            return false;
        }
    }
    
    /**
     * 創建替代音效（當真實音效無法載入時使用）
     */
    createFallbackSound(name) {
        if (!this.initialized) return;
        
        const duration = 0.3;
        const sampleRate = this.audioContext.sampleRate;
        const frameCount = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
        const data = buffer.getChannelData(0);
        
        // 根據音效名稱創建不同的音調
        let frequency = 440; // A4
        
        if (name.includes('click') || name.includes('select')) {
            frequency = 523.25; // C5
        } else if (name.includes('score') || name.includes('collect')) {
            frequency = 659.25; // E5
        } else if (name.includes('hit') || name.includes('miss')) {
            frequency = 349.23; // F4
        } else if (name.includes('gameover') || name.includes('lose')) {
            frequency = 293.66; // D4
        } else if (name.includes('win') || name.includes('perfect')) {
            frequency = 783.99; // G5
        }
        
        // 生成正弦波
        for (let i = 0; i < frameCount; i++) {
            const time = i / sampleRate;
            const envelope = Math.exp(-5 * time); // 衰減包絡
            data[i] = Math.sin(2 * Math.PI * frequency * time) * envelope * 0.3;
        }
        
        this.sounds[name] = buffer;
    }
    
    /**
     * 播放音效
     * @param {string} name - 音效名稱
     * @param {object} options - 播放選項
     */
    play(name, options = {}) {
        if (this.muted || !this.initialized || !this.sounds[name]) {
            return null;
        }
        
        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.sounds[name];
            
            const gainNode = this.audioContext.createGain();
            
            // 應用選項
            const volume = options.volume !== undefined ? options.volume : 1.0;
            const playbackRate = options.playbackRate || 1.0;
            const loop = options.loop || false;
            
            gainNode.gain.value = volume * this.volume;
            source.playbackRate.value = playbackRate;
            source.loop = loop;
            
            // 連接節點
            source.connect(gainNode);
            gainNode.connect(this.gainNode);
            
            // 播放
            source.start(0);
            
            // 自動清理
            source.onended = () => {
                source.disconnect();
                gainNode.disconnect();
            };
            
            return source;
        } catch (error) {
            console.error(`播放音效失敗: ${name}`, error);
            return null;
        }
    }
    
    /**
     * 播放背景音樂
     * @param {string} name - 音樂名稱
     * @param {object} options - 播放選項
     */
    playMusic(name, options = {}) {
        if (this.muted || !this.initialized) return null;
        
        const source = this.play(name, {
            volume: options.volume || 0.5,
            loop: true,
            playbackRate: options.playbackRate || 1.0
        });
        
        if (source) {
            this.currentMusic = { name, source };
        }
        
        return source;
    }
    
    /**
     * 停止背景音樂
     */
    stopMusic() {
        if (this.currentMusic && this.currentMusic.source) {
            try {
                this.currentMusic.source.stop();
            } catch (error) {
                // 音效可能已經停止
            }
            this.currentMusic = null;
        }
    }
    
    /**
     * 設置音量
     * @param {number} volume - 音量值 (0.0 - 1.0)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
    }
    
    /**
     * 靜音/取消靜音
     * @param {boolean} muted - 是否靜音
     */
    setMuted(muted) {
        this.muted = muted;
        if (muted && this.currentMusic) {
            this.stopMusic();
        }
    }
    
    /**
     * 切換靜音狀態
     */
    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }
    
    /**
     * 預載遊戲常用音效
     * @param {string} gameType - 遊戲類型 ('game1', 'game2', 'game3')
     */
    async preloadGameSounds(gameType) {
        const soundConfigs = {
            game1: [
                { name: 'start', path: `${this.basePath}game1/start.mp3` },
                { name: 'score', path: `${this.basePath}game1/score.mp3` },
                { name: 'combo', path: `${this.basePath}game1/combo.mp3` },
                { name: 'powerup', path: `${this.basePath}game1/powerup.mp3` },
                { name: 'hit', path: `${this.basePath}game1/hit.mp3` },
                { name: 'gameover', path: `${this.basePath}game1/gameover.mp3` },
                { name: 'background', path: `${this.basePath}game1/background.mp3` }
            ],
            game2: [
                { name: 'start', path: `${this.basePath}game2/start.mp3` },
                { name: 'pour', path: `${this.basePath}game2/pour.mp3` },
                { name: 'complete', path: `${this.basePath}game2/complete.mp3` },
                { name: 'chain', path: `${this.basePath}game2/chain.mp3` },
                { name: 'achievement', path: `${this.basePath}game2/achievement.mp3` },
                { name: 'background', path: `${this.basePath}game2/background.mp3` }
            ],
            game3: [
                { name: 'start', path: `${this.basePath}game3/start.mp3` },
                { name: 'throw', path: `${this.basePath}game3/throw.mp3` },
                { name: 'hit', path: `${this.basePath}game3/hit.mp3` },
                { name: 'perfect', path: `${this.basePath}game3/perfect.mp3` },
                { name: 'special', path: `${this.basePath}game3/special.mp3` },
                { name: 'gameover', path: `${this.basePath}game3/gameover.mp3` },
                { name: 'background', path: `${this.basePath}game3/background.mp3` }
            ]
        };
        
        const config = soundConfigs[gameType] || soundConfigs.game1;
        const loadPromises = config.map(sound => this.loadSound(sound.name, sound.path));
        
        await Promise.allSettled(loadPromises);
        console.log(`${gameType} 音效預載完成`);
    }
    
    /**
     * 創建簡單音效（無需載入檔案）
     * @param {string} type - 音效類型 ('beep', 'click', 'error', 'success')
     */
    createSimpleSound(type) {
        if (!this.initialized) return;
        
        const buffer = this.audioContext.createBuffer(1, 22050, 22050);
        const data = buffer.getChannelData(0);
        
        let frequency = 440;
        let duration = 0.1;
        
        switch(type) {
            case 'beep':
                frequency = 523.25;
                duration = 0.2;
                break;
            case 'click':
                frequency = 659.25;
                duration = 0.05;
                break;
            case 'error':
                frequency = 349.23;
                duration = 0.3;
                break;
            case 'success':
                frequency = 783.99;
                duration = 0.4;
                break;
        }
        
        const sampleRate = 22050;
        const frameCount = sampleRate * duration;
        
        for (let i = 0; i < frameCount; i++) {
            const time = i / sampleRate;
            const envelope = Math.exp(-8 * time);
            data[i] = Math.sin(2 * Math.PI * frequency * time) * envelope * 0.3;
        }
        
        const soundName = `simple_${type}`;
        this.sounds[soundName] = buffer;
        return soundName;
    }
    
    /**
     * 播放簡單音效
     * @param {string} type - 音效類型
     */
    playSimple(type) {
        const soundName = this.createSimpleSound(type);
        if (soundName) {
            return this.play(soundName);
        }
        return null;
    }
}

// 創建全局音效管理器實例
window.gameSoundManager = new SoundManager();

// 導出供模組使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoundManager;
}