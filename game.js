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
            this.add.image(400, 300, 'desert_backdrop').setOrigin(0.5, 0.5);

            // Resources
            this.budget = 10000;
            this.electricityGenerated = 0;
            this.electricityUsed = 0;
            this.computingPower = 0;
            this.aiAbility = 0;
            this.heatLevel = 0;
            this.maxHeat = 50;
            this.offices = 0;
            this.servers = 0;

            this.buildings = {
                office: { cost: 2000, electricity: -10, computing: 0, sprite: 'office', tooltip: 'Required first. Allows 3 servers per office.' },
                server_rack: { cost: 1000, electricity: -5, computing: 10, heat: 10, sprite: 'server_rack', tooltip: 'Boosts computing power, uses power and generates heat.' },
                solar_panel: { cost: 500, electricity: 10, computing: 0, sprite: 'solar_panel', tooltip: 'Generates electricity to power servers.' },
                cooling_system: { cost: 1500, electricity: -5, heat: -15, sprite: 'cooling_system', tooltip: 'Reduces heat from servers.' }
            };

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
            this.powerBarOutline = this.add.rectangle(20, 300, 20, 200, 0xffffff);
            this.powerBarOutline.setOrigin(0, 0.5);
            this.powerBar = this.add.graphics();
            this.updatePowerBar();

            // Heat Bar
            this.heatBarOutline = this.add.rectangle(40, 300, 20, 200, 0xffffff);
            this.heatBarOutline.setOrigin(0, 0.5);
            this.heatBar = this.add.graphics();
            this.updateHeatBar();

            this.builtBuildings = [];

            this.time.addEvent({
                delay: 1000,
                callback: this.updateResources,
                callbackScope: this,
                loop: true
            });

            // Pop-up message
            this.popup = this.add.text(400, 300, '', { font: '20px Arial', fill: '#ffffff', backgroundColor: '#ff0000', padding: { x: 10, y: 10 } }).setOrigin(0.5).setVisible(false);

            this.scene.launch('HUDScene');
        }

        buyBuilding(type) {
            const buildingData = this.buildings[type];
            if (this.budget < buildingData.cost) {
                this.showPopup('Not enough budget!');
                return;
            }

            // Office-first rule
            if (type !== 'office' && this.offices === 0) {
                this.showPopup('Buy an office first!');
                return;
            }

            // Server limit per office
            if (type === 'server_rack' && this.servers >= this.offices * 3) {
                this.showPopup('Buy another office to add more servers! (3 per office)');
                return;
            }

            // Power check for servers and cooling
            const netElectricity = this.electricityGenerated - this.electricityUsed;
            if ((type === 'server_rack' || type === 'cooling_system' || type === 'office') && netElectricity + buildingData.electricity < 0) {
                this.showPopup('Not enough electricity! Buy more solar panels.');
                return;
            }

            // Heat check
            const newHeat = this.heatLevel + (buildingData.heat || 0);
            if (newHeat > this.maxHeat) {
                this.showPopup('Heat level too high! Buy a cooling system.');
                return;
            }

            // Purchase successful
            this.budget -= buildingData.cost;
            if (buildingData.electricity < 0) {
                this.electricityUsed += Math.abs(buildingData.electricity);
            } else {
                this.electricityGenerated += buildingData.electricity;
            }
            this.computingPower += buildingData.computing;
            this.heatLevel = Math.max(0, newHeat); // Prevent negative heat

            if (type === 'office') this.offices++;
            if (type === 'server_rack') this.servers++;

            const buildingWidth = 64;
            const startX = 266;
            const maxBuildings = Math.floor((533 - startX) / buildingWidth);
            const xPos = startX + (this.builtBuildings.length % maxBuildings) * buildingWidth;
            const yPos = 300;

            const building = this.add.sprite(xPos, yPos, buildingData.sprite).setScale(4);
            this.builtBuildings.push(building);

            this.updatePowerBar();
            this.updateHeatBar();
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
            this.updateHeatBar();
        }

        updatePowerBar() {
            const usagePercentage = Math.min(this.electricityUsed / this.maxElectricity, 1);
            const barHeight = Math.max(0, 200 * usagePercentage);
            const color = usagePercentage > 0.8 ? 0xff0000 : 0x00ff00;

            this.powerBar.clear();
            this.powerBar.fillStyle(color, 1);
            this.powerBar.fillRect(20, 300 - (barHeight / 2), 16, barHeight);
        }

        updateHeatBar() {
            const heatPercentage = Math.min(this.heatLevel / this.maxHeat, 1);
            const barHeight = Math.max(0, 200 * heatPercentage);
            const color = heatPercentage > 0.8 ? 0xff0000 : 0xffa500; // Orange for heat

            this.heatBar.clear();
            this.heatBar.fillStyle(color, 1);
            this.heatBar.fillRect(40, 300 - (barHeight / 2), 16, barHeight);
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

        showPopup(message) {
            this.popup.setText(message);
            this.popup.setVisible(true);
            this.time.delayedCall(2000, () => this.popup.setVisible(false), [], this); // Hide after 2 seconds
        }
    }

    class HUDScene extends Phaser.Scene {
        constructor() {
            super('HUDScene');
        }

        create() {
            this.budgetText = this.add.text(60, 10, 'Budget: $10000', { font: '24px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.computingText = this.add.text(60, 40, 'Computing Power: 0 units', { font: '24px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.electricityText = this.add.text(60, 70, 'Electricity: 0 kW', { font: '16px Arial', fill: '#cccccc' });
            this.aiText = this.add.text(60, 90, 'AI Ability: 0', { font: '16px Arial', fill: '#cccccc' });
            this.heatText = this.add.text(60, 110, 'Heat: 0', { font: '16px Arial', fill: '#cccccc' });
        }

        update() {
            const mainScene = this.scene.get('MainScene');
            this.budgetText.setText(`Budget: $${mainScene.budget.toFixed(0)}`);
            this.computingText.setText(`Computing Power: ${mainScene.computingPower.toFixed(0)} units`);
            this.electricityText.setText(`Electricity: ${mainScene.electricityGenerated - mainScene.electricityUsed} kW`);
            this.aiText.setText(`AI Ability: ${mainScene.aiAbility.toFixed(2)}`);
            this.heatText.setText(`Heat: ${mainScene.heatLevel.toFixed(0)}`);
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
