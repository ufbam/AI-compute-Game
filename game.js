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
            this.electricity = 0;
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
            const shopY = 480;
            const panel = this.add.rectangle(400, shopY + 60, 800, 150, 0x333333); // Gray panel
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

                // Labels and costs on the panel
                this.add.text(item.x, shopY + 40, item.type.replace('_', ' '), { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5);
                this.add.text(item.x, shopY + 60, `$${buildingData.cost}`, { font: '14px Arial', fill: '#ffff00' }).setOrigin(0.5);

                this.shopHUD.add(button);
            });

            // Track built buildings
            this.builtBuildings = [];
            this.nextPositionIndex = 0;

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

            // Deduct cost and update resources
            this.budget -= buildingData.cost;
            this.electricity += buildingData.electricity;
            this.computingPower += buildingData.computing;

            // Place building in the desert center
            const positions = [
                { x: 350, y: 250 }, { x: 450, y: 250 }, // Row 1
                { x: 300, y: 350 }, { x: 400, y: 350 }, { x: 500, y: 350 }, // Row 2
                { x: 350, y: 450 }, { x: 450, y: 450 }  // Row 3
            ];

            const pos = positions[this.nextPositionIndex % positions.length];
            const building = this.add.sprite(pos.x, pos.y, buildingData.sprite).setScale(4);
            this.builtBuildings.push(building);
            this.nextPositionIndex++;

            console.log(`Bought ${type} at (${pos.x}, ${pos.y})`);
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
            this.budgetText = this.add.text(10, 10, 'Budget: $10000', { font: '24px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.computingText = this.add.text(10, 40, 'Computing Power: 0 units', { font: '24px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.electricityText = this.add.text(10, 70, 'Electricity: 0 kW', { font: '16px Arial', fill: '#cccccc' });
            this.aiText = this.add.text(10, 90, 'AI Ability: 0', { font: '16px Arial', fill: '#cccccc' });
        }

        update() {
            const mainScene = this.scene.get('MainScene');
            this.budgetText.setText(`Budget: $${mainScene.budget.toFixed(0)}`);
            this.computingText.setText(`Computing Power: ${mainScene.computingPower.toFixed(0)} units`);
            this.electricityText.setText(`Electricity: ${mainScene.electricity.toFixed(0)} kW`);
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
