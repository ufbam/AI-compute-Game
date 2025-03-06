if (typeof Phaser === 'undefined') {
    console.error('Phaser is not loaded. Check the script tag in index.html.');
} else {
    // Narrative popup scene.
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
            // OK button moved up to y = 460.
            this.add.text(400, 460, 'OK', {
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

    // Boot scene for preloading assets.
    class BootScene extends Phaser.Scene {
        constructor() {
            super('BootScene');
        }
        preload() {
            // Background & shop icons.
            this.load.image('desert_backdrop', 'assets/desert_backdrop.png');
            this.load.image('office_high', 'assets/office_high.png');
            this.load.image('server_rack_high', 'assets/server_rack_high.png'); // used for shop icon (server farm)
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

    // Main gameplay scene.
    class MainScene extends Phaser.Scene {
        constructor() {
            super('MainScene');
        }
        create() {
            // Draw the desert backdrop as the base.
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
            this.barMaxElectricity = 400;
            this.barMaxHeat = 100;

            this.offices = 0;
            this.servers = 0;

            // Training run flags.
            this.trainingRunActive = false;
            this.trainingExtraLoad = 0; // Extra load during training run.
            // Track the last AI milestone triggered.
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
            // Shop background.
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
            this.powerBarOutlineUsage = this.add.rectangle(20, 520, 20, 200, 0xffffff, 0)
                .setOrigin(0, 1)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(10);
            this.add.text(30, 535, 'Usage', { font: '16px Arial', fill: '#ffffff' })
                .setOrigin(0.5).setDepth(10);

            this.powerBarOutlineOutput = this.add.rectangle(40, 520, 20, 200, 0xffffff, 0)
                .setOrigin(0, 1)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(10);
            this.add.text(30, 555, 'Output', { font: '16px Arial', fill: '#ffffff' })
                .setOrigin(0.5).setDepth(10);

            this.heatBarOutline = this.add.rectangle(760, 520, 20, 200, 0xffffff, 0)
                .setOrigin(0, 1)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(10);
            this.add.text(760, 540, 'Heat', { font: '16px Arial', fill: '#ffffff' })
                .setOrigin(0.5).setDepth(10);

            this.powerBarUsage = this.add.graphics().setDepth(10);
            this.powerBarOutput = this.add.graphics().setDepth(10);
            this.heatBar = this.add.graphics().setDepth(10);

            // Update resources every second.
            this.time.addEvent({
                delay: 1000,
                callback: this.updateResources,
                callbackScope: this,
                loop: true
            });

            // Arrays to hold asset images.
            this.officeImages = [];
            this.serverFarmImages = [];
            this.solarPanels = [];
            this.coolingImages = [];

            // Helper method to update layers gradually for server_farm, solar_panel, and cooling_system.
            // (Offices appear instantly.)
            this.updateLayer = (buildingType, assetPrefix, maxLayers, layerArray) => {
                const count = this.buildingCounts[buildingType];
                const layerIndex = Math.floor((count - 1) / 3);
                const stage = (count - 1) % 3;
                const desiredAlpha = (stage + 1) / 3; // 0.33, 0.66, or 1.
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

            // Create the "Initiate Training Run" button, initially hidden.
            this.trainingButton = this.add.text(700, 60, 'Initiate Training Run', {
                font: '16px Arial',
                fill: '#00ff00',
                backgroundColor: '#000000',
                padding: { x: 10, y: 5 }
            }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
            this.trainingButton.visible = false;
            this.trainingButton.on('pointerdown', () => {
                this.initiateTrainingRun();
            });

            // Show the opening narrative (more instructional and witty).
            this.showNarrative("Welcome to your AI venture! Build offices, server farms, solar panels, and cooling systems to increase your GFlops and boost your AI level. The higher your GFlops, the faster your AI learns. Use training runs to accelerate progress when surplus power allows. Now, get to work!");

            // Initialize last AI milestone.
            this.lastAIMilestone = 0;

            this.scene.launch('HUDScene');
        }

        // Helper method to generate random gibberish.
        getRandomGibberish() {
            const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
            let result = "";
            const len = 30;
            for (let i = 0; i < len; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }

        // Returns a narrative message based on the AI milestone.
        getAINarrative(milestone) {
            if (milestone === 10) {
                return "At level 10, your first chatbot debuts with a cheeky knack for conversation.";
            } else if (milestone === 20) {
                return "At level 20, government offices begin outsourcing their paperwork to your AI.";
            } else if (milestone === 30) {
                return "At level 30, your AI starts producing catchy slogans that get everyone talking.";
            } else if (milestone === 40) {
                return "At level 40, humanoid robots showcase your AI's clever insights on every corner.";
            } else if (milestone === 50) {
                return "At level 50, whispers spread that your AI might soon rival human wit.";
            } else if (milestone >= 60 && milestone <= 100) {
                // For milestones 60,70,80,90,100, generate random gibberish.
                return "At level " + milestone + ", your AI declares: " + this.getRandomGibberish();
            } else if (milestone > 100) {
                return "Your AI is too lazy to write anything new.";
            } else {
                return "";
            }
        }

        // Method to initiate a training run.
        initiateTrainingRun() {
            if (this.trainingRunActive) {
                this.showPopup("Training run already in progress!");
                return;
            }
            if ((this.electricityGenerated - this.electricityUsed) < 10) {
                this.showPopup("Not enough surplus power for training run!");
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
                this.aiAbility = Math.min(this.aiAbility + (this.computingPower * 0.01), 1000);
            }
            // Check if a new AI milestone is reached.
            let milestone = Math.floor(this.aiAbility / 10) * 10;
            if (milestone > this.lastAIMilestone) {
                this.lastAIMilestone = milestone;
                let narrative = this.getAINarrative(milestone);
                if (narrative) {
                    this.showNarrative(narrative);
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

            // When the first server farm is built, reveal the training run button.
            if (type === 'server_farm' && this.buildingCounts.server_farm === 1) {
                this.trainingButton.visible = true;
                this.showNarrative("Great job on building your first server! If you have surplus power, you can now 'Initiate Training Run' to boost your AI and income.");
            }

            this.updateBars();
        }

        updateBars() {
            const effectiveUsage = this.electricityUsed + (this.trainingRunActive ? this.trainingExtraLoad : 0);
            const usageHeight = Math.min(effectiveUsage / this.barMaxElectricity, 1) * 200;
            this.powerBarUsage.clear();
            this.powerBarUsage.fillStyle(usageHeight > 160 ? 0xff0000 : 0x00ff00, 1);
            this.powerBarUsage.fillRect(20, 520 - usageHeight, 16, usageHeight);

            const outputHeight = Math.min(this.electricityGenerated / this.barMaxElectricity, 1) * 200;
            this.powerBarOutput.clear();
            this.powerBarOutput.fillStyle(outputHeight > 160 ? 0xff0000 : 0x00ff00, 1);
            this.powerBarOutput.fillRect(40, 520 - outputHeight, 16, outputHeight);

            const heatHeight = Math.min(this.heatLevel / this.maxHeat, 1) * 200;
            this.heatBar.clear();
            this.heatBar.fillStyle(heatHeight > 160 ? 0xff0000 : 0xffa500, 1);
            this.heatBar.fillRect(760, 520 - heatHeight, 16, heatHeight);
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
            const popup = this.add.text(400, 480, message, {
                font: '20px Arial',
                fill: '#ffffff',
                backgroundColor: '#ff0000',
                padding: { x: 10, y: 10 }
            }).setOrigin(0.5).setDepth(10);
            this.time.delayedCall(2000, () => popup.destroy());
        }
    }

    // HUD scene for displaying resource information.
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

    // Game configuration.
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
