if (typeof Phaser === 'undefined') {
    console.error('Phaser is not loaded. Check the script tag in index.html.');
} else {
    class BootScene extends Phaser.Scene {
        constructor() {
            super('BootScene');
        }

        preload() {
            this.load.image('desert_backdrop', 'assets/desert_backdrop.png');
            this.load.image('office', 'assets/office.png');
            this.load.image('server_rack', 'assets/server_rack.png');
            this.load.image('solar_panel', 'assets/solar_panel.png');
            this.load.image('cooling_system', 'assets/cooling_system.png');
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
            // Desert backdrop
            this.add.image(400, 300, 'desert_backdrop').setOrigin(0.5, 0.5);

            // Resources
            this.budget = 10000;
            this.electricityGenerated = 0;
            this.electricityUsed = 0;
            this.computingPower = 0;
            this.aiAbility = 0;

            // Building definitions
            this.buildings = {
                office: { cost: 2000, electricity: -10, computing: 0, sprite: 'office', tooltip: 'Base of operations, enables staff hires.' },
                server_rack: { cost: 1000, electricity: -5, computing: 10, sprite: 'server_rack', tooltip: 'Increases computing power for AI training.' },
                solar_panel: { cost: 500, electricity: 10, computing: 0, sprite: 'solar_panel', tooltip: 'Generates electricity to power your farm.' },
                cooling_system: { cost: 1500, electricity: -5, computing: 0, sprite: 'cooling_system', tooltip: 'Reduces electricity use of nearby buildings.' }
            };

            // Shop HUD Panel
            const shopY = 530;
            const panel = this.add.rectangle(400, shopY + 50, 800, 140, 0x333333);
            panel.setOrigin(0.5, 0.5);
            this.shopHUD = this.add.group();

            const shopItems = [
                { type: 'office', x: 100 },
                { type: 'server_rack', x: 250 },
                { type: 'solar_panel', x: 400 },
                { type: 'cooling_system', x: 550 }
            ];

            shopItems.forEach(item => {
                const buildingData = this.buildings[item.type];
                const button = this.add.sprite(item.x, shopY, buildingData.sprite)
                    .setScale(4)
                    .setInteractive({ useHandCursor: true })
                    .on('pointerdown', () => this.buyBuilding(item.type))
                    .on('pointerover', () => this.showTooltip(item.x, shopY - 80, buildingData.tooltip))
                    .on('pointerout', () => this.hideTooltip());

                this.add.text(item.x, shopY + 40, item.type.replace('_', ' '), { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5);
                this.add.text(item.x, shopY + 60, `$${buildingData.cost}`, { font: '14px Arial', fill: '#ffff00' }).setOrigin(0.5);

                this.shopHUD.add(button);
            });

            // Power Usage Bar
            this.maxElectricity = 50;
            this.powerBarOutline = this.add.rectangle(20, 300, 20, 200, 0xffffff); // Outline
            this.powerBarOutline.setOrigin(0, 0.5);
            this.powerBar = this.add.rectangle(20, 300, 16, 0, 0x00ff00); // Fill (starts at 0 height)
            this.powerBar.setOrigin(0, 0.5);

            // Track built buildings
            this.builtBuildings = [];

            this.time.addEvent({
                delay: 1000,
                callback: this.updateResources,
                callbackScope: this,
                loop: true
            });

            this.scene.launch('HUDScene');
        }

        buyBuilding(type) {
            const buildingData = this.buildings[type];
            if (this.budget < buildingData.cost) {
                console.log('Not enough budget!');
                return;
            }

            this.budget -= buildingData.cost;
            if (buildingData.electricity < 0) {
                this.electricityUsed += Math.abs(buildingData.electricity);
            } else {
                this.electricityGenerated += buildingData.electricity;
            }
            this.computingPower += buildingData.computing;

            // Place building in middle third strip (x: 266-533)
            const buildingWidth = 64;
            const startX = 266;
            const maxBuildings = Math.floor((533 - startX) / buildingWidth);
            const xPos = startX + (this.builtBuildings.length % maxBuildings) * buildingWidth;
            const yPos = 300;

            const building = this.add.sprite(xPos, yPos, buildingData.sprite).setScale(4);
            this.builtBuildings.push(building);

            this.updatePowerBar();
        }

        updateResources() {
            this.budget += this.aiAbility * 10;
            this.aiAbility += this.computingPower * 0.01;
            if (this.aiAbility > 50) {
                const chance = (this.aiAbility - 50) / 100;
                if (Math.random() < chance) {
                    this.triggerSentience();
                }
            }
            this.updatePowerBar();
        }

        updatePowerBar() {
            const usagePercentage = Math.min(this.electricityUsed / this.maxElectricity, 1);
            const barHeight = Math.max(0, 200 * usagePercentage); // Ensure non-negative
            this.powerBar.displayHeight = barHeight; // Use displayHeight to scale visually
            this.powerBar.y = 300 - (barHeight / 2); // Grow upward from center
            this.powerBar.fillColor = usagePercentage > 0.8 ? 0xff0000 : 0x00ff00;
        }

        triggerSentience() {
            console.log('AI has become sentient! Game effects to be implemented.');
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
    }

    class HUDScene extends Phaser.Scene {
        constructor() {
            super('HUDScene');
        }

        create() {
            this.budgetText = this.add.text(40, 10, 'Budget: $10000', { font: '24px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.computingText = this.add.text(40, 40, 'Computing Power: 0 units', { font: '24px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.electricityText = this.add.text(40, 70, 'Electricity: 0 kW', { font: '16px Arial', fill: '#cccccc' });
            this.aiText = this.add.text(40, 90, 'AI Ability: 0', { font: '16px Arial', fill: '#cccccc' });
        }

        update() {
            const mainScene = this.scene.get('MainScene');
            this.budgetText.setText(`Budget: $${mainScene.budget.toFixed(0)}`);
            this.computingText.setText(`Computing Power: ${mainScene.computingPower.toFixed(0)} units`);
            this.electricityText.setText(`Electricity: ${mainScene.electricityGenerated - mainScene.electricityUsed} kW`);
            this.aiText.setText(`AI Ability: ${mainScene.aiAbility.toFixed(2)}`);
        }
    }

    const config = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        scene: [BootScene, MainScene, HUDScene],
        pixelArt: true,
        backgroundColor: '#000000'
    };

    const game = new Phaser.Game(config);
}
