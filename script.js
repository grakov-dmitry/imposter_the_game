const tg = window.Telegram.WebApp;

const CATEGORY_ICONS = {
    "Герои и злодеи": "🦸‍♂️",
    "Актеры": "🎬",
    "Виды спорта": "⚽️",
    "Предметы быта": "🏠",
    "Персонажи мультфильмов": "🧸",
    "Герои фильмов и сериалов": "📺",
    "Музыка": "🎸",
    "Хобби": "🎨",
    "Еда": "🍕",
    "Животные": "🦁",
    "Персонажи игр": "🎮",
    "Dota 2": "⚔️",
    "LoL": "🔷",
    "Блич": "⚔️",
    "Ван пис": "🏴‍☠️",
    "Наруто": "🍃"
};

const REGISTRY_FALLBACK = [
    { name: "Герои и злодеи", file: "heroes_and_villains" },
    { name: "Актеры", file: "actors" },
    { name: "Виды спорта", file: "sports" },
    { name: "Предметы быта", file: "household_items" },
    { name: "Персонажи мультфильмов", file: "cartoons" },
    { name: "Герои фильмов и сериалов", file: "movie_characters" },
    { name: "Музыка", file: "music" },
    { name: "Хобби", file: "hobbies" },
    { name: "Еда", file: "food" },
    { name: "Животные", file: "animals" },
    { name: "Персонажи игр", file: "game_characters" },
    { name: "Dota 2", file: "dota2" },
    { name: "LoL", file: "lol" },
    { name: "Блич", file: "bleach" },
    { name: "Ван пис", file: "one_piece" },
    { name: "Наруто", file: "naruto" }
];

class ImposterGame {
    constructor() {
        this.categories = [];
        this.selectedCategories = new Map();
        this.players = [];
        this.playerCount = 3;
        this.currentPlayerIndex = 0;
        this.secretWord = '';
        this.imposterIndex = -1;
        this.allWordsPool = [];

        this.init();
    }

    async init() {
        tg.expand();
        tg.ready();
        
        const holdBtn = document.getElementById('hold-button');
        const nextBtn = document.getElementById('next-player-btn');
        const roleHint = document.getElementById('role-hint');

        const showRole = () => {
            if (holdBtn.classList.contains('active')) return;
            tg.HapticFeedback.impactOccurred('medium');
            holdBtn.classList.add('active');
            const isImposter = this.currentPlayerIndex === this.imposterIndex;
            holdBtn.innerHTML = isImposter 
                ? '<span class="imposter-text">ТЫ<br>ИМПОСТЕР!</span>' 
                : `<span style="font-size: 14px; opacity: 0.8; font-weight: 400;">ТВОЕ СЛОВО:</span><br>${this.secretWord}`;
            nextBtn.style.display = 'flex';
            roleHint.style.visibility = 'hidden';
        };

        const hideRole = () => {
            holdBtn.classList.remove('active');
            holdBtn.innerHTML = '<div style="font-size: 40px; margin-bottom: 10px;">👁</div>УДЕРЖИВАЙ';
        };

        holdBtn.addEventListener('mousedown', showRole);
        holdBtn.addEventListener('touchstart', (e) => { e.preventDefault(); showRole(); });
        holdBtn.addEventListener('mouseup', hideRole);
        holdBtn.addEventListener('touchend', hideRole);
        holdBtn.addEventListener('mouseleave', hideRole);

        await this.loadRegistry();
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'flex' : 'none';
    }

    async loadRegistry() {
        this.showLoading(true);
        try {
            await this.loadScript('libs/registry.js');
            this.categories = window.GAME_REGISTRY;
        } catch (error) {
            this.categories = REGISTRY_FALLBACK;
        } finally {
            this.renderCategories();
            this.showLoading(false);
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    renderCategories() {
        const container = document.getElementById('categories');
        container.innerHTML = '';
        this.categories.forEach(cat => {
            const div = document.createElement('div');
            div.className = 'category-item';
            const icon = CATEGORY_ICONS[cat.name] || "📦";
            div.innerHTML = `<span>${icon}</span> ${cat.name}`;
            div.onclick = () => {
                tg.HapticFeedback.selectionChanged();
                if (this.selectedCategories.has(cat.name)) {
                    this.selectedCategories.delete(cat.name);
                    div.classList.remove('selected');
                } else {
                    this.selectedCategories.set(cat.name, cat.file);
                    div.classList.add('selected');
                }
            };
            container.appendChild(div);
        });
    }

    goToMenu() {
        tg.HapticFeedback.impactOccurred('light');
        this.showScreen('screen-menu');
    }

    goToSettings() {
        tg.HapticFeedback.impactOccurred('light');
        this.updatePlayerInputs();
        this.showScreen('screen-settings');
    }

    changePlayerCount(delta) {
        const newCount = this.playerCount + delta;
        if (newCount >= 3 && newCount <= 10) {
            tg.HapticFeedback.impactOccurred('light');
            this.playerCount = newCount;
            document.getElementById('player-count-display').innerText = this.playerCount;
            this.updatePlayerInputs();
        } else {
            tg.HapticFeedback.notificationOccurred('error');
        }
    }

    updatePlayerInputs() {
        const container = document.getElementById('player-inputs');
        const currentInputs = container.querySelectorAll('input');
        const names = Array.from(currentInputs).map(i => i.value);

        container.innerHTML = '';
        for (let i = 0; i < this.playerCount; i++) {
            const div = document.createElement('div');
            div.className = 'player-row';
            div.innerHTML = `
                <span>${i + 1}</span>
                <input type="text" placeholder="Имя игрока" value="${names[i] || 'Игрок ' + (i + 1)}">
            `;
            container.appendChild(div);
        }
    }

    async startGame() {
        if (this.selectedCategories.size === 0) {
            tg.HapticFeedback.notificationOccurred('warning');
            alert('Выберите хотя бы одну категорию!');
            return;
        }

        const inputs = document.querySelectorAll('#player-inputs input');
        this.players = Array.from(inputs).map(i => i.value.trim() || 'Без имени');
        
        if (this.players.length < 3) {
            alert('Минимум 3 игрока!');
            return;
        }

        this.showLoading(true);
        this.allWordsPool = [];

        for (const [name, filename] of this.selectedCategories) {
            try {
                if (!window.GAME_DATA[name]) {
                    await this.loadScript(`libs/${filename}.js`);
                }
                const catWords = window.GAME_DATA[name];
                if (catWords) this.allWordsPool = this.allWordsPool.concat(catWords);
            } catch (error) {
                console.error(`Error loading category ${name}:`, error);
            }
        }

        if (this.allWordsPool.length === 0) {
            alert('Слова не найдены! Проверьте папку libs.');
            this.showLoading(false);
            return;
        }

        tg.HapticFeedback.notificationOccurred('success');
        this.generateSession();
        this.showLoading(false);
    }

    restartGame() {
        tg.HapticFeedback.impactOccurred('medium');
        if (this.allWordsPool.length === 0 || this.players.length === 0) {
            this.goToSettings();
            return;
        }
        this.generateSession();
    }

    generateSession() {
        this.secretWord = this.allWordsPool[Math.floor(Math.random() * this.allWordsPool.length)];
        this.imposterIndex = Math.floor(Math.random() * this.players.length);
        this.currentPlayerIndex = 0;
        this.goToPassScreen();
    }

    goToPassScreen() {
        document.getElementById('current-player-name').innerText = this.players[this.currentPlayerIndex];
        this.showScreen('screen-pass');
    }

    goToRoleView() {
        tg.HapticFeedback.impactOccurred('light');
        document.getElementById('next-player-btn').style.display = 'none';
        document.getElementById('role-hint').style.visibility = 'visible';
        this.showScreen('screen-role');
    }

    nextTurn() {
        tg.HapticFeedback.impactOccurred('light');
        this.currentPlayerIndex++;
        if (this.currentPlayerIndex < this.players.length) {
            this.goToPassScreen();
        } else {
            this.startDiscussion();
        }
    }

    startDiscussion() {
        tg.HapticFeedback.notificationOccurred('success');
        this.showScreen('screen-discussion');
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
        document.getElementById('app').scrollTop = 0;
    }
}

const game = new ImposterGame();