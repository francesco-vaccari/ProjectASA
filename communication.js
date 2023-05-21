class Communication{
    constructor(client, agent, who, verbose=false){
        this.client = client
        this.agent = agent
        this.verbose = verbose
        this.otherAgentId = undefined
        this.INIT = 'init'
        this.SECRET = 'secret'
        this.OKAY = 'okay'
        if(who === 'one'){
            this.initializeCommunicationOne()
        } else if(who === 'two'){
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
                    if(this.verbose){
                        console.log('['+this.agent.name+']\tCommunication initialized', this.otherAgentId)
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
                    if(this.verbose){
                        console.log('['+this.agent.name+']\tCommunication initialized', this.otherAgentId)
                    }
                }
            }
        })
    }
    getOtherAgentId(){
        return this.otherAgentId
    }
}

export { Communication }