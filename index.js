import { DeliverooApi, timer } from "@unitn-asa/deliveroo-js-client";
import { default as config } from "./config.js";

const client = new DeliverooApi( config.host, config.token )

class Parcel{
    constructor( id, x, y, carriedBy, reward ){
        this.id = id
        this.x = x
        this.y = y
        this.carriedBy = carriedBy
        this.reward = reward
    }
    print(){
        console.log('[PARC]\t', this.id, this.x, this.y, this.carriedBy, this.reward)
    }
    decreaseReward(){
        this.reward--
        if (this.reward === 0){
            return true
        }
        return false
    }
}

class Parcels{
    constructor(){
        this.array = []
    }
    add(parcel){
        let add = true
        for (const p of this.array){
            if (p.id === parcel.id){
                add = false
            }
        }
        if(add){
            this.array.push(parcel)
        }
        return add
    }
    updateRewards(){
        for (const parcel of this.array){
            let toRemove = parcel.decreaseReward()
            if(toRemove){
                this.array.splice(this.array.indexOf(parcel), 1)
            }
        }
    }
    print(){
        console.log('\n///////[PARCEL LIST]///////')
        for (const parcel of this.array){
            parcel.print()
        }
        console.log('////////////////////////////\n')
    }
}

var parcels = new Parcels()

function startTrackingParcelsDecaY(decayTime){
    setInterval(() => {
        parcels.updateRewards()
        parcels.print()
    }, decayTime)
}


// to enable correct updating of rewards of stored parcels
let syncingDone = false
let firstUpdate = false
let secondUpdate = false
let thirdUpdate = false
client.socket.on('parcels sensing', (data) => {
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
                startTrackingParcelsDecaY(Math.round(decayTime)*1000)
            }
        }
        firstUpdate = true
    }
});


client.socket.on('parcels sensing', (data) => {
    if(syncingDone){
        // console.log(data);
        for (const p of data){
            let res = parcels.add(new Parcel(p.id, p.x, p.y, p.carriedBy, p.reward))
        }
    }
});

