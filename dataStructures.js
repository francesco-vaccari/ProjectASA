import { truncate } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const SortedArraySet = require("collections/sorted-array-set");

class Parcel{
    constructor( id, x, y, carriedBy, reward ){
        this.id = id;
        this.x = x;
        this.y = y;
        this.carriedBy = carriedBy;
        this.reward = reward;
    }
    print(){
        console.log('[PARC]\t', this.id, this.x, this.y, this.carriedBy, this.reward);
    }
    decreaseReward(){
        this.reward = this.reward - 1;
    }
    toRemove(){
        return this.reward === 0;
    }
}

class Parcels{

    constructor(){
        this.elements = new Map();
    }

    add(parcel){
        let add = this.elements.has(parcel.id);
        if(!add){
            this.elements.set(parcel.id,parcel);
        }
        return add;
    }

    /**
     * 
     * @returns {Array}
     */
    updateRewards(){
        let removed = [];
        for (const parcel of this.elements){
            parcel[1].decreaseReward();
            if(parcel[1].toRemove()){
                removed.push(parcel[0]);
                this.elements.delete(parcel[0]);
            }
        }
        return removed;
    }

    print(){
        console.log('\n///////[PARCEL LIST]///////')
        for (const parcel of this.elements){
            parcel[1].print();
        }
        console.log('////////////////////////////\n')
    }

    getParcel(id) {
        return this.elements.get(id);
    }
}

class OrderedParcelsId {

    constructor(equals,compare) {
        this.elements = new SortedArraySet({},equals,compare);
    }

    add(parcelId){
        let add = this.elements.has(parcelId);
        if(!add){
            this.elements.add(parcelId);
        }
        return add;
    }

    /**
     * 
     * @param {Parcels} parcels 
     */
    print(parcels){
        console.log('\n///////[ORDERED PARCEL LIST]///////')
        this.elements.forEach(parcelId => {
            parcels.getParcel(parcelId).print();
        });
        console.log('////////////////////////////\n')
    }

    removeParcelId(id) {
        this.elements.delete(id);
    }
}

class ParcelsManager {
    constructor(client) {
        this.client = client;
        this.parcels = new Parcels();
        this.orderedParcelsId = new OrderedParcelsId(
            (aId,bId) => aId === bId,
            (aId,bId) => {
                let a = this.parcels.getParcel(aId) != undefined ? this.parcels.getParcel(aId).reward : null;
                let b = this.parcels.getParcel(bId) != undefined ? this.parcels.getParcel(bId).reward : null;
                return aId === bId || a === b ? 0
                    : (a < b ? 1 : -1);
            });
        this.initParcelsSensing();
    }

    initParcelsSensing() {
        let syncingDone = false
        let firstUpdate = false
        let secondUpdate = false
        let thirdUpdate = false
        this.client.onParcelsSensing(data => {
            if(!syncingDone){
                if(firstUpdate){
                    if(!secondUpdate){
                        secondUpdate = new Date().getTime()
                    } else if (!thirdUpdate){
                        thirdUpdate = new Date().getTime()
                    } else {
                        let decayTime = (thirdUpdate - secondUpdate) / 1000
                        console.log('Parcel decay time:', decayTime)
                        console.log('Rounded decay time:', Math.round(decayTime))
                        syncingDone = true
                        this.startTrackingParcelsDecaY(Math.round(decayTime)*1000)
                        this.agentFunction()
                    }
                }
                firstUpdate = true
            }
        });
        //client.socket.remove
    }
    
    agentFunction(){
        this.client.onParcelsSensing(data => {
            for (const p of data){
                this.parcels.add(new Parcel(p.id, p.x, p.y, p.carriedBy, p.reward))
                this.orderedParcelsId.add(p.id);
            }
            // this.parcels.print()
            // this.orderedParcelsId.print(this.parcels);
        });
    }
    
    startTrackingParcelsDecaY(decayTime){
        setInterval(() => {
            const removed = this.parcels.updateRewards();
            for (const id of removed) {
                this.orderedParcelsId.removeParcelId(id);
            }
            // this.parcels.print();
            // this.orderedParcelsId.print(this.parcels);
        }, decayTime)
    }
}

class You{
    constructor(client, id, name, x, y, score){
        this.client = client;
        let agentInitialized = false
        this.client.onYou(data => {
            if (!agentInitialized){
                this.id = data.id
                this.name = data.name
                this.x = data.x
                this.y = data.y
                this.score = data.score
                agentInitialized = true
            }
            this.print()
        });
    }
    print(){
        console.log('[YOU]\t', this.id, this.name, this.x, this.y, this.score)
    }
    updatePosition(x, y){
        this.x = x
        this.y = y
    }
    updateScore(score){
        this.score = score
    }
}

class Agent{
    constructor(id, name, x, y, score){
        this.id = id
        this.name = name
        this.x = x
        this.y = y
        this.score = score
        this.visible = true
    }
    
    print(){
        console.log('[AGENT]\t', this.id, this.name, this.x, this.y, this.score, this.visible)
    }
}

class Agents{
    constructor(){
        this.elements = new Map()
    }

    print(){
        console.log('\n///////[AGENT LIST]///////')
        for (const agent of this.elements){
            agent[1].print()
        }
        console.log('////////////////////////////\n')
    }

    setAllNonVisible(){
        for (const agent of this.elements){
            agent[1].visible = false
        }
    }

    add(agent){
        if(!this.elements.has(agent.id)){
            this.elements.set(agent.id, agent)
        } else {
            this.elements.get(agent.id).visible = true
            this.elements.get(agent.id).x = agent.x
            this.elements.get(agent.id).y = agent.y
            this.elements.get(agent.id).score = agent.score
        }
    }
}

class AgentsManager{
    constructor(client){
        this.client = client
        this.agents = new Agents()
        this.client.onAgentsSensing(data => {
            this.agents.setAllNonVisible()
            for (const a of data){
                this.agents.add(new Agent(a.id, a.name, a.x, a.y, a.score))
            }
            this.agents.print()
        })
    }

}

class GameMap{
    constructor(client){
        this.client = client;
        let x_list = []
        let y_list = []
        let delivery_list = []
        this.client.onTile((x, y, delivery) => {
            x_list.push(x)
            y_list.push(y)
            delivery_list.push(delivery)
        });
        setTimeout(() => {
            this.n_rows = Math.max.apply(null, x_list)+1
            this.n_cols = Math.max.apply(null, y_list)+1
            console.log('Map size: ', this.n_rows, this.n_cols)
            this.matrix = []
            for (let i = 0; i < this.n_rows; i++){
                this.matrix.push([])
                for (let j = 0; j < this.n_cols; j++){
                    this.matrix[i].push(0)
                }
            }
            let index = 0
            for (let i = 0; i < this.n_rows; i++){
                for (let j = 0; j < this.n_cols; j++){
                    if (x_list[index] === i && y_list[index] === j){
                        if(delivery_list[index]){
                            this.matrix[i][j] = 2
                        } else {
                            this.matrix[i][j] = 1
                        }
                        index = index + 1
                    }
                }
            }
            console.log('Map initialized')
            this.print();
        }, 1000)

    }
    print(){
        console.log('\n-------[MAP]-------')
        let out = ''
        for (let col = this.n_cols-1; col >= 0; col--){
            for (let row = 0; row < this.n_rows; row++){
                if(this.matrix[row][col] === 0){
                    out += '  '
                } else {
                    out += this.matrix[row][col] + ' '
                }
            }
            out += '\n'
        }
        console.log(out)
        console.log('-------------------\n')
    }
}

class Belief {

}

class Beliefs {

}

class Intention {

}

class Intentions {

}

class Desire {

}

class Desires {

}

/**
 * Combination of perceptions of the environment
 */
class Percept {

}

class Action {

}

/**
 * Plan (series of Action)
 */
class Policy {

}

export { Parcel, Parcels, OrderedParcelsId, ParcelsManager, AgentsManager, You, GameMap, Belief, Beliefs, Intention, Intentions, Desire, Desires, Percept, Action, Policy };