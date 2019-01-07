import {getSockets,Message,MessageType} from './p2p';
class Agent {

    public nodeCounts: number;

    public nodeAdd: string[];

    public nodeCPU: number[];

    public nodeMEM: number[];

    public index: string;

    public TaskNodeList: Map<string,string[]>;

    constructor(nodeCounts: number, nodeAdd: string[],TaskNodeList: Map<string,string[]>,index: string,nodeCPU: number[],nodeMEM: number[]){
        this.nodeCounts=nodeCounts;
        this.nodeAdd=nodeAdd;
        this.TaskNodeList=TaskNodeList;
        this.index=index;
        this.nodeCPU=nodeCPU;
        this.nodeMEM=nodeMEM;
    }

    /**
     * register resources
     * @param newPeer
     * @param cpu
     * @param mem
     */
    public register = (newPeer: string,cpu: number,mem: number): void =>{
        this.nodeAdd[this.nodeCounts]=newPeer;
        this.nodeCPU[this.nodeCounts]=cpu;
        this.nodeMEM[this.nodeCounts]=mem;
        console.log(this.nodeAdd[this.nodeCounts]);
        console.log(this.nodeCPU[this.nodeCounts]);
        console.log(this.nodeMEM[this.nodeCounts]);
        this.nodeCounts++;
    }

    /**
     * TODO bullshit
     * deployTask
     * @param codefile
     * @param requstcpu
     * @param requestmem
     */
    public deployTask = (address: string, taskName: string): void=>{
        let nodes: string[]=[];
        let index: number=0;
        getSockets().map((s: any) => {
            //console.log(s._socket.remoteAddress);
            let ip;
            if (s._socket.remoteAddress.substr(0, 7) == "::ffff:") {
                ip = s._socket.remoteAddress.substr(7)
            }
            if(ip!=address){
                nodes.push(ip);
                if(index==0)
                    nodes.push(ip);
            }
            index++;
        });
         console.log(nodes);
        this.TaskNodeList[taskName]=nodes;
         console.log(this.TaskNodeList);
    }

    /**
     * schedulertasks
     * @param address 发布计算任务节点的ip地址
     * @param taskName
     * @param params
     */
    public schedulerTask = (address: string,taskName: string, params: string): void =>{
        let nodes: string[]=this.TaskNodeList[taskName];
        console.log(nodes);
        let index: string=nodes[0];
        // console.log(nodes);
        //scheduling tasks in order
        getSockets().map((s: any) => {
            //console.log(s._socket.remoteAddress);
            let ip;
            if (s._socket.remoteAddress.substr(0, 7) == "::ffff:") {
                ip = s._socket.remoteAddress.substr(7)
            }
            if(ip==index){
                let information : Message = ({'type': MessageType.GET_PARAM, 'data': address+':'+params});//在message中增加发送请求节点IP
                console.log(information);
                console.log(JSON.stringify(information));
                s.send(JSON.stringify(information));
            }
        });

        let i: number = 1;
        for(; i < nodes.length; i++){
            if(nodes[i] == index){
                break;
            }
        }
        ++i;
        if(i >= nodes.length)
            i=1;
        nodes[0] = nodes[i];


    }

}

export {Agent};