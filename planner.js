import { ManhattanDistance, BFS, PathLengthBFS  } from "./util.js"

class Target{
    constructor(x, y, intention='error', score=0){
        this.x = x
        this.y = y
        this.intention = intention
        this.score = score
    }
}

class Planner{
    constructor(client, map, agent, otherAgent, parcels, agents, comm, verbose=false){
        this.client = client
        this.verbose = verbose
        this.map = map
        this.agent = agent
        this.otherAgent = otherAgent
        this.parcels = parcels
        this.agents = agents
        this.comm = comm
        this.plan = []
        this.target = new Target(this.agent.x, this.agent.y, 'error', 0)
        this.startPlanning()
        if(this.verbose){
            setInterval(() => {
                console.log('['+this.agent.name+']\tTARGET', this.target.x, this.target.y, this.target.intention, this.target.score)
                // console.log('PLAN', this.plan)
            }, 200)
        }
    }
    async startPlanning(){
        while(true){
            
            if(true/*blocking strategy not possible*/){
                let targets = []
                targets = this.getTargetsIdleMovement().concat(targets)
                if(this.agentKnowsParcels() || this.agentCarriesParcels()){
                    targets = this.getTargetsWithUtility().concat(targets)
                }
                for(const target of targets){
                    let tmpPlan = BFS(this.agent.x, this.agent.y, target.x, target.y, this.map , this.agents, this.agent, this.otherAgent)
                    if(tmpPlan[0] != 'error'){
                        this.plan = tmpPlan
                        this.target = target
                        break
                    }
                }
                if(this.target.intention === 'pickup'){
                    this.plan = this.plan.concat(['pickup'])
                } else if(this.target.intention === 'delivery'){
                    this.plan = this.plan.concat(['putdown'])
                }
                
                // implement exchange check and execution
                /*
                nel caso in cui l'intention sia quella di delivery allora vado a vedere
                se posso o è necessario fare lo scambio di parcelle. Devo modificare il BFS per non considerare l'agente con l'id
                che conosco. Nel caso in cui l'intention è delivery e tutti i path per il target passano per la posizione dell'altro
                agent allora lo scambio è necessario. Se invece non è necessario devo decidere se farlo o meno.
                
                Lo scambio di parcelle tra gli agenti allunga di 2 il path per la consegna della parcella, più ovviamente il tempo che
                l'altro agente impiega per arrivare al punto di scambio. Questo significa che lo scambio di parcelle è sempre da evitare, a 
                meno che non sia l'unico path per una cella di delivery e l'intention corrente sia quella di fare la consegna.
                Una cosa da considerare è che l'agente che vuole fare lo scambio deve avere lo spazio di farlo, cioè una cella in cui spostarsi
                dopo aver fatto il putdown. Quindi servirà implementare una sorva di comunicazione che dica all'altro agente di fare spazio nel 
                caso non ce ne sia durante l'intention di scambio. Visto che il costo di fare lo scambio è due, ha senso farlo solo se tutti i 
                path sono bloccati o se un path alternativo per consegnare è di almeno 2 mosse più lungo. C'è anche da capire come gestire il 
                punto dello scambio.
                */
            } else {
                // implement blocking strategy
                /*
                
                Un possibile caso particolare è quello di bloccare i path degli agenti nemici verso le caselle di delivery, ma questo funziona 
                solo se i due agenti nemici sono in celle i quali path verso celle di delivery passano tutti nelle posizioni in cui gli agenti 
                si posizionerebbero per bloccare i path. Ovviamente questa strategia funziona solo in caso di vantaggio. Un'altra cosa è che 
                dovremmo sapere con esattezza le posizioni di entrambi gli agenti nemici prima di poter eseguire questa strategia. Dopo l'esecuzione 
                ci sposteremmo solo nel caso in cui lo score degli avversari superare il nostro. Una variante più semplice sarebbe quella di 
                posizionarsi direttamente sulle celle di delivery nel caso in cui fossero solo due.
                
                if(N delivery cells < 3 and can reach with both agents){
                    i can block the delivery cells directly
                    if(we are up in score and both agents paths are shorter than enemies to delivery cells and enemies are visible){
                        each of our agents picks as target the closest delivery cells and blocks it
                    }
                }
                
                Altrimenti se ci sono più delivery cells devo identificare i choke point in cui posso bloccare l'accesso a tutte le delivery cells.
                Se siamo sopra di punti e i nostri agenti hanno un path più corto di quello degli avversari allora posso bloccare i choke point.
                
                */
            }
            await new Promise(res => setImmediate(res))
        }
    }
    
    getTargetsIdleMovement(){
        let targets = []
        for(let row = 0; row < this.map.getNRows(); row++){
            for(let col = 0; col < this.map.getNCols(); col++){
                if(this.map.getMatrix()[row][col].type === 3){
                    let tempTarget = new Target(row, col, 'idle', this.map.getMatrix()[row][col].lastSeen)
                    targets.push(tempTarget)
                }
            }
        }
        targets.sort((a, b) => (a.score < b.score) ? 1 : -1)
        return targets
    }
    getTargetsWithUtility(){
        let targets = []
        for(let row = 0; row < this.map.getNRows(); row++){
            for(let col = 0; col < this.map.getNCols(); col++){
                if(this.map.getMatrix()[row][col].type === 3 || this.map.getMatrix()[row][col].type === 1){
                    let score = this.getNormalCellUtility(row, col)
                    if(score > 0){
                        targets.push(new Target(row, col, 'pickup', score))
                    }
                } else if(this.map.getMatrix()[row][col].type === 2){
                    let score = this.getDeliveryCellUtility(row, col)
                    if(score > 0){
                        targets.push(new Target(row, col, 'delivery', score))
                    }
                }
            }
        }
        targets.sort((a, b) => (a.score < b.score) ? 1 : -1)
        return targets
    }
    getNormalCellUtility(x, y){
        let minDistanceToBorder = 10000000
        let borderx = undefined
        let bordery = undefined
        for (let i = 0; i < this.map.getNRows(); i++){
            for(let j = 0; j < this.map.getNCols(); j++){
                if(this.map.getMatrix()[i][j].type === 2){
                    let tempDist = ManhattanDistance(x, y, i, j)
                    if(tempDist < minDistanceToBorder){
                        minDistanceToBorder = tempDist
                        borderx = i
                        bordery = j
                    }
                }
            }
        }

        let parcelsRewardInCell = 0
        for (const parcel of this.parcels.getMap()){
            if(parcel[1].x == x && parcel[1].y == y && parcel[1].carriedBy == null){
                parcelsRewardInCell += parcel[1].reward
            }
        }

        let distanceToAgent = 1
        if(parcelsRewardInCell != 0){
            distanceToAgent =  Math.max(PathLengthBFS(x, y, this.agent.x, this.agent.y, this.map, this.agents, this.agent, this.otherAgent), 0.1)
        }

        let enemiesProximity = 1
        if(this.agents.getMap().size > 0){
            for (const agent of this.agents.getMap()){
                if(agent[1].id !== this.agent.id){
                    let tmp = ManhattanDistance(x, y, agent[1].x, agent[1].y) + 1
                    tmp = - (1 / tmp) + 1
                    if(tmp < enemiesProximity){
                        enemiesProximity = tmp
                    }
                }
            }
        }   
        // computing enemiesProximity I should not consider the other friend agent as an enemy
        return (Math.pow(parcelsRewardInCell, 1.2) / Math.pow(distanceToAgent, 1)) * Math.pow(enemiesProximity, 2)
    }
    getDeliveryCellUtility(x, y){
        let scoreParcelsCarriedByAgent = 0
        for (const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy == this.agent.id){
                scoreParcelsCarriedByAgent += parcel[1].reward
            }
        }

        let distanceToAgent = 1
        if(scoreParcelsCarriedByAgent != 0){
            distanceToAgent = Math.max(PathLengthBFS(x, y, this.agent.x, this.agent.y, this.map, this.agents, this.agent, this.otherAgent), 0.1)
        }

        return Math.pow(scoreParcelsCarriedByAgent, 0.8) / Math.pow(distanceToAgent, 1)
    }
    agentKnowsParcels(){
        for(const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy == null){
                return true
            }
        }
        return false
    }
    agentCarriesParcels(){
        let carry = false
        for(const parcel of this.parcels.getMap()){
            if(parcel[1].carriedBy == this.agent.id){
                carry = true
                break
            }
        }
        return carry
    }
    getPlan(){
        return this.plan
    }
}

export { Planner }