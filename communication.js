class Communication{
    constructor(client, who, verbose=false){
        this.client = client
        this.verbose = verbose
        this.otherAgentId = undefined
        this.buffer = []
        this.who = who
        this.INIT = 'init'
        this.SECRET = 'secret'
        this.OKAY = 'okay'
        if(this.who === 'one'){
            this.initializeCommunicationOne()
        } else if(this.who === 'two'){
            this.initializeCommunicationTwo()
        }
    }
    initializeCommunicationOne(){
        let interval = setInterval(() => {
            this.client.shout(this.INIT)
        }, 50)
    
        this.client.onMsg((fromId, fromName, msg) => {
            if(this.otherAgentId === undefined){
                if(msg === this.SECRET){
                    clearInterval(interval)
                    this.client.say(fromId, this.OKAY)
                    this.otherAgentId = fromId
                    setTimeout(() => {
                        this.startReceiving()
                    }, 100)
                    if(this.verbose){
                        console.log('['+this.who+']\tCommunication initialized', this.otherAgentId)
                    }
                }
            }
        })
    }
    initializeCommunicationTwo(){
        let onceInit = false
        this.client.onMsg((fromId, fromName, msg) => {
            if(this.otherAgentId === undefined){
                if(msg === this.INIT){
                    if(!onceInit){
                        this.client.say(fromId, this.SECRET)
                    }
                }
                if(msg === this.OKAY){
                    onceInit = true
                    this.otherAgentId = fromId
                    setTimeout(() => {
                        this.startReceiving()
                    }, 100)
                    if(this.verbose){
                        console.log('['+this.who+']\tCommunication initialized', this.otherAgentId)
                    }
                }
            }
        })
    }
    startReceiving(){
        this.client.onMsg((fromId, fromName, msg) => {
            if(this.otherAgentId === fromId){
                this.buffer.push(msg)
                // if(this.verbose){
                //     console.log('['+this.who+']\tReceived\t', msg)
                // }
            }
        })
    }
    say(msg){
        if(this.otherAgentId !== undefined){
            this.client.say(this.otherAgentId, msg)
            return true
        } else {
            return false
        }
    }
    getOtherAgentId(){
        return this.otherAgentId
    }
}

class CommunicationHandler{
    constructor(comm, otherAgent, map, thisAgentParcels, otherAgentParcels, thisAgentAgents, otherAgentAgents, planner, verbose=false){
        this.comm = comm
        this.otherAgent = otherAgent
        this.map = map
        this.thisAgentParcels = thisAgentParcels
        this.otherAgentParcels = otherAgentParcels
        this.thisAgentAgents = thisAgentAgents
        this.otherAgentAgents = otherAgentAgents
        this.planner = planner
        this.verbose = verbose
        this.handleMessages()
    }
    async handleMessages(){
        while(true){
            if(this.comm.buffer.length > 0){
                let msg = this.comm.buffer.shift()
                let json = JSON.parse(msg)
                if(json.belief === 'YOU'){
                    this.otherAgent.set(json)
                } else if (json.belief === 'PARCELS'){
                    this.otherAgentParcels.clearAndAddAll(json.map)
                } else if (json.belief === 'AGENTS'){
                    this.otherAgentAgents.clearAndAddAll(json.map)
                } else if(json.belief === 'MAP'){
                    this.map.getMatrix()[json.x][json.y].lastSeen = 0
                } else if(json.belief === 'EXCHANGE'){
                    this.planner.exchangeSlave = true
                    this.planner.plan = []
                    this.planner.target.intention = 'exchange'
                } else if(json.belief === 'ENDEXCHANGE'){
                    this.planner.exchangeSlave = false
                } else if(json.belief === 'TARGET'){
                    this.planner.target = json.target
                }

                if(this.verbose){
                    console.log('[HANDLE]\t', json)
                }
            }
            await new Promise(res => setImmediate(res))
        }
    }
}

export { Communication, CommunicationHandler }