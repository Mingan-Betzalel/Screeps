﻿import {Colony} from "./colony";
import {MyRoom} from "../components/rooms/myRoom";
import {MySource} from "../components/sources/mySource";
import {MainRoom} from "../components/rooms/mainRoom";
//import {MySource} from "../components/sources/mySource";


export class ClaimingManager {

    public get memory(): ClaimingManagerMemory {
        return this.accessMemory();
    }

    accessMemory() {
        if (Colony.memory.claimingManagers == null)
            Colony.memory.claimingManagers = {};
        if (Colony.memory.claimingManagers[this.roomName] == null)
            Colony.memory.claimingManagers[this.roomName] = {
                targetPosition: this.targetPosition
            }
        return Colony.memory.claimingManagers[this.roomName];
    }

    creeps: Array<Creep>;
    scouts: Array<Creep>;
    spawnConstructors: Array<Creep>;
    claimers: Array<Creep>;
    roomName: string;
    spawnConstructionSite: ConstructionSite;


    constructor(public targetPosition: RoomPosition) {
        this.roomName = targetPosition.roomName;
    }

    tickSpawnConstructors(creep: Creep) {
        if (creep.memory.state == null)
            creep.memory.state = 'moving';
        if (creep.room.name != creep.memory.targetPosition.roomName) {
            creep.moveTo(new RoomPosition(creep.memory.targetPosition.x, creep.memory.targetPosition.y, creep.memory.targetPosition.roomName));
        } else {
            if (creep.memory.state == 'moving') {
                creep.moveTo(new RoomPosition(creep.memory.targetPosition.x, creep.memory.targetPosition.y, creep.memory.targetPosition.roomName));
                creep.memory.state = 'harvesting';
            }
            else if (creep.carry.energy == creep.carryCapacity && creep.memory.state == 'harvesting')
                creep.memory.state = 'constructing';
            else if (creep.carry.energy == 0 && creep.memory.state == 'constructing')
                creep.memory.state = 'harvesting';

            if (creep.memory.state == 'harvesting') {
                let source = Game.getObjectById<Source>(creep.memory.sourceId);
                if (creep.harvest(source) == ERR_NOT_IN_RANGE)
                    creep.moveTo(source);
            }
            else if (creep.memory.state == 'constructing') {
                let construction = creep.pos.findClosestByRange<ConstructionSite>(FIND_MY_CONSTRUCTION_SITES, { filter: (x: ConstructionSite) => x.structureType == STRUCTURE_SPAWN });
                if (construction != null) {
                    if (creep.build(construction) == ERR_NOT_IN_RANGE)
                        creep.moveTo(construction);
                }
                else {
                    if (creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE)
                        creep.moveTo(creep.room.controller);
                }
            }
        }

    }

    tickClaimer(creep: Creep) {
        if (creep.room.name != creep.memory.targetPosition.roomName) {
            console.log(creep.moveTo(new RoomPosition(creep.memory.targetPosition.x, creep.memory.targetPosition.y, creep.memory.targetPosition.roomName)));
        } else {
            let controller = Game.rooms[creep.memory.targetPosition.roomName].controller;

            if (creep.claimController(controller) == ERR_NOT_IN_RANGE)
                creep.moveTo(controller);
        }
    }

    checkScouts(myRoom: MyRoom) {
        if (myRoom == null || myRoom.memory.lastScanTime < Game.time - 500) {
            if (this.scouts.length == 0)
                Colony.spawnCreep(['move'], { handledByColony: true, claimingManager: this.roomName, role: 'scout', targetPosition: this.targetPosition });
            return false;
        }
        else
            return true;
    }

    checkClaimer(myRoom: MyRoom) {
        if (this.claimers.length == 0) {
            Colony.spawnCreep(['claim', 'move'], { handledByColony: true, claimingManager: this.roomName, role: 'claimer', targetPosition: this.targetPosition });
            return false;
        }
        return true;
    }

    checkSpawnConstructors(myRoom: MyRoom) {
        if (myRoom == null)
            return false;
        let needCreeps = false;
        let sources = _.filter(myRoom.mySources, x => x.keeper == false);
        for (let idx in sources) {
            let mySource = sources[idx];
            let creepCount = _.filter(this.spawnConstructors, (x) => x.memory.sourceId == mySource.id).length;
            if (creepCount < 2) {
                Colony.spawnCreep(['work', 'work', 'work', 'work', 'work', 'carry', 'carry', 'carry', 'carry', 'carry', 'carry', 'carry', 'carry', 'carry', 'carry', 'move', 'move', 'move', 'move', 'move'], { handledByColony: true, claimingManager: this.roomName, role: 'spawnConstructor', targetPosition: this.targetPosition, sourceId: mySource.id }, 2 - creepCount);
                needCreeps = true;
            }
        }
        return !needCreeps;
    }

    finishClaimingManager() {
        let mainRoom = new MainRoom(this.roomName);
        Colony.mainRooms[this.roomName] = mainRoom;
        let myRoom = Colony.rooms[this.roomName];
        myRoom.mainRoom = mainRoom;
        myRoom.memory.mainRoomName = this.roomName;
        myRoom.memory.mainRoomDistanceDescriptions[this.roomName] = { roomName: this.roomName, distance: 0 };

        for (let idx in this.scouts)
            this.scouts[idx].suicide();

        for (let idx in this.claimers)
            this.claimers[idx].suicide();

        let sourceArray = _.values<MySource>(myRoom.mySources);

        for (let idx = 0; idx < this.spawnConstructors.length; idx++) {
            let creep = this.spawnConstructors[idx];
            creep.memory.role = 'harvester';
            creep.memory.doConstructions = true;
            creep.memory.handledByColony = false;
            creep.memory.mainRoomName = this.roomName;
            (<HarvesterMemory>creep.memory).state = HarvesterState.Harvesting;

            (<HarvesterMemory>creep.memory).sourceId = sourceArray[idx % sourceArray.length].id;
        }
       
        


        delete Colony.memory.claimingManagers[this.roomName];
        delete Colony.claimingManagers[this.roomName];
    }

    public tick() {
        let room = Game.rooms[this.roomName];

        this.creeps = _.filter(Game.creeps, (x) => x.memory.handledByColony == true && x.memory.claimingManager == this.roomName);

        this.scouts = _.filter(this.creeps, (x) => x.memory.targetPosition.roomName == this.targetPosition.roomName && x.memory.role == 'scout');
        this.spawnConstructors = _.filter(this.creeps, (x) => x.memory.role == 'spawnConstructor');
        this.claimers = _.filter(this.creeps, (x) => x.memory.role == 'claimer');

        if (_.size(room.find(FIND_MY_SPAWNS)) > 0) {
            this.finishClaimingManager();
            return;
        }

        let owning = false;

        if (room != null) {
            if (room.controller.owner != null && room.controller.owner.username == Colony.myName) {
                owning = true;
                //this.spawnConstructionSite = room.find<ConstructionSite>(FIND_MY_CONSTRUCTION_SITES, { filter: (x: ConstructionSite) => x.structureType == STRUCTURE_SPAWN })[0];
                let pos = this.memory.targetPosition;
                if (_.filter(Game.constructionSites, (x) => x.structureType == STRUCTURE_SPAWN && x.room.name == room.name).length == 0)
                    new RoomPosition(pos.x, pos.y, pos.roomName).createConstructionSite(STRUCTURE_SPAWN);
            }
        }

        let myRoom = Colony.getRoom(this.roomName);

        if (owning == false && this.checkScouts(myRoom) && this.checkSpawnConstructors(myRoom) && this.checkClaimer(myRoom)) {
            this.claimers.forEach(x => this.tickClaimer(x));
            this.spawnConstructors.forEach(x => this.tickSpawnConstructors(x));
        }
        else if (owning == true) {
            this.checkSpawnConstructors(myRoom);
            this.spawnConstructors.forEach(x => this.tickSpawnConstructors(x));
        }

        return;
    }
}