// Game Configuration
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: [BootScene, MainScene, HUDScene],
    pixelArt: true,
    backgroundColor: '#000000'
};

const game = new Phaser.Game(config);

// Boot Scene: Loads assets and starts the main scene
class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Load desert background tile and building sprites
        this.load.image('desert_tile', 'assets/desert_tile.png');
        this.load.image('office', 'assets/office.png');
        this.load.image('server_rack', 'assets/server_rack.png');
        this.load.image('solar_panel', 'assets/solar_panel.png');
        this.load.image('cooling_system', 'assets/cooling_system.png');
    }

    create() {
        this.scene.start('MainScene');
    }
}

// Main Scene: Handles gameplay, building placement, and resource updates
class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
    }

    create() {
        // Create desert background tilemap (50x38 grid, 16x16 tiles)
        const map = this.make.tilemap({ width: 50, height: 38, tileWidth: 16, tileHeight: 16 });
        const tileset = map.addTilesetImage('desert_tile');
        const layer = map.createBlankLayer('background', tileset, 0, 0);
        layer.fill(0, 0, 0, map.width, map.height);

        // Initialize grid for building placement
        this.grid = [];
        for (let y = 0; y < map.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < map.width; x++) {
                this.grid[y][x] = null;
            }
        }

        // Initialize resources
        this.budget = 10000;
        this.electricity = 0;
        this.computingPower = 0;
        this.aiAbility = 0;

        // Define building properties
        this.buildings = {
            office: { cost: 2000, electricity: -10, computing: 0, sprite: 'office' },
            server_rack: { cost: 1000, electricity: -5, computing: 10, sprite: 'server_rack' },
            solar_panel: { cost: 500, electricity: 10, computing: 0, sprite: 'solar_panel' },
            cooling_system: { cost: 1500, electricity: -5, computing: 0, sprite: 'cooling_system' }
        };

        // Create build menu (top-left corner)
        this.buildMenu = this.add.group();
        const officeButton = this.add.sprite(10, 10, 'office').setInteractive();
        const serverButton = this.add.sprite(30, 10, 'server_rack').setInteractive();
        const solarButton = this.add.sprite(50, 10, 'solar_panel').setInteractive();
        const coolingButton = this.add.sprite(70, 10, 'cooling_system').setInteractive();
        officeButton.on('pointerdown', () => this.selectBuilding('office'));
        serverButton.on('pointerdown', () => this.selectBuilding('server_rack'));
        solarButton.on('pointerdown', () => this.selectBuilding('solar_panel'));
        coolingButton.on('pointerdown', () => this.selectBuilding('cooling_system'));
        this.buildMenu.addMultiple([officeButton, serverButton, solarButton, coolingButton]);

        // Handle building placement with mouse clicks
        this.input.on('pointerdown', this.placeBuilding, this);

        // Periodic resource and AI updates (every second)
        this.time.addEvent({
            delay: 1000,
            callback: this.updateResources,
            callbackScope: this,
            loop: true
        });

        // Launch HUD scene
        this.scene.launch('HUDScene');
    }

    // Select a building type from the menu
    selectBuilding(type) {
        this.selectedBuilding = type;
    }

    // Place a building on the grid
    placeBuilding(pointer) {
        if (!this.selectedBuilding) return;
        const buildingData = this.buildings[this.selectedBuilding];
        if (this.budget < buildingData.cost) {
            console.log('Not enough budget!');
            return;
        }

        const x = Math.floor(pointer.x / 16);
        const y = Math.floor(pointer.y / 16);

        // Check if the grid cell is empty and within bounds
        if (x >= 0 && x < 50 && y >= 0 && y < 38 && this.grid[y][x] === null) {
            const building = this.add.sprite(x * 16 + 8, y * 16 + 8, buildingData.sprite);
            this.grid[y][x] = { type: this.selectedBuilding, sprite: building };
            this.budget -= buildingData.cost;
            this.electricity += buildingData.electricity;
            this.computingPower += buildingData.computing;
        }
    }

    // Update resources and AI ability every second
    updateResources() {
        this.budget += this.aiAbility * 10; // Income from AI services
        this.aiAbility += this.computingPower * 0.01; // AI ability growth
        if (this.aiAbility > 50) {
            const chance = (this.aiAbility - 50) / 100;
            if (Math.random() < chance) {
                this.triggerSentience();
            }
        }
    }

    // Handle AI sentience event (placeholder)
    triggerSentience() {
        console.log('AI has become sentient! Game effects to be implemented.');
        // Possible future effects: reset aiAbility, lose budget, etc.
    }
}

// HUD Scene: Displays resource values
class HUDScene extends Phaser.Scene {
    constructor() {
        super('HUDScene');
    }

    create() {
        // Initialize text displays
        this.budgetText = this.add.text(10, 550, 'Budget: $10000', { font: '16px Arial', fill: '#ffffff' });
        this.electricityText = this.add.text(10, 570, 'Electricity: 0 kW', { font: '16px Arial', fill: '#ffffff' });
        this.computingText = this.add.text(200, 570, 'Computing Power: 0 units', { font: '16px Arial', fill: '#ffffff' });
        this.aiText = this.add.text(200, 550, 'AI Ability: 0', { font: '16px Arial', fill: '#ffffff' });
    }

    update() {
        // Update text with current values from MainScene
        const mainScene = this.scene.get('MainScene');
        this.budgetText.setText(`Budget: $${mainScene.budget.toFixed(0)}`);
        this.electricityText.setText(`Electricity: ${mainScene.electricity.toFixed(0)} kW`);
        this.computingText.setText(`Computing Power: ${mainScene.computingPower.toFixed(0)} units`);
        this.aiText.setText(`AI Ability: ${mainScene.aiAbility.toFixed(2)}`);
    }
}
