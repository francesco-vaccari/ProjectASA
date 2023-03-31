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
        this.reward = this.reward - 1
    }
}

class Parcels{
    constructor(){
        this.array = []
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
                        parcels.startTrackingParcelsDecaY(Math.round(decayTime)*1000)
                        agentFunction()
                    }
                }
                firstUpdate = true
            }
        });
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
            parcel.decreaseReward()
        }
        this.array = this.array.filter(parcel => parcel.reward > 0)
    }
    print(){
        console.log('\n---[PARCEL LIST]---')
        for (const parcel of this.array){
            parcel.print()
        }
        console.log('-------------------\n')
    }
    startTrackingParcelsDecaY(decayTime){
        setInterval(() => {
            parcels.updateRewards()
            // parcels.print()
        }, decayTime)
    }
}

class Agent{
    constructor( id, name, x, y, score){
        let agentInitialized = false
        client.socket.on('you', (data) => {
            if (!agentInitialized){
                this.id = data.id
                this.name = data.name
                this.x = data.x
                this.y = data.y
                this.score = data.score
                agentInitialized = true
            }
        });
    }
    print(){
        console.log('[AGNT]\t', this.id, this.name, this.x, this.y, this.score)
    }
    updatePosition(x, y){
        this.x = x
        this.y = y
    }
    updateScore(score){
        this.score = score
    }
}

class Map{
    constructor(){
        let x_list = []
        let y_list = []
        let delivery_list = []
        client.socket.on('tile', (x, y, delivery) => {
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


var parcels = new Parcels()
var agent = new Agent()
var map = new Map()


function agentFunction(){
    client.socket.on('parcels sensing', (data) => {
        for (const p of data){
            let res = parcels.add(new Parcel(p.id, p.x, p.y, p.carriedBy, p.reward))
        }
        parcels.print()
    });
    
    map.print()
    agent.print()
}

// add support for no parcel decay
// will have to look for what gives me that info

// look for a way to understand when the 'tile' api stops sending info
// so i can proceed as soon as possible with initialization
// because in case of lower parcel decay or no parcel decay at all the initialization takes more time