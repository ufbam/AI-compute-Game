if (typeof Phaser === 'undefined') {
    console.error('Phaser is not loaded. Check the script tag in index.html.');
} else {
    class BootScene extends Phaser.Scene {
        constructor() {
            super('BootScene');
        }

        preload() {
            this.load.image('desert_backdrop', 'assets/desert_backdrop.png');
            // Original 16x16 for desert
            this.load.image('office', 'assets/office.png');
            this.load.image('server_rack', 'assets/server_rack.png');
            this.load.image('solar_panel', 'assets/solar_panel.png');
            this.load.image('cooling_system', 'assets/cooling_system.png');
            // High-res 1024x1024 for shop
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
                office: { cost: 2000, electricity: -10, computing: 0, sprite: 'office', shopSprite: 'office_high', tooltip: 'Required first. Allows 3 servers per office.' },
                server_rack: { cost: 1000, electricity: -5, computing: 10, heat: 10, sprite: 'server_rack', shopSprite: 'server_rack_high', tooltip: 'Boosts computing power, uses power and generates heat.' },
                solar_panel: { cost: 500, electricity: 10, computing: 0, sprite: 'solar_panel', shopSprite: 'solar_panel_high', tooltip: 'Generates electricity to power servers.' },
                cooling_system: { cost: 1500, electricity: -5, heat: -15, sprite: 'cooling_system', shopSprite: 'cooling_system_high', tooltip: 'Reduces heat from servers.' }
            };

            const shopY = 530;
            const panel = this.add.rectangle(400, shopY + 50, 800, 140, 0x333333);
            panel.setOrigin(0.5, 0.5);
            this.shopHUD = this.add.group();

            // Center shop items horizontally
            const shopWidth = 600; // Total width of items (100 + 150 + 150 + 150 + 50 padding)
            const startX = 400 - (shopWidth / 2); // Center at x=400
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
                    .on('pointerout', () => this.hideTooltip());

                this.add.text(item.x, shopY + 40, item.type.replace('_', ' '), { font: '14px Arial', fill: '#ffffff' }).setOrigin(0.5);
                this.add.text(item.x, shopY + 60, `$${buildingData.cost}`, { font: '12px Arial', fill: '#ffff00' }).setOrigin(0.5);

                this.shopHUD.add(button);
            });

            // HUD Panel at Top (thinner, at y=0)
            const hudY = 0;
            const hudPanel = this.add.rectangle(400, hudY + 20, 800, 40, 0x333333);
            hudPanel.setOrigin(0.5, 0.5);

            // Power Bars (Left: Usage and Output)
            this.powerBarOutlineUsage = this.add.rectangle(20, 400, 20, 200, 0xffffff, 2); // Usage
            this.powerBarOutlineUsage.setOrigin(0, 1);
            this.powerBarUsage = this.add.graphics();
            this.add.text(20, 610, 'Usage', { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5); // Label at bottom

            this.powerBarOutlineOutput = this.add.rectangle(40, 400, 20, 200, 0xffffff, 2); // Output
            this.powerBarOutlineOutput.setOrigin(0, 1);
            this.powerBarOutput = this.add.graphics();
            this.add.text(40, 610, 'Output', { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5); // Label at bottom

            // Heat Bar (Right, x=760)
            this.heatBarOutline = this.add.rectangle(760, 400, 20, 200, 0xffffff, 2); // Thin stroke
            this.heatBarOutline.setOrigin(0, 1);
            this.heatBar = this.add.graphics();
            this.add.text(760, 610, 'Heat', { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5); // Label at bottom
            this.updatePowerBars();
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

            const groupWidth = 100;
            const baseX = 200;
            const officeY = 200; // Moved down
            const serverYBase = officeY + 32; // Adjusted for larger office
            const coolingY = 400;
            const solarY = 450; // Row at bottom

            if (type === 'office') {
                const groupX = baseX + (this.officeGroups.length * groupWidth);
                const office = this.add.sprite(groupX + 32, officeY, 'office').setScale(2); // Double size (32x32)
                this.builtBuildings.offices.push(office);
                this.officeGroups.push({ x: groupX, servers: [], cooling_systems: [] });
            } else if (type === 'server_rack') {
                const group = this.officeGroups[this.offices - 1];
                if (group.servers.length < 3) {
                    const yPos = serverYBase + (group.servers.length * 32);
                    const server = this.add.sprite(group.x + 32, yPos, 'server_rack').setScale(1);
                    group.servers.push(server);
                    this.builtBuildings.servers.push(server);
                }
            } else if (type === 'solar_panel') {
                const buildingWidth = 16; // Small size
                const startX = 266;
                const maxPanels = Math.floor((533 - startX) / buildingWidth);
                const xPos = startX + (this.builtBuildings.solar_panels.length % maxPanels) * buildingWidth;
                const solar = this.add.sprite(xPos, solarY, 'solar_panel').setScale(1);
                this.builtBuildings.solar_panels.push(solar);
                this.electricityGenerated += buildingData.electricity;
            } else if (type === 'cooling_system') {
                const group = this.officeGroups[this.offices - 1];
                const yPos = coolingY + (group.cooling_systems.length * 32);
                const cooling = this.add.sprite(group.x + 32, yPos, 'cooling_system').setScale(1);
                group.cooling_systems.push(cooling);
                this.builtBuildings.cooling_systems.push(cooling);
            }

            this.updatePowerBars();
            this.updateHeatBar();
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
        }

        updatePowerBars() {
            // Usage Bar
            const usagePercentage = Math.min(this.electricityUsed / this.maxElectricity, 1);
            const barHeight = Math.max(0, 200 * usagePercentage);
            const usageColor = usagePercentage > 0.8 ? 0xff0000 : 0x00ff00;

            this.powerBarUsage.clear();
            this.powerBarUsage.lineStyle(2, 0xffffff);
            this.powerBarUsage.fillStyle(usageColor, 1);
            this.powerBarUsage.fillRect(20, 400 - barHeight, 16, barHeight);
            this.powerBarUsage.strokeRect(20, 400 - barHeight, 16, barHeight);

            // Output Bar
            const outputPercentage = Math.min(this.electricityGenerated / this.maxElectricity, 1);
            const outputBarHeight = Math.max(0, 200 * outputPercentage);
            const outputColor = outputPercentage > 0.8 ? 0xff0000 : 0x00ff00;

            this.powerBarOutput.clear();
            this.powerBarOutput.lineStyle(2, 0xffffff);
            this.powerBarOutput.fillStyle(outputColor, 1);
            this.powerBarOutput.fillRect(40, 400 - outputBarHeight, 16, outputBarHeight);
            this.powerBarOutput.strokeRect(40, 400 - outputBarHeight, 16, outputBarHeight);
        }

        updateHeatBar() {
            const heatPercentage = Math.min(this.heatLevel / this.maxHeat, 1);
            const barHeight = Math.max(0, 200 * heatPercentage);
            const color = heatPercentage > 0.8 ? 0xff0000 : 0xffa500;

            this.heatBar.clear();
            this.heatBar.lineStyle(2, 0xffffff);
            this.heatBar.fillStyle(color, 1);
            this.heatBar.fillRect(760, 400 - barHeight, 16, barHeight);
            this.heatBar.strokeRect(760, 400 - barHeight, 16, barHeight);
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
            this.budgetText = this.add.text(20, 15, 'Budget: $10000', { font: '24px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.computingText = this.add.text(200, 15, 'Computing: 0 units', { font: '24px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.electricityText = this.add.text(400, 15, 'Electricity: 0 kW', { font: '24px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.aiText = this.add.text(600, 15, 'AI: 0', { font: '24px Arial', fill: '#ffffff', fontStyle: 'bold' });
            this.heatText = this.add.text(740, 15, 'Heat: 0', { font: '24px Arial', fill: '#ffffff', fontStyle: 'bold' });
        }

        update() {
            const mainScene = this.scene.get('MainScene');
            this.budgetText.setText(`Budget: $${Math.floor(mainScene.budget)}`);
            this.computingText.setText(`Computing: ${Math.floor(mainScene.computingPower)} units`);
            this.electricityText.setText(`Electricity: ${mainScene.electricityGenerated - mainScene.electricityUsed} kW`);
            this.aiText.setText(`AI: ${mainScene.aiAbility.toFixed(2)}`);
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
