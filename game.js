if (typeof Phaser === 'undefined') {
    console.error('Phaser is not loaded. Check the script tag in index.html.');
} else {

    // TitleScene: displays the title screen until the user clicks.
    class TitleScene extends Phaser.Scene {
        constructor() {
            super('TitleScene');
        }
        preload() {
            this.load.image('title', 'assets/title.png');
        }
        create() {
            this.add.image(400, 300, 'title').setOrigin(0.5);
            // When user clicks anywhere, go to BootScene.
            this.input.once('pointerdown', () => {
                this.scene.start('BootScene');
            });
        }
    }

    // BootScene: preloads all assets.
    class BootScene extends Phaser.Scene {
        constructor() {
            super('BootScene');
        }
        preload() {
            // Background & shop icons.
            this.load.image('desert_backdrop', 'assets/desert_backdrop.png');
            this.load.image('office_high', 'assets/office_high.png');
            this.load.image('server_rack_high', 'assets/server_rack_high.png'); // shop icon for server farm.
            this.load.image('solar_panel_high', 'assets/solar_panel_high.png');
            this.load.image('cooling_system_high', 'assets/cooling_system_high.png');

            // Asset layers.
            // Offices (1 to 3)
            this.load.image('office1', 'assets/office1.png');
            this.load.image('office2', 'assets/office2.png');
            this.load.image('office3', 'assets/office3.png');
            // Server farms (1 to 5)
            this.load.image('server1', 'assets/server1.png');
            this.load.image('server2', 'assets/server2.png');
            this.load.image('server3', 'assets/server3.png');
            this.load.image('server4', 'assets/server4.png');
            this.load.image('server5', 'assets/server5.png');
            // Solar panels (1 to 7)
            this.load.image('solar1', 'assets/solar1.png');
            this.load.image('solar2', 'assets/solar2.png');
            this.load.image('solar3', 'assets/solar3.png');
            this.load.image('solar4', 'assets/solar4.png');
            this.load.image('solar5', 'assets/solar5.png');
            this.load.image('solar6', 'assets/solar6.png');
            this.load.image('solar7', 'assets/solar7.png');
            // Cooling systems (1 to 3)
            this.load.image('cooling1', 'assets/cooling1.png');
            this.load.image('cooling2', 'assets/cooling2.png');
            this.load.image('cooling3', 'assets/cooling3.png');
        }
        create() {
            this.scene.start('MainScene');
        }
    }

    // NarrativeScene: used for instructional pop-ups.
    class NarrativeScene extends Phaser.Scene {
        constructor() {
            super('NarrativeScene');
        }
        init(data) {
            this.text = data.text;
            this.onClose = data.onClose;
        }
        create() {
            // Narrative box: 600x130 centered at (400,300)
            this.add.rectangle(400, 300, 600, 130, 0x333333).setOrigin(0.5);
            this.add.text(400, 300, this.text, {
                font: '16px Arial',
                fill: '#ffffff',
                align: 'center',
                wordWrap: { width: 560 }
            }).setOrigin(0.5);
            // OK button moved down to y = 470.
            this.add.text(400, 470, 'OK', {
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

    // MainScene: main game logic.
    class MainScene extends Phaser.Scene {
        constructor() {
            super('MainScene');
        }
        create() {
            // Draw the desert backdrop.
            this.add.image(400, 300, 'desert_backdrop').setOrigin(0.5).setDepth(0);

            // Initialize game resources.
            this.budget = 10000;
            this.electricityGenerated = 0;
            this.electricityUsed = 0;
            this.computingPower = 0;
            this.aiAbility = 0;
            this.heatLevel = 0;
            this.maxHeat = 100;
            this.maxElectricity = 100;
            // Lower threshold so power bars grow more easily.
            this.barMaxElectricity = 200;
            this.barMaxHeat = 100;

            this.offices = 0;
            this.servers = 0;

            // Training run flags.
            this.trainingRunActive = false;
            this.trainingExtraLoad = 0;
            this.lastAIMilestone = 0;

            // Building definitions.
            this.buildings = {
                office: {
                    cost: 2000,
                    electricity: -10,
                    computing: 0,
                    shopSprite: 'office_high',
                    tooltip: 'Required first. Allows 5 servers per office.'
                },
                server_farm: {
                    cost: 1000,
                    electricity: -5,
                    computing: 10,
                    heat: 15,
                    shopSprite: 'server_rack_high',
                    tooltip: 'Boosts computing power, uses power and generates extra heat.'
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

            // Initialize purchase counts and display texts.
            this.buildingCounts = {
                office: 0,
                server_farm: 0,
                solar_panel: 0,
                cooling_system: 0
            };
            this.purchaseTexts = {};

            // --- Create the Shop UI ---
            const shopY = 530;
            this.add.rectangle(400, shopY + 50, 800, 140, 0x333333).setOrigin(0.5).setDepth(10);
            const shopItems = [
                { type: 'office', x: 150 },
                { type: 'server_farm', x: 300 },
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
                this.purchaseTexts[item.type] = this.add.text(item.x, shopY - 50, '0 purchased', {
                    font: '12px Arial',
                    fill: '#ffffff'
                }).setOrigin(0.5).setDepth(10);
            });

            // --- Create Resource Bars ---
            // Simple rectangular bars.
            this.powerBarUsage = this.add.graphics().setDepth(11);
            this.powerBarOutput = this.add.graphics().setDepth(11);
            this.heatBar = this.add.graphics().setDepth(11);

            // Draw outlines for the bars.
            this.powerBarOutlineUsage = this.add.rectangle(20, 520, 16, 200, 0xffffff, 0)
                .setOrigin(0, 1)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(10);
            this.powerBarOutlineOutput = this.add.rectangle(40, 520, 16, 200, 0xffffff, 0)
                .setOrigin(0, 1)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(10);
            this.heatBarOutline = this.add.rectangle(760, 520, 16, 200, 0xffffff, 0)
                .setOrigin(0, 1)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(10);
            // Left power bar label: two lines ("Power" and "In/Out").
            this.add.text(28, 540, "Power\nIn/Out", { font: '16px Arial', fill: '#ffffff', align: 'center' })
                .setOrigin(0.5).setDepth(10);

            // --- Create HUD Top Section ---
            // Background rectangle for top HUD.
            this.add.rectangle(400, 20, 800, 40, 0x333333).setOrigin(0.5).setDepth(9);
            // Centered top labels shifted 10 pixels further left.
            this.budgetText = this.add.text(70, 15, 'Budget: $10000', { font: '22px Arial', fill: '#ffffff', align: 'center' }).setDepth(10);
            this.gflopsText = this.add.text(320, 15, 'G-Flops: 0', { font: '22px Arial', fill: '#ffffff', align: 'center' }).setDepth(10);
            this.electricityText = this.add.text(570, 15, 'Electricity: 0 kW', { font: '22px Arial', fill: '#ffffff', align: 'center' }).setDepth(10);
            // AI metric box.
            this.aiBox = this.add.rectangle(400, 70, 176, 48, 0x000000)
                .setStrokeStyle(2, 0x00ff00).setDepth(10);
            this.aiMetricText = this.add.text(400, 70, 'AI: 0', { font: 'bold 28px Arial', fill: '#00ff00' })
                .setOrigin(0.5).setDepth(11);

            // --- Initiate Training Run Button ---
            // Now centered at (400,130) beneath the AI box.
            this.trainingButton = this.add.text(400, 130, 'Initiate Training Run', {
                font: '16px Arial',
                fill: '#00ff00',
                backgroundColor: '#000000',
                padding: { x: 10, y: 5 }
            }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
            this.trainingButton.visible = false;
            this.trainingButton.on('pointerdown', () => {
                this.initiateTrainingRun();
            });

            // Opening narrative.
            this.showNarrative("Welcome to your AI venture! Build offices, server farms, solar panels, and cooling systems to boost your GFlops and increase your AI level. More GFlops mean faster AI growth, and training runs can supercharge your progress. Get started and watch your digital brain evolve!", true);

            this.lastAIMilestone = 0;
            this.scene.launch('HUDScene');

            // Initialize arrays for asset images.
            this.officeImages = [];
            this.serverFarmImages = [];
            this.solarPanels = [];
            this.coolingImages = [];

            // Helper method to update layers gradually (for server_farm, solar_panel, cooling_system).
            // Offices appear instantly.
            this.updateLayer = (buildingType, assetPrefix, maxLayers, layerArray) => {
                const count = this.buildingCounts[buildingType];
                const layerIndex = Math.floor((count - 1) / 3);
                const stage = (count - 1) % 3;
                const desiredAlpha = (stage + 1) / 3;
                if (layerIndex >= maxLayers) return;
                if (layerArray.length <= layerIndex) {
                    const key = assetPrefix + (layerIndex + 1);
                    let img = this.add.image(400, 300, key).setOrigin(0.5).setDepth(2);
                    img.setAlpha(desiredAlpha);
                    layerArray.push(img);
                } else {
                    let img = layerArray[layerIndex];
                    this.tweens.add({
                        targets: img,
                        alpha: desiredAlpha,
                        duration: 1000
                    });
                }
            };
        }

        getRandomGibberish() {
            const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
            let result = "";
            for (let i = 0; i < 30; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }

        getAINarrative(milestone) {
            if (milestone === 10) {
                return "Level 10: Your first chatbot debuts with a touch of wit.";
            } else if (milestone === 20) {
                return "Level 20: Government offices start outsourcing their dull tasks to your AI.";
            } else if (milestone === 30) {
                return "Level 30: Your AI begins crafting catchy slogans and clever quips.";
            } else if (milestone === 40) {
                return "Level 40: Humanoid robots now showcase your AI's sharp insights.";
            } else if (milestone === 50) {
                return "Level 50: Rumors hint that your AI is nearing true intelligence.";
            } else if (milestone >= 60 && milestone <= 100) {
                return "Level " + milestone + ": " + this.getRandomGibberish();
            } else if (milestone > 100) {
                return "Your AI is too lazy to write anything new.";
            } else {
                return "";
            }
        }

        showNarrative(text, pauseGame = true) {
            this.scene.launch('NarrativeScene', {
                text,
                onClose: () => { if (pauseGame) this.scene.resume(); }
            });
            if (pauseGame) this.scene.pause();
        }

        initiateTrainingRun() {
            if (this.trainingRunActive) {
                this.showPopup("Training run already in progress!");
                return;
            }
            this.trainingRunActive = true;
            this.trainingExtraLoad = 20;
            this.showPopup("Training run initiated!");
            this.time.delayedCall(3000, () => {
                this.trainingRunActive = false;
                this.trainingExtraLoad = 0;
                this.showPopup("Training run complete.");
            });
        }

        updateResources() {
            this.budget += Math.min(this.aiAbility * 10, 10000);
            if (this.trainingRunActive) {
                this.aiAbility = Math.min(this.aiAbility + (this.computingPower * 0.2), 1000);
            }
            let milestone = Math.floor(this.aiAbility / 10) * 10;
            if (milestone > this.lastAIMilestone) {
                this.lastAIMilestone = milestone;
                let narrative = this.getAINarrative(milestone);
                if (narrative) {
                    this.showNarrative(narrative, false);
                }
            }
            this.updateBars();
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
            if (type === 'server_farm' && this.buildingCounts.server_farm >= this.buildingCounts.office * 5) {
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
            if (data.electricity > 0) {
                this.electricityGenerated += data.electricity;
            } else {
                this.electricityUsed += Math.abs(data.electricity);
            }
            this.computingPower += data.computing || 0;
            this.heatLevel = Math.max(0, newHeat);
            if (type === 'office') this.offices++;
            if (type === 'server_farm') this.servers++;

            this.buildingCounts[type] = (this.buildingCounts[type] || 0) + 1;
            if (this.purchaseTexts[type]) {
                this.purchaseTexts[type].setText(`${this.buildingCounts[type]} purchased`);
            }

            // Offices appear instantly.
            if (type === 'office') {
                if (this.buildingCounts.office <= 3) {
                    let key = 'office' + this.buildingCounts.office;
                    let img = this.add.image(400, 300, key).setOrigin(0.5).setDepth(2);
                    img.setAlpha(1);
                    this.officeImages.push(img);
                }
            }
            // Other assets update gradually.
            if (type === 'server_farm') {
                this.updateLayer('server_farm', 'server', 5, this.serverFarmImages);
            }
            if (type === 'solar_panel') {
                this.updateLayer('solar_panel', 'solar', 7, this.solarPanels);
            }
            if (type === 'cooling_system') {
                this.updateLayer('cooling_system', 'cooling', 3, this.coolingImages);
            }

            // Reveal training button when the first server farm is built.
            if (type === 'server_farm' && this.buildingCounts.server_farm === 1) {
                this.trainingButton.visible = true;
                this.showNarrative("Great job on building your first server! Now, if you have surplus power, you can 'Initiate Training Run' to boost your AI and income.", false);
            }

            this.updateBars();
        }

        updateBars() {
            const effectiveUsage = this.electricityUsed + (this.trainingRunActive ? this.trainingExtraLoad : 0);
            const usageHeight = Math.min(effectiveUsage / this.barMaxElectricity, 1) * 200;
            this.powerBarUsage.clear();
            this.powerBarUsage.fillStyle(usageHeight > 0.8 ? 0xff0000 : 0x00ff00, 1);
            this.powerBarUsage.fillRect(20, 520 - usageHeight, 16, usageHeight);

            const outputHeight = Math.min(this.electricityGenerated / this.barMaxElectricity, 1) * 200;
            this.powerBarOutput.clear();
            this.powerBarOutput.fillStyle(outputHeight > 0.8 ? 0xff0000 : 0x00ff00, 1);
            this.powerBarOutput.fillRect(40, 520 - outputHeight, 16, outputHeight);

            const heatHeight = Math.min(this.heatLevel / this.maxHeat, 1) * 200;
            this.heatBar.clear();
            this.heatBar.fillStyle(heatHeight > 0.8 ? 0xff0000 : 0xffa500, 1);
            this.heatBar.fillRect(760, 520 - heatHeight, 16, heatHeight);
        }

        showNarrative(text, pauseGame = true) {
            this.scene.launch('NarrativeScene', {
                text,
                onClose: () => { if (pauseGame) this.scene.resume(); }
            });
            if (pauseGame) this.scene.pause();
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
            const popup = this.add.text(400, 480, message, {
                font: '20px Arial',
                fill: '#ffffff',
                backgroundColor: '#ff0000',
                padding: { x: 10, y: 10 }
            }).setOrigin(0.5).setDepth(10);
            this.time.delayedCall(2000, () => popup.destroy());
        }
    }

    // HUDScene: displays top HUD metrics.
    class HUDScene extends Phaser.Scene {
        constructor() {
            super('HUDScene');
        }
        create() {
            // Top background rectangle.
            this.add.rectangle(400, 20, 800, 40, 0x333333).setOrigin(0.5).setDepth(9);
            // Centered top labels shifted 10 pixels further left.
            this.budgetText = this.add.text(70, 15, 'Budget: $10000', { font: '22px Arial', fill: '#ffffff', align: 'center' }).setDepth(10);
            this.gflopsText = this.add.text(320, 15, 'G-Flops: 0', { font: '22px Arial', fill: '#ffffff', align: 'center' }).setDepth(10);
            this.electricityText = this.add.text(570, 15, 'Electricity: 0 kW', { font: '22px Arial', fill: '#ffffff', align: 'center' }).setDepth(10);
            // AI metric box.
            this.aiBox = this.add.rectangle(400, 70, 176, 48, 0x000000)
                .setStrokeStyle(2, 0x00ff00).setDepth(10);
            this.aiMetricText = this.add.text(400, 70, 'AI: 0', { font: 'bold 28px Arial', fill: '#00ff00' })
                .setOrigin(0.5).setDepth(11);
        }
        update() {
            const main = this.scene.get('MainScene');
            this.budgetText.setText(`Budget: $${Math.floor(main.budget)}`);
            this.gflopsText.setText(`G-Flops: ${Math.floor(main.computingPower)}`);
            this.electricityText.setText(`Electricity: ${main.electricityGenerated - main.electricityUsed} kW`);
            this.aiMetricText.setText(`AI: ${main.aiAbility.toFixed(2)}`);
        }
    }

    // Game configuration.
    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        scene: [BootScene, TitleScene, MainScene, HUDScene, NarrativeScene],
        pixelArt: true,
        backgroundColor: '#000000'
    };

    const game = new Phaser.Game(config);
}
