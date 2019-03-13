import * as WebSocket from 'ws';
import {Server} from 'ws';
import {
    addBlockToChain,
    Block,
    getBlockchain,
    getLatestBlock,
    handleReceivedTransaction,
    isValidBlockStructure,
    replaceChain,
    getDifficulty,
    generatePouwNextBlock,
    sendTransaction,
    getAccountBalance,
    getMyUnspentTransactionOutputs,
    unspentTxOuts
} from './blockchain';
import {Transaction, UnspentTxOut} from './transaction';
import {getTransactionPool} from './transactionPool';
import {timeSend} from './agent';
import {agent} from "./main";
import {getPublicFromWallet} from "./wallet";

//一个节点连接就有一个socket
const sockets: WebSocket[] = [];

enum MessageType {
    QUERY_LATEST = 0,
    QUERY_ALL = 1,
    RESPONSE_BLOCKCHAIN = 2,
    QUERY_TRANSACTION_POOL = 3,
    RESPONSE_TRANSACTION_POOL = 4,
    GET_PARAM = 5,
    RESULT = 6,
    REQUEST_UTXO_LOCK=7,
    UTXO_LOCK_SUCCESS=8,
    FILE_TASK = 10
}

class Message {
    public type: MessageType;
    public data: any;
}

const initP2PServer = (p2pPort: number) => {
    const server: Server = new WebSocket.Server({port: p2pPort});
    server.on('connection', (ws: WebSocket) => {
        initConnection(ws);
    });
    console.log('listening websocket p2p port on: ' + p2pPort);
};

const getSockets = () => sockets;

const initConnection = (ws: WebSocket) => {
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());

    // query transactions pool only some time after chain query
    setTimeout(() => {
        broadcast(queryTransactionPoolMsg());
    }, 500);
};

const JSONToObject = <T>(data: string): T => {
    try {
        return JSON.parse(data);
    } catch (e) {
        console.log(e);
        return null;
    }
};

const initMessageHandler = (ws: WebSocket) => {
    ws.on('message', (data: string) => {

        try {
            const message: Message = JSONToObject<Message>(data);
            if (message === null) {
                console.log('could not parse received JSON message: ' + data);
                return;
            }
            console.log('Received message: %s', JSON.stringify(message));
            switch (message.type) {
                case MessageType.QUERY_LATEST:
                    write(ws, responseLatestMsg());
                    break;
                case MessageType.QUERY_ALL:
                    write(ws, responseChainMsg());
                    break;
                case MessageType.RESPONSE_BLOCKCHAIN:
                    const receivedBlocks: Block[] = JSONToObject<Block[]>(message.data);
                    if (receivedBlocks === null) {
                        console.log('invalid blocks received: %s', JSON.stringify(message.data));
                        break;
                    }
                    handleBlockchainResponse(receivedBlocks);
                    break;
                case MessageType.QUERY_TRANSACTION_POOL:
                    write(ws, responseTransactionPoolMsg());
                    break;
                case MessageType.RESPONSE_TRANSACTION_POOL:
                    const receivedTransactions: Transaction[] = JSONToObject<Transaction[]>(message.data);
                    if (receivedTransactions === null) {
                        console.log('invalid transaction received: %s', JSON.stringify(message.data));
                        break;
                    }
                    receivedTransactions.forEach((transaction: Transaction) => {
                        try {
                            handleReceivedTransaction(transaction);
                            // if no error is thrown, transaction was indeed added to the pool
                            // let's broadcast transaction pool
                            broadCastTransactionPool();
                        } catch (e) {
                            console.log(e.message);
                        }
                    });
                    break;
                case MessageType.GET_PARAM:

                    generatePouwNextBlock(message);
                    break;
                case MessageType.RESULT:

                    let returnMes: string[] = message.data.toString().split('?');
                    let returnCount: string = returnMes[1];
                    let returnRes: string = returnMes[0];
                    let returnPK: string = returnMes[2];
                    let amount=Math.trunc(Math.cbrt(parseInt(returnCount)));
                    //let amount=parseInt(returnCount);
                    console.log("returnRes=");//将返还结果进行打印
                    console.log("returnCount="+returnCount);
                    console.log("returnPK="+returnPK);
                    console.log("amount="+amount);
                    let timeReceived;
                    timeReceived=new Date().getTime();
                    console.log("return time= "+timeReceived);
                    console.log("execution time= "+ (parseInt(timeReceived)-parseInt(timeSend)));
                    //sendTransaction(returnPK,Math.ceil(parseInt(returnCount)/100));
                    //进行锁定交易的解锁
                    let pos = unspentTxOuts.findIndex(item => {
                        return item.LOCK==true && item.address===getPublicFromWallet();//TODO 有点问题
                    });
                    if(unspentTxOuts[pos].amount >= amount || getAccountBalance() >= amount){//预估大于实际 或者账户的钱够用,直接解锁
                        unspentTxOuts[pos].LOCK=false;
                        sendTransaction(returnPK,amount,false);
                    }else{//清空所有钱并且停掉用户
                        //TODO 将欠款数额，被欠款人地址，欠款人地址发送给agent ，，这种情况不容易出现，暂时不写
                        let arrears: number = amount-getAccountBalance();//得到欠款
                        sendTransaction(returnPK,getAccountBalance(),false);//将账户中所有的钱发给任务执行方

                    }

                    break;
                case MessageType.REQUEST_UTXO_LOCK:
                    //接受需要锁定的UTXO钱数
                    let returnInfo: string[] = message.data.toString().split(':');
                    // address+":"+taskName+":"+reqCPU+":"+reqMEM+":"+estiTime+":"+amount.toString()
                    let address:string=returnInfo[0];
                    let taskName:string=returnInfo[1];
                    let params:string=returnInfo[2];
                    let reqCPU:string=returnInfo[3];
                    let reqMEM:string=returnInfo[4];
                    let estiTime:string=returnInfo[5];
                    let money:string=returnInfo[6];


                    if(getAccountBalance() < parseInt(money)){//钱数不足,发送失败信息
                        console.log("The estimate amount is "+money);
                        console.log("Your balance is "+getAccountBalance());
                        console.log("You don't have enough UTXO to do the job");

                    }else{//钱数足，进行UTXO锁定
                        //更改数据结构、找零
                        sendTransaction(getPublicFromWallet(),parseInt(money),true);
                        // 发送找零成功信息
                        getSockets().map((s: any) => {
                            //console.log(s._socket.remoteAddress);
                            let ip = s._socket.remoteAddress;
                            if (s._socket.remoteAddress.substr(0, 7) == "::ffff:") {
                                ip = s._socket.remoteAddress.substr(7)
                            }
                            console.log("ip="+ip);
                            if(ip=="192.168.1.56"){//TODO 现在是硬编码 Agent IP 地址
                                let information : Message = ({'type': MessageType.UTXO_LOCK_SUCCESS, 'data': address+":"+taskName+":"+params+":"+reqCPU+":"+reqMEM+":"+estiTime+":"+money.toString()});//在message中增加发送请求节点IP
                                console.log(information);
                                console.log(JSON.stringify(information));
                                s.send(JSON.stringify(information));
                            }
                        });
                    }
                    break;
                case MessageType.UTXO_LOCK_SUCCESS:
                    let returnAll: string[] = message.data.toString().split(':');
                    // address+":"+taskName+":"+reqCPU+":"+reqMEM+":"+estiTime+":"+amount.toString()
                    let Address:string=returnAll[0];
                    let TaskName:string=returnAll[1];
                    let Params:string=returnAll[2];
                    let ReqCPU:string=returnAll[3];
                    let ReqMEM:string=returnAll[4];
                    let EstiTime:string=returnAll[5];
                    let Money:string=returnAll[6];

                    agent.schedulerTask(Address,TaskName,Params,ReqCPU,ReqMEM,EstiTime,Money);

                    break;
                case MessageType.FILE_TASK:
                    break;
            }
        } catch (e) {
            console.log(e);
        }
    });
};

const write = (ws: WebSocket, message: Message): void => ws.send(JSON.stringify(message));
const broadcast = (message: Message): void => sockets.forEach((socket) => write(socket, message));

const queryChainLengthMsg = (): Message => ({'type': MessageType.QUERY_LATEST, 'data': null});

const queryAllMsg = (): Message => ({'type': MessageType.QUERY_ALL, 'data': null});

const responseChainMsg = (): Message => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(getBlockchain())
});

const responseLatestMsg = (): Message => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN,
    'data': JSON.stringify([getLatestBlock()])
});

const queryTransactionPoolMsg = (): Message => ({
    'type': MessageType.QUERY_TRANSACTION_POOL,
    'data': null
});

const responseTransactionPoolMsg = (): Message => ({
    'type': MessageType.RESPONSE_TRANSACTION_POOL,
    'data': JSON.stringify(getTransactionPool())
});

const initErrorHandler = (ws: WebSocket) => {
    const closeConnection = (myWs: WebSocket) => {
        console.log('connection failed to peer: ' + myWs.url);
        sockets.splice(sockets.indexOf(myWs), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
};
/**
 * 同步区块链
 * @param receivedBlocks
 */
const handleBlockchainResponse = (receivedBlocks: Block[]) => {
    if (receivedBlocks.length === 0) {
        console.log('received block chain size of 0');
        return;
    }
    const latestBlockReceived: Block = receivedBlocks[receivedBlocks.length - 1];
    if (!isValidBlockStructure(latestBlockReceived)) {
        console.log('block structuture not valid');
        return;
    }
    const latestBlockHeld: Block = getLatestBlock();
    if (latestBlockReceived.index > latestBlockHeld.index) {
        console.log('blockchain possibly behind. We got: '
            + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            if (addBlockToChain(latestBlockReceived)) {
                broadcast(responseLatestMsg());
            }
        } else if (receivedBlocks.length === 1) {
            console.log('We have to query the chain from our peer');
            broadcast(queryAllMsg());
        } else {
            console.log('Received blockchain is longer than current blockchain');
            replaceChain(receivedBlocks);
        }
    } else {
        console.log('received blockchain is not longer than received blockchain. Do nothing');
    }
};

const broadcastLatest = (): void => {
    broadcast(responseLatestMsg());
};

const connectToPeers = (newPeer: string): void => {
    const ws: WebSocket = new WebSocket(newPeer);
    ws.on('open', () => {
        initConnection(ws);
    });
    ws.on('error', () => {
        console.log('connection failed');
    });
};

const broadCastTransactionPool = () => {
    broadcast(responseTransactionPoolMsg());
};

export {connectToPeers, broadcastLatest, broadCastTransactionPool, initP2PServer, getSockets, Message, MessageType,JSONToObject};
