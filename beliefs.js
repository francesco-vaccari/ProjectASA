import { ManhattanDistance } from './util.js'

class Conf{
    constructor(client, verbose=false){
        this.agentsViewingDistance = undefined
        this.parcelsViewingDistance = undefined
        this.decayingTime = undefined
        this.verbose = verbose
        client.onConfig(data => {
            this.agentsViewingDistance = data.AGENTS_OBSERVATION_DISTANCE
            this.parcelsViewingDistance = data.PARCELS_OBSERVATION_DISTANCE
            if(data.PARCEL_DECADING_INTERVAL != 'infinite'){
                this.decayingTime = parseInt(data.PARCEL_DECADING_INTERVAL.slice(0, -1)) * 1000
            } else {
                this.decayingTime = 0
            }
            if(this.verbose){
                console.log('Conf initialized', this.agentsViewingDistance, this.parcelsViewingDistance, this.decayingTime)
            }
        })
    }
}

class You{
    constructor(client, comm, verbose=false){
        this.client = client
        this.comm = comm
        this.verbose = verbose
        this.id = undefined
        this.client.onYou(data => {
            this.id = data.id
            this.name = data.name
            this.x = Math.round(data.x)
            this.y = Math.round(data.y)
            this.score = data.score
            this.comm.say(this.createJSON())
            if(this.verbose){
                this.print()
            }
        })
        this.makeSureYouIsSet()
        
    }
    createJSON(){
        return JSON.stringify({
            belief: 'YOU',
            id: this.id,
            name: this.name,
            x: this.x,
            y: this.y,
            score: this.score
        })
    }
    async makeSureYouIsSet(){
        while(this.id === undefined){
            this.client.move('up')
            this.client.move('down')
            this.client.move('left')
            this.client.move('right')
            await new Promise(res => setImmediate(res))
        }
    }
    print(){
        console.log('[YOU]\t', this.id, this.name, this.x, this.y, this.score)
    }
}

class Parcel{
    constructor( id, x, y, carriedBy, reward){
        this.id = id
        this.x = x
        this.y = y
        this.carriedBy = carriedBy
        this.reward = reward
        this.visible = true
    }

    print(){
        console.log('[PARC]\t', this.id, this.x, this.y, this.carriedBy, this.reward, this.visible);
    }
}

class ThisAgentParcels{
    constructor(client, parcels, conf, agent, comm, verbose=false){
        this.client = client
        this.parcels = parcels
        this.conf = conf
        this.agent = agent
        this.comm = comm
        this.verbose = verbose
        this.map = new Map()
        this.startDecay()
        this.client.onParcelsSensing(data => {
            this.setAllParcelsNotVisible()
            for(const parcel of data){
                this.add(new Parcel(parcel.id, Math.round(parcel.x), Math.round(parcel.y), parcel.carriedBy, parcel.reward))
            }
            this.deleteInconsistentParcels()
            this.comm.say(this.createJSON())
            if(this.verbose){
                this.print()
            }
            this.parcels.setMapOfThisAgent(this.map)
        })
    }
    createJSON(){
        return JSON.stringify({belief: 'PARCELS', map: Array.from(this.map)})
        
    }
    startDecay(){
        let once = false
        this.client.onParcelsSensing(() => {
            if(!once){
                if(this.conf.decayingTime != undefined){
                    once = true
                    if(this.conf.decayingTime != 0){
                        setInterval(() => {
                            for(const parcel of this.map){
                                parcel[1].reward -= 1
                            }
                        }, this.conf.decayingTime)
                    }
                }
            }
            for(const parcel of this.map){
                if(parcel[1].reward < 1){
                    this.map.delete(parcel[0])
                }
            }
        })
    }
    deleteInconsistentParcels(){
        if(this.conf.parcelsViewingDistance != undefined){
            if(this.agent.x != undefined && this.agent.y != undefined){
                for(const parcel of this.map){
                    if(!parcel[1].visible && ManhattanDistance(this.agent.x, this.agent.y, parcel[1].x, parcel[1].y) < this.conf.parcelsViewingDistance){
                        this.map.delete(parcel[0])
                        this.comm.say(JSON.stringify({belief: 'DELETEPARCEL', parcel: parcel[1]}))
                    }
                }
            }
        }
    }
    setAllParcelsNotVisible(){
        for (const parcel of this.map){
            parcel[1].visible = false
        }
    }
    add(parcel){
        if(this.map.has(parcel.id)){
            this.map.get(parcel.id).x = parcel.x
            this.map.get(parcel.id).y = parcel.y
            this.map.get(parcel.id).carriedBy = parcel.carriedBy
            this.map.get(parcel.id).reward = parcel.reward
            this.map.get(parcel.id).visible = true
        } else {
            this.map.set(parcel.id, parcel)
        }
    }
    remove(parcel){
        this.map.delete(parcel.id)
    }
    print(){
        console.log('\n///////[PARCEL LIST]///////')
        for (const parcel of this.map){
            parcel[1].print();
        }
        console.log('////////////////////////////\n')
    }
    getMap(){
        return this.map
    }
}

class Cell{
    constructor(x, y, type){
        this.x = x
        this.y = y
        this.type = type //0 wall, 1 normal, 2 delivery, 3 spawn
        this.lastSeen = 0
    }
}

class GameMap{
    constructor(client, comm, conf, agent, verbose=false){
        this.client = client
        this.comm = comm
        this.conf = conf
        this.agent = agent
        this.verbose = verbose
        this.n_rows = undefined
        this.n_cols = undefined
        this.matrix = []
        this.client.onMap((width, height, cells) => {
            this.n_rows = width
            this.n_cols = height
            for (let i = 0; i < this.n_rows; i++){
                this.matrix.push([])
                for (let j = 0; j < this.n_cols; j++){
                    this.matrix[i].push(new Cell(i, j, 0))
                }
            }
            for(const cell of cells){
                let type = 0
                if(cell.delivery){
                    type = 2
                } else if(cell.parcelSpawner){
                    type = 3
                } else {
                    type = 1
                }
                this.matrix[cell.x][cell.y].type = type
            }
            if(this.verbose){
                this.print()
                this.printLastSeen()
            }
            this.startTrackingSeenCells()
        })
    }
    startTrackingSeenCells(){
        setInterval(() => {
            if(this.agent.x !== undefined && this.agent.y !== undefined){
                if(this.conf.parcelsViewingDistance !== undefined){
                    for (let i = 0; i < this.n_rows; i++){
                        for (let j = 0; j < this.n_cols; j++){
                            if(this.matrix[i][j].type === 3){
                                if(ManhattanDistance(this.agent.x, this.agent.y, i, j) < this.conf.parcelsViewingDistance){
                                    this.comm.say(this.createJSON(i, j))
                                    this.matrix[i][j].lastSeen = 0
                                } else {
                                    this.matrix[i][j].lastSeen += 1
                                }
                            }
                        }
                    }
                }
            }
        }, 50)
    }
    createJSON(x, y){
        return JSON.stringify({belief: 'MAP', x: x, y: y})
    }
    print(){
        console.log('\n-------[MAP]-------')
        let out = ''
        for (let col = this.n_cols-1; col >= 0; col--){
            for (let row = 0; row < this.n_rows; row++){
                if(this.matrix[row][col].type === 0){
                    out += '  '
                } else {
                    out += this.matrix[row][col].type + ' '
                }
            }
            out += '\n'
        }
        console.log(out)
        console.log('-------------------\n')
    }
    printLastSeen(){
        setInterval(() => {
            console.log('\n-------[LAST SEEN]-------')
            let out = ''
            for (let col = this.n_cols-1; col >= 0; col--){
                for (let row = 0; row < this.n_rows; row++){
                    if(this.matrix[row][col].type === 0){
                        out += '  '
                    } else {
                        out += this.matrix[row][col].lastSeen + ' '
                    }
                }
                out += '\n'
            }
            console.log(out)
            console.log('-------------------\n')
        }, 100)
    }
    getMatrix(){
        return this.matrix
    }
    getNRows(){
        return this.n_rows
    }
    getNCols(){
        return this.n_cols
    }
}

class Agent{
    constructor(id, name, x, y, score, visible=true){
        this.id = id
        this.name = name
        this.x = x
        this.y = y
        this.score = score
        this.visible = visible
    }
    print(){
        console.log('[AGENT]\t', this.id, this.name, this.x, this.y, this.score, this.visible)
    }
}

class ThisAgentAgents{
    constructor(client, agents, comm, verbose=false){
        this.client = client
        this.agents = agents
        this.comm = comm
        this.verbose = verbose
        this.map = new Map()
        this.forgetAgentsAfterNSeconds(3)
        this.client.onAgentsSensing(data => {
            this.setAllAgentsNotVisible()
            for (const agent of data){
                if(agent.name !== 'god'){
                    this.add(new Agent(agent.id, agent.name, Math.round(agent.x), Math.round(agent.y), agent.score))
                }
            }
            this.comm.say(this.createJSON())
            if (this.verbose){
                this.print()
            }
            this.agents.setMapOfThisAgent(this.map)
        })
    }
    createJSON(){
        return JSON.stringify({belief: 'AGENTS', map: Array.from(this.map)})
    }
    setAllAgentsNotVisible(){
        for (const agent of this.map){
            agent[1].visible = false
        }
    }
    forgetAgentsAfterNSeconds(n){
        setInterval(() => {
            for (const agent of this.map){
                if(!agent[1].visible){
                    this.map.delete(agent[0])
                }
            }
        }, n*1000)
    }
    add(agent){
        if(this.map.has(agent.id)){
            this.map.get(agent.id).x = agent.x
            this.map.get(agent.id).y = agent.y
            this.map.get(agent.id).score = agent.score
            this.map.get(agent.id).visible = true
        } else {
            this.map.set(agent.id, agent)
        }
    }
    print(){
        console.log('\n///////[AGENT LIST]///////')
        for (const agent of this.map){
            agent[1].print()
        }
        console.log('////////////////////////////\n')
    }
    getMap(){
        return this.map
    }
}

class Target{
    constructor(x, y, intention='error', score=0){
        this.x = x
        this.y = y
        this.intention = intention
        this.score = score
    }
}

class OtherAgent{
    constructor(verbose=false){
        this.verbose = verbose
        this.id = undefined
        this.name = undefined
        this.x = undefined
        this.y = undefined
        this.score = undefined
        this.target = new Target(undefined, undefined)
        this.scoreParcelsCarried = 0
        if(this.verbose){
            setInterval(() => {
                this.print()
            }, 200)
        }
    }
    set(json){
        this.id = json.id
        this.name = json.name
        this.x = json.x
        this.y = json.y
        this.score = json.score
    }
    print(){
        console.log('[OTHERAGENT]\t', this.id, this.name, this.x, this.y, this.score, '\tCarried: ', this.scoreParcelsCarried, '\tTarget: ', this.target.x, this.target.y, this.target.intention)
    }
}

class OtherAgentAgents{
    constructor(agents, verbose=false){
        this.verbose = verbose
        this.agents = agents
        this.map = new Map()
    }
    clearAndAddAll(agents){
        this.map.clear()
        for(const agent of agents){
            this.map.set(agent[0], agent[1])
        }
        if(this.verbose){
            this.print()
        }
        this.agents.setMapOfOtherAgent(this.map)
    }
    print(){
        console.log('\n///////[OTHER AGENT LIST]///////')
        for (const agent of this.map){
            console.log('[OTHERAGENT]\t', agent[0], agent[1].name, agent[1].x, agent[1].y, agent[1].score, agent[1].visible)
        }
        console.log('////////////////////////////\n')
    }
}

class OtherAgentParcels{
    constructor(parcels, verbose=false){
        this.verbose = verbose
        this.parcels = parcels
        this.map = new Map()
    }
    clearAndAddAll(parcels){
        this.map.clear()
        for(const parcel of parcels){
            this.map.set(parcel[0], parcel[1])
        }
        if(this.verbose){
            this.print()
        }
        this.parcels.setMapOfOtherAgent(this.map)
    }
    print(){
        console.log('\n///////[OTHER AGENT PARCEL LIST]///////')
        for (const parcel of this.map){
            console.log('[OTHERPARCEL]\t', parcel[0], parcel[1].x, parcel[1].y, parcel[1].carriedBy, parcel[1].reward, parcel[1].visible)
        }
        console.log('////////////////////////////\n')
    }
}

class Parcels{
    constructor(conf, thisAgent, otherAgent, verbose=false){
        this.verbose = verbose
        this.thisAgent = thisAgent
        this.otherAgent = otherAgent
        this.conf = conf
        this.parcels = new Map()
        this.mapOfThisAgent = new Map()
        this.mapOfOtherAgent = new Map()
    }
    setMapOfThisAgent(map){
        this.mapOfThisAgent = map
        this.joinMaps()
    }
    setMapOfOtherAgent(map){
        this.mapOfOtherAgent = map
        this.joinMaps()
    }
    joinMaps(){
        this.parcels.clear()
        for(const parcel of this.mapOfThisAgent){
            this.parcels.set(parcel[0], parcel[1])
        }
        for(const parcel of this.mapOfOtherAgent){
            if(!this.parcels.has(parcel[0])){
                this.parcels.set(parcel[0], parcel[1])
            } else {
                if(!this.parcels.get(parcel[0].visible) && parcel[1].visible){
                    this.parcels.set(parcel[0], parcel[1])
                }
            }
        }
        if(this.verbose){
            this.print()
        }
    }
    print(){
        console.log('\n///////[PARCEL LIST UNIFIED]///////')
        for (const parcel of this.parcels){
            console.log('[PARCEL]\t', parcel[0], parcel[1].x, parcel[1].y, parcel[1].carriedBy, parcel[1].reward)
        }
        console.log('////////////////////////////\n')
    }
    getMap(){
        return this.parcels
    }
}

class Agents{
    constructor(conf, agent, otherAgent, verbose=false){
        this.verbose = verbose
        this.agent = agent
        this.otherAgent = otherAgent
        this.conf = conf
        this.agents = new Map()
        this.mapOfThisAgent = new Map()
        this.mapOfOtherAgent = new Map()
    }
    setMapOfThisAgent(map){
        this.mapOfThisAgent = map
        this.joinMaps()
    }
    setMapOfOtherAgent(map){
        this.mapOfOtherAgent = map
        this.joinMaps()
    }
    joinMaps(){
        this.agents.clear()
        if(this.agent.id !== undefined){
            this.agents.set(this.agent.id, new Agent(this.agent.id, this.agent.name, this.agent.x, this.agent.y, this.agent.score, true))
        }
        if(this.otherAgent.id !== undefined){
            this.agents.set(this.otherAgent.id, new Agent(this.otherAgent.id, this.otherAgent.name, this.otherAgent.x, this.otherAgent.y, this.otherAgent.score, true))
        }

        for(const agent of this.mapOfThisAgent){
            if(agent[0] !== this.agent.id && agent[0] !== this.otherAgent.id){
                this.agents.set(agent[0], agent[1])
            }
        }
        for(const agent of this.mapOfOtherAgent){
            if(agent[0] !== this.agent.id && agent[0] !== this.otherAgent.id){
                if(!this.agents.has(agent[0])){
                    this.agents.set(agent[0], agent[1])
                } else {
                    if(!this.agents.get(agent[0]).visible && agent[1].visible){
                        this.agents.set(agent[0], agent[1])
                    }
                }
            }
        }

        if(this.verbose){
            this.print()
        }
    }
    print(){
        console.log('\n///////[AGENT LIST UNIFIED]///////')
        for (const agent of this.agents){
            console.log('[AGENT]\t', agent[0], agent[1].name, agent[1].x, agent[1].y, agent[1].score, agent[1].visible)
        }
        console.log('////////////////////////////\n')
    }
    getMap(){
        return this.agents
    }
}

class Enemies{
    constructor(client, thisAgent, otherAgent, agents, verbose=false){
        this.client = client
        this.verbose = verbose
        this.thisAgent = thisAgent
        this.otherAgent = otherAgent
        this.agents = agents
        this.initialized = false

        this.enemyOne = new Agent(undefined, undefined, undefined, undefined, undefined, false)
        this.enemyTwo = new Agent(undefined, undefined, undefined, undefined, undefined, false)

        this.initializeEnemies()
        this.updateEnemies()
        
        if(this.verbose){
            setInterval(() => {
                this.print()
            }, 200)
        }
    }
    async initializeEnemies(){
        while(!this.initialized){
            if(this.thisAgent.id !== undefined && this.otherAgent.id !== undefined){
                for(const agent of this.agents.getMap()){
                    if(agent[0] !== this.thisAgent.id && agent[0] !== this.otherAgent.id){
                        if(this.enemyOne.id === undefined){
                            this.enemyOne = agent[1]
                        } else if(this.enemyTwo.id === undefined && agent[0] !== this.enemyOne.id){
                            this.enemyTwo = agent[1]
                            this.initialized = true
                        }
                    }
                }
            }
            await new Promise(res => setImmediate(res))
        }
    }
    async updateEnemies(){
        while(true){
            if(this.initialized){
                for(const agent of this.agents.getMap()){
                    if(agent[0] === this.enemyOne.id){
                        this.enemyOne = agent[1]
                    }
                    if(agent[0] === this.enemyTwo.id){
                        this.enemyTwo = agent[1]
                    }
                }
            }
            await new Promise(res => setImmediate(res))
        }
    }
    print(){
        console.log('\n///////[ENEMY LIST]///////')
        console.log('[ENEMY]\t', this.enemyOne.id, this.enemyOne.name, this.enemyOne.x, this.enemyOne.y, this.enemyOne.score, this.enemyOne.visible)
        console.log('[ENEMY]\t', this.enemyTwo.id, this.enemyTwo.name, this.enemyTwo.x, this.enemyTwo.y, this.enemyTwo.score, this.enemyTwo.visible)
        console.log('////////////////////////////\n')
    }
}

export { Conf, You, ThisAgentParcels, OtherAgentParcels, GameMap, OtherAgent, ThisAgentAgents, OtherAgentAgents, Parcels, Agents, Enemies }