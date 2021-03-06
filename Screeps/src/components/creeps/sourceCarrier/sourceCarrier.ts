﻿/// <reference path="../myCreep.ts" />
/// <reference path="../../../colony/colony.ts" />

class SourceCarrier extends MyCreep<SourceCarrierMemory> {

    _source: { time: number, source: Source };
    public get source(): Source {
        if (this._source == null || this._source.time < Game.time)
            this._source = {
                time: Game.time, source: Game.getObjectById<Source>(this.memory.sourceId)
            };
        return this._source.source;
    }

    _mySource: { time: number, mySource: MySourceInterface };
    public get mySource(): MySourceInterface {
        if (this._mySource == null || this._mySource.time < Game.time)
            this._mySource = {
                time: Game.time, mySource: this.mainRoom.sources[this.memory.sourceId]
            };
        return this._mySource.mySource;
    }

    private reassignMainRoom() {
        let mainRoom = _.filter(Colony.mainRooms, r => _.any(r.sources, s => s.id == this.memory.sourceId))[0];
        if (mainRoom) {
            this.memory.mainRoomName = mainRoom.name;
            this.mainRoom = mainRoom;
            this._mySource = null;
        }
    }



    constructor(public name: string, public mainRoom: MainRoomInterface) {
        super(name);

        this.autoFlee = true;

        if (myMemory['profilerActive']) {
            this.myTick = profiler.registerFN(this.myTick, 'SourceCarrier.tick');
            this.pickup = profiler.registerFN(this.pickup, 'SourceCarrier.pickup');
        }
    }

    private pickup() {
        this.creep.say('1');
        if (this.memory.energyId && Game.getObjectById(this.memory.energyId) && Game.getObjectById<Resource>(this.memory.energyId).pos.inRangeTo(this.creep.pos, 4)) {
            this.creep.say('2');
            let energy = Game.getObjectById<Resource>(this.memory.energyId);
            if (this.creep.pickup(energy) == ERR_NOT_IN_RANGE)
                this.moveTo({ pos: energy.pos, range: 1 }, {
                    roomCallback: Colony.getCustomMatrix({ ignoreAllKeepers: true })
                });
        }
        else {
            this.creep.say('3');
            delete this.memory.energyId;
            if (!this.creep.pos.inRangeTo(this.mySource.pos, 2) && !this.pickUpEnergy()) {
                this.creep.say('4');
                if (this.mySource.container && !this.creep.pos.inRangeTo(this.mySource.container.pos, 1) || !this.mySource.container && !this.creep.pos.inRangeTo(this.mySource.pos, 2)) {
                    this.creep.say('5');
                    if (this.mySource.container)
                        this.moveTo({ pos: this.mySource.container.pos, range: 1 }, {
                            roomCallback: Colony.getCustomMatrix({ ignoreKeeperSourceId: this.mySource.id })

                        });
                    else
                        this.moveTo({ pos: this.mySource.pos, range: 2 }, {
                            roomCallback: Colony.getCustomMatrix({ ignoreKeeperSourceId: this.mySource.id })
                        });
                }
            }
            else if (this.mySource.container) {
                this.creep.say('6');
                if (this.creep.withdraw(this.mySource.container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
                    this.moveTo({ pos: this.mySource.container.pos, range: 1 }, {
                        roomCallback: Colony.getCustomMatrix({ ignoreKeeperSourceId: this.mySource.id })
                    });
                let energy = _.filter(this.myRoom.resourceDrops, r => r.resourceType == RESOURCE_ENERGY && r.pos.inRangeTo(this.creep.pos, 1))[0];
                if (energy)
                    this.creep.pickup(energy);
            }

            else {
                this.creep.say('7');
                let energy = _.filter(this.myRoom.resourceDrops, r => r.resourceType == RESOURCE_ENERGY && this.creep.pos.inRangeTo(r.pos, 3))[0];
                if (energy) {
                    this.creep.say('8');
                    this.memory.energyId = energy.id;
                }
            }
        }



        //else {
        //    let harvesters = _.filter(this.mainRoom.creepManagers.harvestingManager.harvesterCreeps, c => c.memory.sourceId == this.mySource.id && c.memory.state==HarvesterState.Harvesting);
        //    if (harvesters.length>0 && !harvesters[0].pos.isNearTo(this.creep.pos))
        //        this.creep.moveTo(harvesters[0]);
        //}

    }

    private deliver() {
        if (!this.mainRoom) {
            return;
        }
        if (!this.mainRoom.energyDropOffStructure) {
            return;
        }
        else {
            this.pickUpEnergy(1);

            let result = this.creep.transfer(this.mainRoom.energyDropOffStructure, RESOURCE_ENERGY)
            if (result == ERR_NOT_IN_RANGE)
                this.moveTo({ pos: this.mainRoom.energyDropOffStructure.pos, range: 3 }, {
                    roomCallback: Colony.getCustomMatrix({ ignoreKeeperSourceId: this.mySource.id }),
                    plainCost: 2,
                    swampCost: 5
                });
            else if (result == ERR_FULL)
                this.creep.drop(RESOURCE_ENERGY);
        }
    }

    public myTick() {
        if (this.creep.spawning) {
            return;
        }

        if (!this.mySource)
            this.reassignMainRoom();

        if (!this.mySource) {
            return;
        }


        if (this.memory.state == null || this.memory.state == SourceCarrierState.Deliver && this.creep.carry.energy == 0 && this.creep.carryCapacity > 0 && !(this.mainRoom.name == this.creep.room.name && this.creep.hits < this.creep.hitsMax)) {

            this.memory.state = SourceCarrierState.Pickup;
            if (this.creep.ticksToLive < 3 * this.mySource.pathLengthToDropOff)
                this.recycle();

        }
        else if (this.memory.state == SourceCarrierState.Pickup && (_.sum(this.creep.carry) >= (this.creep.hits == this.creep.hitsMax ? 1 : 0.5) * this.creep.carryCapacity || this.creep.ticksToLive < 1.5 * this.mySource.pathLengthToDropOff)) {

            this.memory.state = SourceCarrierState.Deliver;
        }

        if (this.memory.state == SourceCarrierState.Pickup) {
            this.pickup();
        }
        else if (this.memory.state == SourceCarrierState.Deliver) {
            this.deliver();
        }
    }
}
