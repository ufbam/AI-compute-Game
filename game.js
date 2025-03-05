if (typeof Phaser === 'undefined') {
    console.error('Phaser is not loaded. Check the script tag in index.html.');
} else {
    // Scene for narrative popups
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
            // Add the background image
            this.add.image(400, 300, 'desert_backdrop').setOrigin(0.5).setDepth(0);

            // Add the overlay image
            // (It will be fully hidden at the start via a mask.)
            this.overlay = this.add.image(400, 300, 'desert_overlay').setOrigin(0.5).setDepth(1);

            // Create a graphics object to act as the mask.
            // At the start, we won’t draw any cells so nothing from the overlay is shown.
            this.overlayMaskGraphics = this.make.graphics({ x: 0, y: 0, add: false });
            this.overlay.setMask(new Phaser.Display.Masks.GeometryMask(this, this.overlayMaskGraphics));

            // Game resources and limits
            this.budget = 10000;
            this.electricityGenerated = 0;
            this.electricityUsed = 0;
            this.computingPower = 0;
            this.aiAbility = 0;
            this.heatLevel = 0;
            this.maxHeat = 100;         // gameplay threshold for heat
            this.maxElectricity = 100;  // gameplay threshold for electricity

            // For visual bars, we use higher max values so they fill in smaller increments.
            this.barMaxHeat = 400;
            this.barMaxElectricity = 400;

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

            // Create the shop UI
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

            // Create resource bars
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

            // --- Overlay Mask Setup ---
            // We divide the overlay image into 20 cells (a 5 x 4 grid).
            // Since the overlay is 800×600, each cell will be 800/5 = 160px wide and 600/4 = 150px tall.
            this.gridWidth = 5;
            this.gridHeight = 4;
            this.cellWidth = 800 / this.gridWidth;   // 160
            this.cellHeight = 600 / this.gridHeight;   // 150

            // Keep track of which grid cells have been revealed.
            // We store keys in the format "col,row" (e.g., "2,1").
            this.revealedCells = new Set();

            // Update game resources every second.
            this.time.addEvent({
                delay: 1000,
                callback: this.updateResources,
                callbackScope: this,
                loop: true
            });

            // Start with a narrative prompt.
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

            // Reveal one new cell from the overlay mask.
            this.revealOverlayCell();
            this.updateBars();
        }

        revealOverlayCell() {
            // Build an array of all unrevealed cell positions.
            const availableCells = [];
            for (let col = 0; col < this.gridWidth; col++) {
                for (let row = 0; row < this.gridHeight; row++) {
                    const key = `${col},${row}`;
                    if (!this.revealedCells.has(key)) {
                        availableCells.push({ col, row, key });
                    }
                }
            }

            // If all cells are already revealed, do nothing.
            if (availableCells.length === 0) return;

            // Pick a random unrevealed cell.
            const cell = Phaser.Utils.Array.GetRandom(availableCells);
            this.revealedCells.add(cell.key);

            // Clear the mask graphics and redraw all revealed cells.
            this.overlayMaskGraphics.clear();
            this.overlayMaskGraphics.fillStyle(0xffffff);
            this.revealedCells.forEach(key => {
                const [col, row] = key.split(',').map(Number);
                this.overlayMaskGraphics.fillRect(
                    col * this.cellWidth,
                    row * this.cellHeight,
                    this.cellWidth,
                    this.cellHeight
                );
            });

            console.log(`Revealed overlay cell at column ${cell.col}, row ${cell.row}`);
        }

        updateBars() {
            // Update electricity usage bar.
            const usageHeight = Math.min(this.electricityUsed / this.barMaxElectricity, 1) * 200;
            this.powerBarUsage.clear();
            this.powerBarUsage.fillStyle(usageHeight > 160 ? 0xff0000 : 0x00ff00, 1);
            this.powerBarUsage.fillRect(20, 400 - usageHeight, 16, usageHeight);

            // Update electricity generation bar.
            const outputHeight = Math.min(this.electricityGenerated / this.barMaxElectricity, 1) * 200;
            this.powerBarOutput.clear();
            this.powerBarOutput.fillStyle(outputHeight > 160 ? 0xff0000 : 0x00ff00, 1);
            this.powerBarOutput.fillRect(40, 400 - outputHeight, 16, outputHeight);

            // Update heat bar.
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

    // Heads-up display (HUD) scene
    class HUDScene extends Phaser.Scene {
        constructor() {
            super('HUDScene');
        }

        create() {
            this.add.rectangle(400, 20, 800, 40, 0x333333).setOrigin(0.5).setDepth(9);
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
