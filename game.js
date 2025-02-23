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

            // Power Bar (Left)
            this.powerBarOutline = this.add.rectangle(20, 400, 20, 200, 0xffffff);
            this.powerBarOutline.setOrigin(0, 1); // Anchor at bottom
            this.powerBar = this.add.graphics();
            this.add.text(20, 190, 'Power', { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5);
            this.updatePowerBar();

            // Heat Bar (Right)
            this.heatBarOutline = this.add.rectangle(780, 400, 20, 200, 0xffffff);
            this.heatBarOutline.setOrigin(0, 1); // Anchor at bottom
            this.heatBar = this.add.graphics();
            this.add.text(780, 190, 'Heat', { font: '16px Arial', fill: '#ffffff' }).setOrigin(0.5);
            this.updateHeatBar();

            this.builtBuildings = [];

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

            // Power check (skip for first office)
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
            this.computingPower += buildingData.computing;
            this.heatLevel = Math.max(0, newHeat);

            if (type === 'office') this.offices++;
            if (type === 'server_rack') this.servers++;

            const buildingWidth = 64;
            const startX = 266;
            const maxBuildings = Math.floor((533 - startX) / buildingWidth);
            const xPos = startX + (this.builtBuildings.length % maxBuildings) * buildingWidth;
            const yPos = 300;

            const building = this.add.sprite
