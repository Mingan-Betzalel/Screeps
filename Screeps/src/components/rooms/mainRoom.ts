﻿import {MyRoom} from "./myRoom";
import {MySource} from "../sources/mySource";
import {SpawnManager} from "./spawnManager";
import {Colony} from "../../colony/colony";
/// <reference path='./src/objectWithMemory.ts' />
//import {ObjectWithMemory} from "../../objectWithMemory";


import {MyTower} from "../structures/myTower";
import {ConstructionManager} from "./constructionManager";
import {UpgradeManager} from "./upgradeManager";
import {RepairManager} from "./repairManager";
import {HarvestingManager} from "./harvestingManager";
import {SpawnFillManager} from "./spawnFillManager";
import {DefenseManager} from "./defenseManager";
import {ReservationManager} from "./reservationManager";
import {RoadConstructionManager} from "./roadConstructionManager";

export class MainRoom {

    public get memory(): MainRoomMemory {
        return this.accessMemory();
    }

    accessMemory() {
        if (Colony.memory.mainRooms == null)
            Colony.memory.mainRooms = {};
        if (Colony.memory.mainRooms[this.name] == null)
            Colony.memory.mainRooms[this.name] = {
                name: this.name,
                mainPosition: null,
                spawnManager: null,
                constructionManager: null,
                repairManager: null,
                upgradeManager: null,
                spawnFillManager: null,
                harvestingManager: null,
                defenseManager: null,
                reservationManager: null,
                roadConstructionManager: null
            };
        return Colony.memory.mainRooms[this.name];
    }

    name: string;
    myRoom: MyRoom;
    room: Room;
    connectedRooms: Array<MyRoom>;
    allRooms: Array<MyRoom>;
    mainContainer: Container | Storage;
    mainPosition: RoomPosition; //Usually location of the first spawn
    spawnManager: SpawnManager;
    roadConstructionManager: RoadConstructionManager;
    extensionCount: number;
    maxSpawnEnergy: number;
    creeps: Array<Creep>;

    spawnNames: Array<string>;

    sources: {
        [id: string]: MySource;
    };


    creepManagers: {
        constructionManager: ConstructionManager,
        repairManager: RepairManager,
        upgradeManager: UpgradeManager,
        spawnFillManager: SpawnFillManager,
        harvestingManager: HarvestingManager,
        defenseManager: DefenseManager,
        reservationManager: ReservationManager,
    }



    constructor(roomName: string) {
        this.name = roomName;
        this.myRoom = Colony.getRoom(roomName);
        this.myRoom.mainRoom = this;
        this.myRoom.memory.mainRoomName = this.name;
        if (this.myRoom.memory.mainRoomDistanceDescriptions == null)
            this.myRoom.memory.mainRoomDistanceDescriptions = {};
        this.myRoom.memory.mainRoomDistanceDescriptions[this.name] = { roomName: this.name, distance: 0 };
        this.room = Game.rooms[roomName];

        this.spawnNames = _.map(_.filter(Game.spawns, (s) => s.room.name == roomName), (s) => s.name);

        if (this.memory.mainPosition) {
            let pos = this.memory.mainPosition;
            this.mainPosition = new RoomPosition(pos.x, pos.y, roomName);
        }
        else {
            this.memory.mainPosition = this.mainPosition = Game.spawns[this.spawnNames[0]].pos;
        }
        this.update(true);

        //if (!this.memory.spawnManager) this.memory.spawnManager = {  }
        //if (!this.memory.constructionManager) this.memory.constructionManager = {}
        //if (!this.memory.repairManager) this.memory.repairManager = { emergencyTargets: {}, repairTargets: {} }
        //if (!this.memory.upgradeManager) this.memory.upgradeManager = {}
        //if (!this.memory.spawnFillManager) this.memory.spawnFillManager = {}
        //if (!this.memory.harvestingManager) this.memory.harvestingManager = {}
        //if (!this.memory.defenseManager) this.memory.defenseManager = {}
        //if (!this.memory.reservationManager) this.memory.reservationManager = {}

        this.spawnManager = new SpawnManager(this, this.memory.spawnManager);
        this.creepManagers = {

            constructionManager: new ConstructionManager(this),
            repairManager: new RepairManager(this),
            upgradeManager: new UpgradeManager(this),
            spawnFillManager: new SpawnFillManager(this),
            harvestingManager: new HarvestingManager(this),
            defenseManager: new DefenseManager(this),
            reservationManager: new ReservationManager(this)
        }

        if (!this.memory.roadConstructionManager)
            this.memory.roadConstructionManager = null;
        this.roadConstructionManager = new RoadConstructionManager(this);
    }

    getMaxSpawnEnergy(): number {
        let maxSpawnEnergy = 0;

        this.extensionCount = this.room.find(FIND_MY_STRUCTURES, { filter: (s: Structure) => s.structureType == STRUCTURE_EXTENSION }).length;
        if (this.extensionCount > CONTROLLER_STRUCTURES.extension[this.room.controller.level])
            this.extensionCount = CONTROLLER_STRUCTURES.extension[this.room.controller.level];

        if (this.room.controller.level == 8)
            maxSpawnEnergy = this.extensionCount * 200;
        else if (this.room.controller.level == 7)
            maxSpawnEnergy = this.extensionCount * 100;
        else maxSpawnEnergy = this.extensionCount * 50;

        maxSpawnEnergy += 300;

        if (this.creeps.length == 0 || !this.mainContainer || this.mainContainer.store.energy == 0)
            maxSpawnEnergy = Math.max(this.room.energyAvailable, 300);

        return maxSpawnEnergy;
    }

    getAllSources() {
        var sources = this.myRoom.sources;
        for (var roomIdx in _.filter(this.connectedRooms, x => x.canHarvest))
            for (var sourceIdx in this.connectedRooms[roomIdx].sources)
                sources[this.connectedRooms[roomIdx].sources[sourceIdx].id] = this.connectedRooms[roomIdx].sources[sourceIdx];
        return sources;
    }

    update(runAll = true) {
        this.creeps = _.filter(Game.creeps, (c) => (<CreepMemory>c.memory).mainRoomName == this.name && !(<CreepMemory>c.memory).handledByColony);
        if (runAll || (Game.time % 100) == 0) {
            this.maxSpawnEnergy = this.getMaxSpawnEnergy();

            this.connectedRooms = _.filter(Colony.rooms, (r) => r.name != this.room.name && r.mainRoom == this);

            this.allRooms = this.connectedRooms.concat(this.myRoom);
        }

        this.sources = this.getAllSources();
        //this.sources = _this.myRoom.sources.concat(_.flatten(_.map(this.connectedRooms, (r) => _.values<MySource>(r.sources))));
        //this.sources = _.values<MySource>(this.myRoom.sources).concat(_.flatten(_.map(this.connectedRooms, (r) => _.values<MySource>(r.sources))));
    }

    placeExtensions() {
        if (Game.time % 100 != 0)
            return;
        var maxExtensions = CONTROLLER_STRUCTURES.extension[this.room.controller.level];

        for (var i = maxExtensions - 1; i >= 0; i--) {
            var idiv5 = ~~(i / 5);
            var x = Math.ceil(idiv5 / 2);
            if (idiv5 % 2 == 1)
                x = -x;
            x += this.mainPosition.x;
            var y = this.mainPosition.y + 3 + (i % 5) * 2;//-(~~(i/5)%2)

            if ((idiv5 + 3) % 4 > 1)
                y--;

            var targetPos = new RoomPosition(x, y, this.name);
            if (targetPos.createConstructionSite(STRUCTURE_EXTENSION) == ERR_RCL_NOT_ENOUGH)
                break;
        }

    }

    placeMainContainer() {
        if (Memory['verbose'])
            console.log('SpawnRoomHandler.placeMainContainer');
        let closestSource = this.mainPosition.findClosestByPath<Source>(FIND_SOURCES);

        let targetPos: RoomPosition = null;
        if (!closestSource)
            targetPos = new RoomPosition(this.mainPosition.x + 4, this.mainPosition.y + 4, this.name);
        else {
            targetPos = new RoomPosition(this.mainPosition.x, this.mainPosition.y, this.name);
            let direction = this.mainPosition.getDirectionTo(closestSource);
            switch (direction) {
                case TOP:
                    targetPos.y -= 4;
                    break;
                case TOP_RIGHT:
                    targetPos.y -= 4;
                    targetPos.x += 4;
                    break;
                case RIGHT:
                    targetPos.x += 4;
                    break;
                case BOTTOM_RIGHT:
                    targetPos.y += 4;
                    targetPos.x += 4;
                    break;
                case BOTTOM:
                    targetPos.y += 4;
                    break;
                case BOTTOM_LEFT:
                    targetPos.y += 4;
                    targetPos.x -= 4;
                    break;
                case LEFT:
                    targetPos.x -= 4;
                    break;
                case TOP_LEFT:
                    targetPos.y += 4;
                    break;
            }
        }

        targetPos.createConstructionSite(STRUCTURE_CONTAINER);
    }

    placeStorage() {
        if (Memory['verbose'])
            console.log('SpawnRoomHandler.placeStorage');

        let closestSource = this.mainPosition.findClosestByPath<Source>(FIND_SOURCES);
        let targetPos: RoomPosition = null;
        if (!closestSource)
            targetPos = new RoomPosition(this.mainPosition.x + 2, this.mainPosition.y + 2, this.name);
        else {
            targetPos = new RoomPosition(this.mainPosition.x, this.mainPosition.y, this.name);
            let direction = this.mainPosition.getDirectionTo(closestSource);
            switch (direction) {
                case TOP:
                    targetPos.y -= 2;
                    break;
                case TOP_RIGHT:
                    targetPos.y -= 2;
                    targetPos.x += 2;
                    break;
                case RIGHT:
                    targetPos.x += 2;
                    break;
                case BOTTOM_RIGHT:
                    targetPos.y += 2;
                    targetPos.x += 2;
                    break;
                case BOTTOM:
                    targetPos.y += 2;
                    break;
                case BOTTOM_LEFT:
                    targetPos.y += 2;
                    targetPos.x -= 2;
                    break;
                case LEFT:
                    targetPos.x -= 2;
                    break;
                case TOP_LEFT:
                    targetPos.y += 2;
                    break;
            }
        }
        targetPos.createConstructionSite(STRUCTURE_STORAGE);
    }

    checkAndPlaceMainContainer() {
        if (this.mainContainer == null) {
            let candidates = this.mainPosition.findInRange<Container>(FIND_STRUCTURES, 4, {
                filter: (s: Structure) => s.structureType == STRUCTURE_CONTAINER
            });

            if (candidates.length > 0) {
                this.mainContainer = candidates[0];
            } else {
                let constructionCandidates = this.mainPosition.findInRange<ConstructionSite>(FIND_CONSTRUCTION_SITES, 4, {
                    filter: (s: Structure) => s.structureType == STRUCTURE_CONTAINER
                });

                if (constructionCandidates.length == 0) {
                    this.placeMainContainer();
                }
            }
        }
    }



    checkAndPlaceStorage() {
        let storage = this.room.storage;
        if (storage != null) {
            this.mainContainer = storage;
        }
        else if (CONTROLLER_STRUCTURES.storage[this.room.controller.level] > 0) {
            this.placeStorage();
        }
        else {
            this.checkAndPlaceMainContainer();
        }
    }

    checkCreeps() {
        var startCpu;
        var endCpu;
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.spawnFillManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('SpawnFillManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.defenseManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('DefenseManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.harvestingManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('HarvestingManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }

        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.reservationManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('ReservationManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.repairManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('RepairManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.constructionManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('ConstructionManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.upgradeManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('UpgradeManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
        


    }

    tickCreeps() {
        var startCpu;
        var endCpu;
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.spawnFillManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('SpawnFillManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.harvestingManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('HarvestingManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.repairManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('RepairManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.constructionManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('ConstructionManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.upgradeManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('UpgradeManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.defenseManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('DefenseManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.reservationManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('ReservationManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
    }

    public tick() {
        //console.log('Memory Test= ' + JSON.stringify(Memory['colony']['rooms']['E21S22']['test']));

        var startCpu;
        var endCpu;

        if (Memory['verbose'])
            console.log('SpawnRoomHandler.tick');

        if (this.room == null)
            return;
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.update();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('MainRoom.update: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.checkAndPlaceStorage();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('MainRoom.checAndPlaceStorage: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.placeExtensions();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('MainRoom.placeExtensions: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        if (this.mainContainer)
            this.creepManagers.harvestingManager.placeSourceContainers();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('HarvestingManager.placeSourceContainers: ' + (endCpu - startCpu).toFixed(2));
        }

        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        if (this.mainContainer)
            this.roadConstructionManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('RoadConstructionManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }


        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.allRooms.forEach(r => r.scanForHostiles());
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('MainRoom.scanForHostiles: ' + (endCpu - startCpu).toFixed(2));
        }
        if (this.creeps.length > 0)
            this.checkCreeps();
        else
            this.creepManagers.harvestingManager.checkCreeps();

        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.spawnManager.spawn();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('MainRoom.spawnManager.spawn: ' + (endCpu - startCpu).toFixed(2));
        }

        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.room.find<Tower>(FIND_MY_STRUCTURES, { filter: (x: Structure) => x.structureType == STRUCTURE_TOWER }).forEach(x => new MyTower(x, this).tick());
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('Tower.tick: ' + (endCpu - startCpu).toFixed(2));
        }

        this.tickCreeps();

        if (Game.time % 100 == 0)
            for (let idx in this.allRooms) {
                let myRoom = this.allRooms[idx];
                myRoom.scan();
            }
    }
}