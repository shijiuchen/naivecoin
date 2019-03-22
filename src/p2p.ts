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
    unspentTxOuts,
    sleep, getCurrentTimestamp, calculatepouwHash, ReturnAllNcount, addBlockToChainChain
} from './blockchain';
import {ec, getCoinbaseTransaction, toHexString, Transaction, UnspentTxOut} from './transaction';
import {getTransactionPool} from './transactionPool';
import {timeSend} from './agent';
import {agent} from "./main";
import {getPublicFromWallet} from "./wallet";
import {exec} from "child_process";

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
    REQUEST_NCOUNT=9,
    FILE_TASK = 10,
    RES_NCOUNT = 11,
    RESULTAllNODES = 12
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
                        sendTransaction(returnPK,amount,false, null);
                    }else{//清空所有钱并且停掉用户
                        //TODO 将欠款数额，被欠款人地址，欠款人地址发送给agent ，，这种情况不容易出现，暂时不写
                        let arrears: number = amount-getAccountBalance();//得到欠款
                        sendTransaction(returnPK,getAccountBalance(),false, null);//将账户中所有的钱发给任务执行方

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
                        sendTransaction(getPublicFromWallet(),parseInt(money),true , null);
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
                    //请求有用功返还
                case MessageType.REQUEST_NCOUNT:

                    //获取执行的有用功
                    //延迟5秒，等待写入文件
                    let pouw;
                    sleep(5000);
                    console.log("time out finished!");

                    //读取文件，获得有用功
                    var fs = require('fs');
                    var path="/home/syc/naivecoin/log/result.txt";


                    let  receiver : string[]= fs.readFileSync(path, "utf8").toString().split("\n");
                    console.log("receiver="+receiver);
                    let sum : number = 0;
                    for(let i=0; i < receiver.length-1; i++){
                        if(receiver[i].charAt(0)!='.'){
                            sum = sum+parseInt(receiver[i]);
                        }else{
                            sum = sum+0;
                        }
                    }

                    let exeN=sum.toString();

                    //删除有用功记录文件
                    fs.truncate('/home/syc/naivecoin/log/result.txt', 0, function(){console.log('done')});

                    //判断是否有出块条件
                    if(getDifficulty(getBlockchain()) == 0) {

                        //模拟使用intel私钥进行签名，签署result+关键字"SUCCESS"
                        const key = ec.keyFromPrivate("d66437e07a0dd631f3451b4a4cf86336486594ec46a771875db756220518360f", 'hex');
                        pouw = toHexString(key.sign(exeN+";SUCCESS").toDER());
                        console.log("pouw"+pouw);

                    } else {

                        let SRNG1 : number=Math.floor(Math.random()*999+1);
                        let SRNG2 : number=1000;
                        let EXP : number =  2.718281828;
                        let SRNG : number = SRNG1 / SRNG2;
                        let parm1 : number = Math.pow(EXP,(parseInt(exeN)/getDifficulty(getBlockchain())));
                        let parm2 : number= Math.pow(EXP,-(parseInt(exeN)/getDifficulty(getBlockchain())));
                        let Prob : number= (parm1-parm2)/(parm1+parm2);

                        if(Prob > SRNG) {

                            //模拟使用intel私钥进行签名，签署result+关键字"SUCCESS"
                            const key = ec.keyFromPrivate("d66437e07a0dd631f3451b4a4cf86336486594ec46a771875db756220518360f", 'hex');
                            pouw = toHexString(key.sign(exeN+";SUCCESS").toDER());
                            console.log("pouw"+pouw);

                        }
                        else {

                            pouw = "FAILED";

                        }
                    }

                    //根据pouw判断是否可以生成区块
                    if(pouw == "FAILED"){

                        //Do nothing

                    }
                    else {

                        //生成coinbase奖励区块，并挖出之前的交易
                        const previousBlock: Block = getLatestBlock();
                        const nextIndex: number = previousBlock.index + 1;
                        const nextTimestamp: number = getCurrentTimestamp();
                        const coinbaseTx: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
                        const blockData: Transaction[] = [coinbaseTx].concat(getTransactionPool());
                        const hash: string = calculatepouwHash(nextIndex, previousBlock.hash, nextTimestamp, blockData, getDifficulty(getBlockchain()), 0, pouw);
                        const newBlock: Block = new Block(nextIndex, hash, previousBlock.hash, nextTimestamp, blockData, getDifficulty(getBlockchain()), 0,pouw);

                        if (addBlockToChain(newBlock)) {

                            broadcastLatest();
                            //return newBlock;

                        } else {

                            //return null;

                        }

                    }

                    getSockets().map((s: any) => {
                        //console.log(s._socket.remoteAddress);
                        let ip = s._socket.remoteAddress;
                        if (s._socket.remoteAddress.substr(0, 7) == "::ffff:") {
                            ip = s._socket.remoteAddress.substr(7)
                        }
                        if(ip == "192.168.1.56"){
                            let information : Message = ({'type': MessageType.RES_NCOUNT, 'data': getPublicFromWallet()+":"+exeN+":"+message.data.toString()});
                            console.log(information);
                            console.log(JSON.stringify(information));
                            s.send(JSON.stringify(information));
                        }
                    });

                    break;
                case MessageType.FILE_TASK:
                    break;

                    //返回的执行指令数结果
                case MessageType.RES_NCOUNT:

                    ReturnAllNcount(message);

                    break;
                    //分布式任务返还结果
                case MessageType.RESULTAllNODES:

                    let ResAllNodesAmount: string[]=message.data.toString().split(":");
                    let pk1 : string = ResAllNodesAmount[0];
                    let ncount1 : string = ResAllNodesAmount[1];
                    let pk2 : string = ResAllNodesAmount[2];
                    let ncount2 : string = ResAllNodesAmount[3];
                    let pk3 : string = ResAllNodesAmount[4];
                    let ncount3 : string = ResAllNodesAmount[5];
                    let resHadoop : string= ResAllNodesAmount[6];

                    let amount1=Math.trunc(Math.cbrt(parseInt(ncount1)));
                    let amount2=Math.trunc(Math.cbrt(parseInt(ncount2)));
                    let amount3=Math.trunc(Math.cbrt(parseInt(ncount3)));

                    console.log("resHadoop="+resHadoop);//将返还结果进行打印

                    console.log("ncount1="+ncount1);
                    console.log("ncount2="+ncount2);
                    console.log("ncount3="+ncount3);

                    console.log("returnPK1="+pk1);
                    console.log("returnPK2="+pk2);
                    console.log("returnPK3="+pk3);

                    console.log("amount1="+amount1);
                    console.log("amount2="+amount2);
                    console.log("amount3="+amount3);

                    //进行锁定交易的解锁
                    let posFind = unspentTxOuts.findIndex(item => {
                        return item.LOCK==true && item.address===getPublicFromWallet();//TODO 有点问题
                    });

                    //预估大于实际 或者账户的钱够用,直接解锁
                    if(unspentTxOuts[posFind].amount >= (amount1+amount2+amount3) || getAccountBalance() >= (amount1+amount2+amount3)){

                        unspentTxOuts[posFind].LOCK=false;
                        sendTransaction(pk1,amount1,false,null);
                        sendTransaction(pk2,amount2,false,null);
                        sendTransaction(pk3,amount3,false,null);

                    }else{//清空所有钱并且停掉用户

                        //TODO 将欠款数额，被欠款人地址，欠款人地址发送给agent ，，这种情况不容易出现，暂时不写
                        let arrears: number = (amount1+amount2+amount3)-getAccountBalance();//得到欠款
                        sendTransaction(returnPK,getAccountBalance(),false,null);//将账户中所有的钱发给任务执行方

                    }

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

    //先判断是不是智能合约区块
    if(latestBlockReceived.data.length == 2) {
        let name : string = latestBlockReceived.data[1].code;
        let result: string = "";
        if (name === "caffe") {
            exec('bash /home/syc/naivecoin/start_caffe.sh', (err, stdout, stderr) => {
                var fs = require('fs');
                var resPath = "/home/syc/naivecoin/resCaffe.txt";
                result = fs.readFileSync(resPath, "utf8");
                console.log("result= " + result);
                //获取任务执行结果之后，删除记录文件
                fs.truncate('/home/syc/naivecoin/resCaffe.txt', 0, function () {
                    console.log('done')
                });

                if (!isValidBlockStructure(latestBlockReceived)) {
                    console.log('block structuture not valid');
                    return;
                }
                const latestBlockHeld: Block = getLatestBlock();
                if (latestBlockReceived.index > latestBlockHeld.index) {
                    console.log('blockchain possibly behind. We got: '
                        + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
                    if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
                        if (addBlockToChainChain(latestBlockReceived)) {
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


            });
        } else if (name === "asylo") {
            exec('docker run  --rm \\\n' +
                '    -v bazel-cache:/root/.cache/bazel \\\n' +
                '    -v "/home/syc/asylo-examples":/opt/my-project \\\n' +
                '    -w /opt/my-project \\\n' +
                '    gcr.io/asylo-framework/asylo \\\n' +
                '    bazel run --config=enc-sim //quickstart -- --message="' + getDifficulty(getBlockchain()) + '"', (err, stdout, stderr) => {
                //执行任务结果
                result = stdout.toString();
                console.log("result= " + result);

                if (!isValidBlockStructure(latestBlockReceived)) {
                    console.log('block structuture not valid');
                    return;
                }
                const latestBlockHeld: Block = getLatestBlock();
                if (latestBlockReceived.index > latestBlockHeld.index) {
                    console.log('blockchain possibly behind. We got: '
                        + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
                    if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
                        if (addBlockToChainChain(latestBlockReceived)) {
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

            });
        }
    }else{
        //不是，正常验证
        if (!isValidBlockStructure(latestBlockReceived)) {
            console.log('block structuture not valid');
            return;
        }
        const latestBlockHeld: Block = getLatestBlock();
        if (latestBlockReceived.index > latestBlockHeld.index) {
            console.log('blockchain possibly behind. We got: '
                + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
            if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
                if (addBlockToChainChain(latestBlockReceived)) {
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
