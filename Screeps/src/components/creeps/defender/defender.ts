﻿/// <reference path="../myCreep.ts" />

class Defender extends MyCreep<DefenderMemory> {
    public get memory():DefenderMemory { return this.creep.memory }

    constructor(public name: string, public mainRoom: MainRoomInterface) {
        super(name);
        if (myMemory['profilerActive']) {
            this.myTick = profiler.registerFN(this.myTick, 'Defender.tick');
        }

    }

    public myTick() {
        this.memory = <DefenderMemory>this.creep.memory;
        let closestHostileCreep = this.creep.pos.findClosestByPath<Creep>(FIND_HOSTILE_CREEPS, { filter: (c: Creep) => c.owner.username != 'Source Keeper' });

        if (closestHostileCreep != null) {
            this.memory.path = null;
            this.creep.moveTo(closestHostileCreep);
            this.creep.attack(closestHostileCreep);
            this.creep.rangedAttack(closestHostileCreep);
        }
        else {
            let otherRoom = _.filter(this.mainRoom.allRooms, (r) => r.name != this.creep.room.name && r.requiresDefense && r.canHarvest)[0];
            if (otherRoom != null) {
                if (this.memory.path == null || this.memory.path.path.length <= 2) {
                    this.memory.path = PathFinder.search(this.creep.pos, { pos: new RoomPosition(25, 25, otherRoom.name), range: 20 }, { roomCallback: Colony.getTravelMatrix, plainCost: 1, swampCost: 5, maxOps: 5000 });
                    this.memory.path.path.unshift(this.creep.pos);
                }
                this.moveByPath();
            }
            else {
                this.recycle();
            }

        }
    }
}
