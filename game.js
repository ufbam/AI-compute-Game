if (typeof Phaser === 'undefined') {
    console.error('Phaser is not loaded. Check the script tag in index.html.');
} else {
    // Narrative popup scene
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
                wordWrap: { width: 560 }
            }).setOrigin(0.5);

            this.add.text(400, 480, 'OK', {
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
        }
    }

    // Boot scene for preloading assets
    class BootScene extends Phaser.Scene {
        constructor() {
            super('BootScene');
        }

        preload() {
            this.load.image('desert_backdrop', 'assets/desert_backdrop.png');
            this.load.image('desert_overlay', 'assets/desert_overlay.png');
            this.load.image('office_high', 'assets/office_high.png');
            this.load.image('server_rack_high', 'assets/server_rack_high.png');
            this.load.image('solar_panel_high', 'assets/solar_panel_high.png');
            this.load.image('cooling_system_high', 'assets/cooling_system_high.png');
        }

        create() {
            this.scene.start('MainScene');
        }
    }

    // Main gameplay scene
    class MainScene extends Phaser.Scene {
        constructor() {
            super('MainScene');
        }

        create() {
            // Bottom layer: the desert overlay (final image)
            this.add.image(400, 300, 'desert_overlay').setOrigin(0.5).setDepth(0);

            // Top layer: RenderTexture as the cover with backdrop
            this.coverRT = this.add.renderTexture(0, 0, 800, 600).setOrigin(0).setDepth(1);
            this.coverRT.draw('desert_backdrop', 400, 300);

            // Graphics for erasing
            this.eraseGraphics = this.make.graphics({ x: 0, y: 0, add: false });

            // Initialize game resources
            this.budget = 10000;
            this.electricityGenerated = 0;
            this.electricityUsed = 0;
            this.computingPower = 0;
            this.aiAbility = 0;
            this.heatLevel = 0;
            this.maxHeat = 100;
            this.maxElectricity = 100;
            this.barMaxHeat = 400; // Higher max for smaller increments
            this.barMaxElectricity = 400; // Higher max for smaller increments
            this.offices = 0;
            this.servers = 0;

            // Building definitions
            this.buildings = {
                office: {
                    cost: 2000,
                    electricity: -10,
                    computing: 0,
                    shopSprite: 'office_high',
                    tooltip: 'Required first. Allows 3 servers per office.'
                },
                server_rack: {
                    cost: 1000,
                    electricity: -5,
                    computing: 10,
                    heat: 10,
                    shopSprite: 'server_rack_high',
                    tooltip: 'Boosts computing power, uses power and generates heat.'
                },
                solar_panel: {
                    cost: 500,
                    electricity: 10,
                    computing: 0,
                    shopSprite: 'solar_panel_high',
                    tooltip: 'Generates electricity to power servers.'
                },
                cooling_system: {
                    cost: 1500,
                    electricity: -5,
                    heat: -15,
                    shopSprite: 'cooling_system_high',
                    tooltip: 'Reduces heat from servers.'
                }
            };

            // Create shop UI
            const shopY = 530;
            this.add.rectangle(400, shopY + 50, 800, 140, 0x333333).setOrigin(0.5).setDepth(10);
            const shopItems = [
                { type: 'office', x: 150 },
                { type: 'server_rack', x: 300 },
                { type: 'solar_panel', x: 450 },
                { type: 'cooling_system', x: 600 }
            ];
            shopItems.forEach(item => {
                const data = this.buildings[item.type];
                this.add.sprite(item.x, shopY, data.shopSprite)
                    .setScale(0.0625)
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.buyBuilding(item.type))
                    .on('pointerover', () => this.showTooltip(item.x, shopY - 80, data.tooltip))
                    .on('pointerout', () => this.hideTooltip())
                    .setDepth(10);
                this.add.text(item.x, shopY + 40, item.type.replace('_', ' '), {
                    font: '14px Arial',
                    fill: '#ffffff'
                }).setOrigin(0.5).setDepth(10);
                this.add.text(item.x, shopY + 60, `$${data.cost}`, {
                    font: '12px Arial',
                    fill: '#ffff00'
                }).setOrigin(0.5).setDepth(10);
            });

            // Resource bars
            this.powerBarUsage = this.add.graphics().setDepth(10);
            this.powerBarOutlineUsage = this.add.rectangle(20, 400, 20, 200, 0xffffff, 0)
                .setOrigin(0, 1)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(10);
            this.add.text(30, 570, 'Usage', { font: '16px Arial', fill: '#ffffff' })
                .setOrigin(0.5).setDepth(10);

            this.powerBarOutput = this.add.graphics().setDepth(10);
            this.powerBarOutlineOutput = this.add.rectangle(40, 400, 20, 200, 0xffffff, 0)
                .setOrigin(0, 1)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(10);
            this.add.text(30, 590, 'Output', { font: '16px Arial', fill: '#ffffff' })
                .setOrigin(0.5).setDepth(10);

            this.heatBar = this.add.graphics().setDepth(10);
            this.heatBarOutline = this.add.rectangle(760, 400, 20, 200, 0xffffff, 0)
                .setOrigin(0, 1)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(10);
            this.add.text(760, 580, 'Heat', { font: '16px Arial', fill: '#ffffff' })
                .setOrigin(0.5).setDepth(10);

            // Cover grid setup
            this.gridWidth = 5; // 5 columns (160px each)
            this.gridHeight = 4; // 4 rows (150px each)
            this.cellWidth = 800 / this.gridWidth; // 160 pixels
            this.cellHeight = 600 / this.gridHeight; // 150 pixels
            this.revealedCells = new Set();

            // Update resources every second
            this.time.addEvent({
                delay: 1000,
                callback: this.updateResources,
                callbackScope: this,
                loop: true
            });

            this.showNarrative('Build an AI compute cluster in the desert. Start with an office.');
            this.scene.launch('HUDScene');
        }

        buyBuilding(type) {
            const data = this.buildings[type];
            if (this.budget < data.cost) {
                this.showPopup('Not enough budget!');
                return;
            }
            if (type !== 'office' && this.offices === 0) {
                this.showPopup('Buy an office first!');
                return;
            }
            if (type === 'server_rack' && this.servers >= this.offices * 3) {
                this.showPopup('Need another office for more servers!');
                return;
            }
            const netElectricity = this.electricityGenerated - this.electricityUsed + data.electricity;
            if (this.offices > 0 && netElectricity < 0 && data.electricity < 0) {
                this.showPopup('Not enough electricity! Add solar panels.');
                return;
            }
            const newHeat = this.heatLevel + (data.heat || 0);
            if (newHeat > this.maxHeat) {
                this.showPopup('Too hot! Add a cooling system.');
                return;
            }

            this.budget -= data.cost;
            if (data.electricity > 0) this.electricityGenerated += data.electricity;
            else this.electricityUsed += Math.abs(data.electricity);
            this.computingPower += data.computing || 0;
            this.heatLevel = Math.max(0, newHeat);
            if (type === 'office') this.offices++;
            if (type === 'server_rack') this.servers++;

            this.revealCoverCell(type);
            this.updateBars();
        }

        revealCoverCell(type) {
            let availableCells = [];
            const upperHalfRows = [0, 1]; // Rows 0 and 1 for upper half (y=0 to y=300)
            const lowerHalfRows = [2, 3]; // Rows 2 and 3 for lower half (y=300 to y=600)

            for (let col = 0; col < this.gridWidth; col++) {
                for (let row = 0; row < this.gridHeight; row++) {
                    const key = `${col},${row}`;
                    if (!this.revealedCells.has(key)) {
                        if (type === 'solar_panel' && upperHalfRows.includes(row)) {
                            availableCells.push({ col, row, key });
                        } else if (type !== 'solar_panel' && lowerHalfRows.includes(row)) {
                            availableCells.push({ col, row, key });
                        }
                    }
                }
            }

            if (availableCells.length === 0) return;

            const cell = Phaser.Utils.Array.GetRandom(availableCells);
            this.revealedCells.add(cell.key);

            this.eraseGraphics.clear();
            this.eraseGraphics.fillStyle(0xffffff, 1);
            this.eraseGraphics.fillRect(0, 0, this.cellWidth, this.cellHeight);
            this.coverRT.erase(this.eraseGraphics, cell.col * this.cellWidth, cell.row * this.cellHeight);

            console.log(`Revealed ${type} at col ${cell.col}, row ${cell.row} - Total revealed: ${this.revealedCells.size}`);
        }

        updateBars() {
            const usageHeight = Math.min(this.electricityUsed / this.barMaxElectricity, 1) * 200;
            this.powerBarUsage.clear();
            this.powerBarUsage.fillStyle(usageHeight > 160 ? 0xff0000 : 0x00ff00, 1);
            this.powerBarUsage.fillRect(20, 400 - usageHeight, 16, usageHeight);

            const outputHeight = Math.min(this.electricityGenerated / this.barMaxElectricity, 1) * 200;
            this.powerBarOutput.clear();
            this.powerBarOutput.fillStyle(outputHeight > 160 ? 0xff0000 : 0x00ff00, 1);
            this.powerBarOutput.fillRect(40, 400 - outputHeight, 16, outputHeight);

            const heatHeight = Math.min(this.heatLevel / this.barMaxHeat, 1) * 200;
            this.heatBar.clear();
            this.heatBar.fillStyle(heatHeight > 160 ? 0xff0000 : 0xffa500, 1);
            this.heatBar.fillRect(760, 400 - heatHeight, 16, heatHeight);
        }

        updateResources() {
            this.budget += Math.min(this.aiAbility * 10, 10000);
            this.aiAbility = Math.min(this.aiAbility + (this.computingPower * 0.01), 1000);
            this.updateBars();
        }

        showNarrative(text) {
            this.scene.launch('NarrativeScene', {
                text,
                onClose: () => this.scene.resume()
            });
            this.scene.pause();
        }

        showTooltip(x, y, text) {
            if (this.tooltip) this.tooltip.destroy();
            this.tooltip = this.add.text(x, y, text, {
                font: '14px Arial',
                fill: '#ffffff',
                backgroundColor: '#333333'
            }).setOrigin(0.5).setDepth(10);
        }

        hideTooltip() {
            if (this.tooltip) this.tooltip.destroy();
            this.tooltip = null;
        }

        showPopup(message) {
            const popup = this.add.text(400, 500, message, {
                font: '20px Arial',
                fill: '#ffffff',
                backgroundColor: '#ff0000',
                padding: { x: 10, y: 10 }
            }).setOrigin(0.5).setDepth(10);
            this.time.delayedCall(2000, () => popup.destroy());
        }
    }

    // HUD scene for displaying resource information
    class HUDScene extends Phaser.Scene {
        constructor() {
            super('HUDScene');
        }

        create() {
            this.add.rectangle(400, 20, 800, 40, 0x333333, 0.8).setOrigin(0.5).setDepth(9);
            this.budgetText = this.add.text(20, 15, 'Budget: $10000', { font: '22px Arial', fill: '#ffffff' }).setDepth(10);
            this.gflopsText = this.add.text(220, 15, 'G-Flops: 0', { font: '22px Arial', fill: '#ffffff' }).setDepth(10);
            this.electricityText = this.add.text(400, 15, 'Electricity: 0 kW', { font: '22px Arial', fill: '#ffffff' }).setDepth(10);
            this.aiText = this.add.text(600, 15, 'AI: 0', { font: '22px Arial', fill: '#ffffff' }).setDepth(10);
        }

        update() {
            const main = this.scene.get('MainScene');
            this.budgetText.setText(`Budget: $${Math.floor(main.budget)}`);
            this.gflopsText.setText(`G-Flops: ${Math.floor(main.computingPower)}`);
            this.electricityText.setText(`Electricity: ${main.electricityGenerated - main.electricityUsed} kW`);
            this.aiText.setText(`AI: ${main.aiAbility.toFixed(2)}`);
        }
    }

    // Game configuration
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
