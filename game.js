if (typeof Phaser === 'undefined') {
    console.error('Phaser is not loaded. Check the script tag in index.html.');
} else {
    class NarrativeScene extends Phaser.Scene {
        constructor() {
            super('NarrativeScene');
        }

        init(data) {
            this.text = data.text;
            this.onClose = data.onClose;
        }

        create() {
            this.add.rectangle(400, 300, 600, 200, 0x333333).setOrigin(0.5);
            this.add.text(400, 260, this.text, {
                font: '16px Arial',
                fill: '#ffffff',
                wordWrap: { width: 560, useAdvancedWrap: true }
            }).setOrigin(0.5);

            this.okButton = this.add.text(400, 480, 'OK', {
                font: '20px Arial',
                fill: '#00ff00',
                backgroundColor: '#000000',
                padding: { x: 15, y: 5 }
            })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    this.scene.stop();
                    this.onClose();
                });

            this.input.keyboard.on('keydown', (event) => {
                if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') {
                    this.scene.stop();
                    this.onClose();
                }
            });
        }
    }

    class BootScene extends Phaser.Scene {
        constructor() {
            super('BootScene');
        }

        preload() {
            this.load.image('desert_backdrop', 'assets/desert_backdrop.png');
            this.load.image('desert_overlay', 'assets/desert_overlay.png');
            this.load.image('office', 'assets/office.png');
            this.load.image('server_rack', 'assets/server_rack.png');
            this.load.image('solar_panel', 'assets/solar_panel.png');
            this.load.image('cooling_system', 'assets/cooling_system.png');
            this.load.image('office_high', 'assets/office_high.png');
            this.load.image('server_rack_high', 'assets/server_rack_high.png');
            this.load.image('solar_panel_high', 'assets/solar_panel_high.png');
            this.load.image('cooling_system_high', 'assets/cooling_system_high.png');
        }

        create() {
            this.scene.start('MainScene');
        }
    }

    class MainScene extends Phaser.Scene {
        constructor() {
            super('MainScene');
        }

        create() {
            // Background and overlay
            this.add.image(400, 300, 'desert_backdrop').setOrigin(0.5, 0.5).setDepth(0);
            this.overlay = this.add.image(400, 300, 'desert_overlay').setOrigin(0.5, 0.5).setAlpha(0).setDepth(0);

            // Game state
            this.budget = 10000;
            this.electricityGenerated = 0;
            this.electricityUsed = 0;
            this.computingPower = 0;
            this.aiAbility = 0;
            this.heatLevel = 0;
            this.maxHeat = 50;
            this.maxElectricity = 50;
            this.offices = 0;
            this.servers = 0;

            // Building data
            this.buildings = {
                office: { cost: 2000, electricity: -10, computing: 0, sprite: 'office', shopSprite: 'office_high', tooltip: 'Required first. Allows 3 servers per office.' },
                server_rack: { cost: 1000, electricity: -5, computing: 10, heat: 10, sprite: 'server_rack', shopSprite: 'server_rack_high', tooltip: 'Boosts computing power, uses power and generates heat.' },
                solar_panel: { cost: 500, electricity: 10, computing: 0, sprite: 'solar_panel', shopSprite: 'solar_panel_high', tooltip: 'Generates electricity to power servers.' },
                cooling_system: { cost: 1500, electricity: -5, heat: -15, sprite: 'cooling_system', shopSprite: 'cooling_system_high', tooltip: 'Reduces heat from servers.' }
            };

            // Top HUD
            const hudY = 0;
            this.add.rectangle(400, hudY + 20, 800, 40, 0x333333).setOrigin(0.5, 0.5).setDepth(10);

            // Power and Heat Bars (HUD)
            this.powerBarOutlineUsage = this.add.rectangle(20, 400, 20, 200, 0xffffff, 2).setOrigin(0, 1).setDepth(10);
            this.powerBarUsage = this.add.graphics().setDepth(10);
            this.add.text(30, 570, 'Usage', { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5).setDepth(10);
            this.powerBarOutlineOutput = this.add.rectangle(40, 400, 20, 200, 0xffffff, 2).setOrigin(0, 1).setDepth(10);
            this.powerBarOutput = this.add.graphics().setDepth(10);
            this.add.text(30, 590, 'Output', { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5).setDepth(10);

            this.heatBarOutline = this.add.rectangle(760, 400, 20, 200, 0xffffff, 2).setOrigin(0, 1).setDepth(10);
            this.heatBar = this.add.graphics().setDepth(10);
            this.add.text(760, 580, 'Heat', { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5).setDepth(10);

            // Shop HUD
            const shopY = 530;
            this.add.rectangle(400, shopY + 50, 800, 140, 0x333333).setOrigin(0.5, 0.5).setDepth(10);
            this.shopHUD = this.add.group();
            const shopWidth = 600;
            const startX = 400 - (shopWidth / 2);
            const shopItems = [
                { type: 'office', x: startX + 100 },
                { type: 'server_rack', x: startX + 250 },
                { type: 'solar_panel', x: startX + 400 },
                { type: 'cooling_system', x: startX + 550 }
            ];
            shopItems.forEach(item => {
                const buildingData = this.buildings[item.type];
                const button = this.add.sprite(item.x, shopY, buildingData.shopSprite)
                    .setScale(64 / 1024)
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.buyBuilding(item.type))
                    .on('pointerover', () => this.showTooltip(item.x, shopY - 80, buildingData.tooltip))
                    .on('pointerout', () => this.hideTooltip())
                    .setDepth(10);
                this.add.text(item.x, shopY + 40, item.type.replace('_', ' '), { font: '14px Arial', fill: '#ffffff' }).setOrigin(0.5).setDepth(10);
                this.add.text(item.x, shopY + 60, `$${buildingData.cost}`, { font: '12px Arial', fill: '#ffff00' }).setOrigin(0.5).setDepth(10);
                this.shopHUD.add(button);
            });

            // Track revealed overlay areas
            this.revealedAreas = new Set();

            // Update resources every second
            this.time.addEvent({
                delay: 1000,
                callback: this.updateResources,
                callbackScope: this,
                loop: true
            });

            // Initial narrative
            this.showNarrative('Your mission is to build a powerful AI compute cluster hidden in the desert. Start by buying an office.');

            this.narrativeShownHeat = false;
            this.narrativeShownAI = false;
            this.narrativeShownPower = false;

            this.scene.launch('HUDScene');
        }

        buyBuilding(type) {
            const buildingData = this.buildings[type];
            if (this.budget < buildingData.cost) {
                this.showPopup('Not enough budget!');
                return;
            }

            if (type !== 'office' && this.offices === 0) {
                this.showPopup('Buy an office first!');
                return;
            }

            if (type === 'server_rack' && this.servers >= this.offices * 3) {
                this.showPopup('Buy another office to add more servers! (3 per office)');
                return;
            }

            const netElectricity = this.electricityGenerated - this.electricityUsed;
            if (this.offices > 0 && (type === 'server_rack' || type === 'cooling_system' || type === 'office') && netElectricity + buildingData.electricity < 0) {
                this.showPopup('Not enough electricity! Buy more solar panels.');
                return;
            }

            const newHeat = this.heatLevel + (buildingData.heat || 0);
            if (newHeat > this.maxHeat) {
                this.showPopup('Heat level too high! Buy a cooling system.');
                return;
            }

            this.budget -= buildingData.cost;
            if (buildingData.electricity < 0) {
                this.electricityUsed += Math.abs(buildingData.electricity);
            } else {
                this.electricityGenerated += buildingData.electricity;
            }
            this.computingPower += buildingData.computing || 0;
            this.heatLevel = Math.max(0, newHeat);

            if (type === 'office') this.offices++;
            if (type === 'server_rack') this.servers++;

            this.revealOverlay(type);

            this.checkNarrativeEvents();

            this.updatePowerBars();
            this.updateHeatBar();
        }

        revealOverlay(type) {
            const gridSize = 200; // 200x200 pixel squares
            const gridWidth = Math.floor(800 / gridSize); // 4 columns (800 / 200)
            const gridHeight = Math.floor(600 / gridSize); // 3 rows (600 / 200), but we'll limit to y=530

            // Define available areas based on building type
            let availableAreas = [];
            if (type === 'solar_panel') {
                // Top half: y=0 to y=200 (row 0)
                for (let x = 0; x < gridWidth; x++) {
                    const key = `${x},0`;
                    if (!this.revealedAreas.has(key)) {
                        availableAreas.push({ x: x, y: 0 });
                    }
                }
            } else {
                // Bottom half: y=200 to y=400 (rows 1 and 2, stopping before shop HUD at y=530)
                for (let y = 1; y <= 2; y++) {
                    for (let x = 0; x < gridWidth; x++) {
                        const key = `${x},${y}`;
                        if (!this.revealedAreas.has(key)) {
                            availableAreas.push({ x: x, y: y });
                        }
                    }
                }
            }

            if (availableAreas.length === 0) return; // No more areas to reveal

            // Pick a random unrevealed area
            const selectedArea = Phaser.Utils.Array.GetRandom(availableAreas);
            const { x, y } = selectedArea;
            const key = `${x},${y}`;
            this.revealedAreas.add(key);

            // Position and crop the revealed square
            const spriteX = x * gridSize + gridSize / 2;
            const spriteY = y * gridSize + gridSize / 2;
            const cropRect = new Phaser.Geom.Rectangle(x * gridSize, y * gridSize, gridSize, gridSize);

            // Add the revealed sprite at depth 0 (under HUD)
            this.add.sprite(spriteX, spriteY, 'desert_overlay')
                .setOrigin(0.5, 0.5)
                .setCrop(cropRect)
                .setAlpha(1)
                .setDepth(0);
        }

        showNarrative(text) {
            this.scene.launch('NarrativeScene', {
                text: text,
                onClose: () => this.scene.resume()
            });
            this.scene.pause();
        }

        updatePowerBars() {
            const usagePercentage = Math.min(this.electricityUsed / this.maxElectricity, 1);
            const barHeight = Math.max(0, 200 * usagePercentage);
            const usageColor = usagePercentage > 0.8 ? 0xff0000 : 0x00ff00;

            this.powerBarUsage.clear();
            this.powerBarUsage.fillStyle(usageColor, 1);
            this.powerBarUsage.fillRect(20, 400 - barHeight, 16, barHeight);

            const outputPercentage = Math.min(this.electricityGenerated / this.maxElectricity, 1);
            const outputBarHeight = Math.max(0, 200 * outputPercentage);
            const outputColor = outputPercentage > 0.8 ? 0xff0000 : 0x00ff00;

            this.powerBarOutput.clear();
            this.powerBarOutput.fillStyle(outputColor, 1);
            this.powerBarOutput.fillRect(40, 400 - outputBarHeight, 16, outputBarHeight);
        }

        updateHeatBar() {
            const heatPercentage = Math.min(this.heatLevel / this.maxHeat, 1);
            const barHeight = Math.max(0, 200 * heatPercentage);
            const color = heatPercentage > 0.8 ? 0xff0000 : 0xffa500;

            this.heatBar.clear();
            this.heatBar.fillStyle(color, 1);
            this.heatBar.fillRect(760, 400 - barHeight, 16, barHeight);
        }

        updateResources() {
            this.budget += Math.min(this.aiAbility * 10, 10000);
            this.aiAbility = Math.min(this.aiAbility + (this.computingPower * 0.01), 1000);
            if (this.aiAbility > 50) {
                const chance = (this.aiAbility - 50) / 100;
                if (Math.random() < chance) {
                    this.triggerSentience();
                }
            }
            this.updatePowerBars();
            this.updateHeatBar();
            this.checkNarrativeEvents();
        }

        checkNarrativeEvents() {
            if (this.heatLevel > 40 && !this.narrativeShownHeat) {
                this.narrativeShownHeat = true;
                this.showNarrative('Your servers are overheating! Buy a cooling system.');
            }
            if (this.aiAbility > 75 && !this.narrativeShownAI) {
                this.narrativeShownAI = true;
                this.showNarrative('Your AI is getting smarter... Keep an eye on it!');
            }
            if (this.electricityUsed > this.electricityGenerated && !this.narrativeShownPower) {
                this.narrativeShownPower = true;
                this.showNarrative('Power shortage! Add more solar panels.');
            }
        }

        showTooltip(x, y, text) {
            if (this.tooltip) this.tooltip.destroy();
            this.tooltip = this.add.text(x, y, text, { font: '14px Arial', fill: '#ffffff', backgroundColor: '#333333' }).setOrigin(0.5);
        }

        hideTooltip() {
            if (this.tooltip) {
                this.tooltip.destroy();
                this.tooltip = null;
            }
        }

        showPopup(message) {
            this.popup = this.add.text(400, 300, message, { font: '20px Arial', fill: '#ffffff', backgroundColor: '#ff0000', padding: { x: 10, y: 10 } });
            this.popup.setOrigin(0.5).setVisible(true);
            this.time.delayedCall(2000, () => this.popup.setVisible(false), [], this);
        }

        triggerSentience() {
            console.log('AI has become sentient! Game effects to be implemented.');
        }
    }

    class HUDScene extends Phaser.Scene {
        constructor() {
            super('HUDScene');
        }

        create() {
            this.budgetText = this.add.text(20, 15, 'Budget: $10000', { font: '22px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.gflopsText = this.add.text(220, 15, 'G-Flops: 0', { font: '22px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.electricityText = this.add.text(400, 15, 'Electricity: 0 kW', { font: '22px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.aiText = this.add.text(600, 15, 'AI: 0', { font: '22px Arial', fill: '#ffffff', fontStyle: 'bold' });
        }

        update() {
            const mainScene = this.scene.get('MainScene');
            this.budgetText.setText(`Budget: $${Math.floor(mainScene.budget)}`);
            this.gflopsText.setText(`G-Flops: ${Math.floor(mainScene.computingPower)}`);
            this.electricityText.setText(`Electricity: ${mainScene.electricityGenerated - mainScene.electricityUsed} kW`);
            this.aiText.setText(`AI: ${mainScene.aiAbility.toFixed(2)}`);
        }
    }

    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        scene: [BootScene, MainScene, HUDScene, NarrativeScene],
        pixelArt: true,
        backgroundColor: '#000000'
    };

    const game = new Phaser.Game(config);
}
