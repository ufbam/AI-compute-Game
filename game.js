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

            this.powerBarOutline = this.add.rectangle(20, 400, 20, 200, 0xffffff);
            this.powerBarOutline.setOrigin(0, 1);
            this.powerBar = this.add.graphics();
            this.add.text(20, 190, 'Power', { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5);
            this.updatePowerBar();

            this.heatBarOutline = this.add.rectangle(780, 400, 20, 200, 0xffffff);
            this.heatBarOutline.setOrigin(0, 1);
            this.heatBar = this.add.graphics();
            this.add.text(780, 190, 'Heat', { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5);
            this.updateHeatBar();

            this.builtBuildings = { offices: [], servers: [], solar_panels: [], cooling_systems: [] };
            this.officeGroups = [];

            this.time.addEvent({
                delay: 1000,
                callback: this.updateResources,
                callbackScope: this,
                loop: true
            });

            this.popup = this.add.text(400, 300, '', { font: '20px Arial', fill: '#ffffff', backgroundColor: '#ff0000', padding: { x: 10, y: 10 } }).setOrigin(0.5).setVisible(false);

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

            // Layout in groups
            const groupWidth = 100; // Space per group
            const baseX = 200; // Start groups left of center
            const officeY = 150; // Top of group
            const scale = 1; // Quarter of shop size (4 -> 1)

            if (type === 'office') {
                const groupX = baseX + (this.officeGroups.length * groupWidth);
                const office = this.add.sprite(groupX + 32, officeY, 'office').setScale(scale);
                this.builtBuildings.offices.push(office);
                this.officeGroups.push({ x: groupX, servers: [], solar_panels: [], cooling_systems: [] });
            } else {
                const group = this.officeGroups[this.offices - 1]; // Latest office group
                if (type === 'server_rack' && group.servers.length < 3) {
                    const yPos = officeY + 32 + (group.servers.length * 32);
                    const server = this.add.sprite(group.x + 32, yPos, 'server_rack').setScale(scale);
                    group.servers.push(server);
                    this.builtBuildings.servers.push(server);
                } else if (type === 'solar_panel') {
                    const yPos = officeY + 128 + (group.solar_panels.length * 32);
                    const solar = this.add.sprite(group.x + 32, yPos, 'solar_panel').setScale(scale);
                    group.solar_panels.push(solar);
                    this.builtBuildings.solar_panels.push(solar);
                } else if (type === 'cooling_system') {
                    const yPos = officeY + 192 + (group.cooling_systems.length * 32);
                    const cooling = this.add.sprite(group.x + 32, yPos, 'cooling_system').setScale(scale);
                    group.cooling_systems.push(cooling);
                    this.builtBuildings.cooling_systems.push(cooling);
                }
            }

            this.updatePowerBar();
            this.updateHeatBar();
        }

        updateResources() {
            this.budget += Math.min(this.aiAbility * 10, 10000); // Cap income to prevent overflow
            this.aiAbility = Math.min(this.aiAbility + (this.computingPower * 0.01), 1000); // Cap AI ability
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
            this.powerBar.fillRect(20, 400 - barHeight, 16, barHeight);
        }

        updateHeatBar() {
            const heatPercentage = Math.min(this.heatLevel / this.maxHeat, 1);
            const barHeight = Math.max(0, 200 * heatPercentage);
            const color = heatPercentage > 0.8 ? 0xff0000 : 0xffa500;

            this.heatBar.clear();
            this.heatBar.fillStyle(color, 1);
            this.heatBar.fillRect(780, 400 - barHeight, 16, barHeight);
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
            this.time.delayedCall(2000, () => this.popup.setVisible(false), [], this);
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
            this.budgetText.setText(`Budget: $${Math.floor(mainScene.budget)}`);
            this.computingText.setText(`Computing Power: ${Math.floor(mainScene.computingPower)} units`);
            this.electricityText.setText(`Electricity: ${mainScene.electricityGenerated - mainScene.electricityUsed} kW`);
            this.aiText.setText(`AI Ability: ${mainScene.aiAbility.toFixed(2)}`);
            this.heatText.setText(`Heat: ${Math.floor(mainScene.heatLevel)}`);
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
